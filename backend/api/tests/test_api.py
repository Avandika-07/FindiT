"""API tests: the full report → match → claim → verify → handover flow, fraud guards and error shapes."""
import io
import json
from datetime import date, timedelta

import pytest
from django.test import Client
from PIL import Image

from api.models import Claim, Item, Location, Match, Notification, Profile, StatusHistory, User
from api.services.status import transition

pytestmark = pytest.mark.django_db
TODAY = date.today()


def make_user(roll, name, role=Profile.STUDENT):
    user = User.objects.create_user(username=roll.lower(), password="pw12345")
    Profile.objects.create(user=user, roll_no=roll, display_name=name, role=role)
    return user


@pytest.fixture
def campus():
    lib = Location.objects.create(name="Library", zone="Academic")
    hall = Location.objects.create(name="Reading Hall", zone="Academic")
    canteen = Location.objects.create(name="Canteen", zone="Food")
    lib.link(hall)
    hall.link(canteen)
    return {"lib": lib, "hall": hall, "canteen": canteen}


@pytest.fixture
def people():
    return {
        "owner": make_user("21CS001", "Priya Raman"),
        "finder": make_user("21IT042", "Rahul Nair"),
        "other": make_user("22ME033", "Kavya Iyer"),
        "admin": make_user("ADMIN001", "Admin Desk", Profile.ADMIN),
    }


def client_for(user=None):
    c = Client()
    if user is not None:
        res = c.post(
            "/api/ext/auth/login",
            json.dumps({"roll_no": user.profile.roll_no, "password": "pw12345"}),
            content_type="application/json",
        )
        assert res.status_code == 200, res.content
        c.defaults["HTTP_AUTHORIZATION"] = f"Bearer {res.json()['token']}"
    return c


def post(c, url, data):
    return c.post(url, json.dumps(data), content_type="application/json")


def lost_payload(campus, **kw):
    data = {
        "type": "LOST", "title": "Navy boAt earphones", "description": "boAt earbuds in a navy case",
        "category": "Earphones", "color": "Navy", "brand": "boAt", "location_id": campus["lib"].id,
        "event_date": (TODAY - timedelta(days=2)).isoformat(),
    }
    data.update(kw)
    return data


def found_payload(campus, **kw):
    data = {
        "type": "FOUND", "title": "Blue earbuds case", "description": "Blue earphones case on a desk",
        "category": "Earphones", "color": "Blue", "brand": "boat", "location_id": campus["hall"].id,
        "event_date": (TODAY - timedelta(days=1)).isoformat(),
        "secret_question": "What name is on the sticker?", "secret_answer": "Priya",
    }
    data.update(kw)
    return data


def png_bytes(color=(40, 90, 230)):
    buf = io.BytesIO()
    Image.new("RGB", (64, 48), color).save(buf, "PNG")
    buf.seek(0)
    buf.name = "photo.png"
    return buf


def test_health_and_json_errors():
    c = Client()
    assert c.get("/api/health").json() == {"status": "ok"}
    res = c.get("/api/does-not-exist")
    assert res.status_code == 404 and res.json()["error"]["code"] == "not_found"
    res = c.put("/api/items")
    assert res.status_code == 405 and "error" in res.json()
    assert c.get("/api/items/abc").status_code == 400
    assert c.get("/api/items/").status_code == 404  # no trailing-slash redirect


def test_auth_required_and_invalid_json(campus, people):
    assert post(Client(), "/api/items", lost_payload(campus)).status_code == 401
    c = client_for(people["owner"])
    res = c.post("/api/items", "{not json", content_type="application/json")
    assert res.status_code == 400 and res.json()["error"]["code"] == "invalid_json"


def test_validation_errors_are_per_field(campus, people):
    c = client_for(people["owner"])
    res = post(c, "/api/items", lost_payload(campus, title="a", category="?"))
    assert res.status_code == 400
    fields = res.json()["error"]["fields"]
    assert "title" in fields and "category" in fields
    res = post(c, "/api/items", found_payload(campus, secret_answer=None) | {"secret_answer": "   "})
    assert res.status_code == 400
    res = post(c, "/api/items", lost_payload(campus, event_date=(TODAY + timedelta(days=3)).isoformat()))
    assert res.status_code == 400 and "event_date" in res.json()["error"]["fields"]
    assert post(c, "/api/items", lost_payload(campus, location_id=9999)).status_code == 404


def test_reporting_a_new_kind_of_item_adds_a_category(campus, people):
    c = client_for(people["owner"])
    item = post(c, "/api/items", lost_payload(campus, category="  power   bank ")).json()
    assert item["category"] == "Power bank"
    again = post(c, "/api/items", found_payload(campus, category="POWER BANK")).json()
    assert again["category"] == "Power bank"
    assert post(c, "/api/items", lost_payload(campus, category="earphones")).json()["category"] == "Earphones"
    names = [cat["name"] for cat in Client().get("/api/ext/meta").json()["categories"]]
    assert names.count("Power bank") == 1 and names[-1] == "Other" and len(names) == 18
    assert {"name": "Power bank", "icon": "tag"} in Client().get("/api/ext/meta").json()["categories"]
    assert c.get("/api/items", {"category": "Power bank"}).json()["total"] == 2
    res = post(c, "/api/items", lost_payload(campus, category="123"))
    assert res.status_code == 400 and "category" in res.json()["error"]["fields"]


def test_match_and_claim_are_emailed(campus, people, mailoutbox, settings):
    settings.EMAIL_REDIRECT_TO = []
    for key in ("owner", "finder"):
        people[key].email = f"{key}@example.com"
        people[key].save()
    owner, finder = client_for(people["owner"]), client_for(people["finder"])
    post(owner, "/api/items", lost_payload(campus))
    found = post(finder, "/api/items", found_payload(campus)).json()

    # A match e-mails both sides: the owner and the finder.
    sent = {(m.to[0], m.subject) for m in mailoutbox}
    assert ("owner@example.com", "FindiT: Possible match for your Navy boAt earphones") in sent
    assert any(to == "finder@example.com" and "may have an owner" in subject for to, subject in sent)
    assert all(m.alternatives and "/items/" in m.body for m in mailoutbox)

    # A claim e-mails the finder; with a common inbox set, mail goes there and names the user.
    settings.EMAIL_REDIRECT_TO = ["desk@example.com"]
    mailoutbox.clear()
    post(owner, f"/api/items/{found['id']}/claims", {"proof_text": "My boAt earbuds, navy case.", "secret_answer": "priya"})
    claim_mail = next(m for m in mailoutbox if m.subject.startswith("FindiT: New claim"))
    assert claim_mail.to == ["desk@example.com"] and "finder@example.com" in claim_mail.body


def test_full_flow_report_match_claim_verify_handover(campus, people):
    owner, finder, admin = client_for(people["owner"]), client_for(people["finder"]), client_for(people["admin"])

    lost = post(owner, "/api/items", lost_payload(campus))
    assert lost.status_code == 201
    lost = lost.json()
    assert lost["status"] == "OPEN" and lost["secret_question"] is None

    found = post(finder, "/api/items", found_payload(campus)).json()
    assert "secret_answer" not in json.dumps(found)
    assert finder.post(f"/api/items/{found['id']}/photo", {"photo": png_bytes()}).status_code == 200

    # Matching ran automatically and notified the owner.
    matches = Client().get(f"/api/items/{lost['id']}/matches").json()
    assert len(matches) == 1 and matches[0]["item"]["id"] == found["id"]
    m = matches[0]
    assert m["score"] == sum(m["breakdown"].values()) and m["breakdown"]["category"] == 25
    assert Item.objects.get(id=lost["id"]).status == "MATCHED"
    assert Notification.objects.filter(user=people["owner"], kind="MATCH").exists()

    # Public view of the found item shows only the blurred photo.
    public = Client().get(f"/api/items/{found['id']}").json()
    assert public["photo_blurred"] is True and "/public/" in public["photo_url"]

    # Search finds it through typos and synonyms.
    res = Client().get("/api/search", {"q": "blu earfone"}).json()
    assert res["results"][0]["item"]["id"] in (lost["id"], found["id"])
    assert {r["method"] for r in res["results"][0]["reasons"]} <= {"exact", "synonym", "prefix", "sounds_like", "typo"}

    # Claim with the right answer.
    claim = post(owner, f"/api/items/{found['id']}/claims", {"proof_text": "My boAt earbuds, navy case.", "secret_answer": "priya"})
    assert claim.status_code == 201
    claim = claim.json()
    assert claim["answer_score"] is None and claim["handover_code"] is None  # hidden from the claimant
    assert finder.get(f"/api/claims/{claim['id']}").json()["answer_score"] == 100
    assert Item.objects.get(id=found["id"]).status == "CLAIM_PENDING"

    # A stranger can't see or review it.
    other = client_for(people["other"])
    assert other.get(f"/api/claims/{claim['id']}").status_code == 403
    assert post(other, f"/api/claims/{claim['id']}/verify", {"note": "looks fine"}).status_code == 403

    verified = post(admin, f"/api/claims/{claim['id']}/verify", {"note": "Answer matches"})
    assert verified.status_code == 200 and verified.json()["status"] == "VERIFIED"
    code = owner.get(f"/api/claims/{claim['id']}").json()["handover_code"]
    assert code and len(code) == 6 and code.isdigit()
    # The verified claimant may now see the clear photo.
    assert owner.get(f"/api/items/{found['id']}").json()["photo_blurred"] is False

    wrong = "000000" if code != "000000" else "111111"
    res = post(admin, f"/api/claims/{claim['id']}/handover", {"code": wrong})
    assert res.status_code == 400 and "tries left" in res.json()["error"]["message"]

    done = post(admin, f"/api/claims/{claim['id']}/handover", {"code": code})
    assert done.status_code == 200 and done.json()["status"] == "HANDED_OVER"
    assert Item.objects.get(id=found["id"]).status == "RETURNED"
    assert Item.objects.get(id=lost["id"]).status == "RETURNED"
    assert Profile.objects.get(user=people["finder"]).karma == 10

    timeline = Client().get(f"/api/ext/items/{found['id']}/timeline").json()
    assert [t["to_status"] for t in timeline][0] == "OPEN" and timeline[0]["from_status"] is None
    assert timeline[-1]["to_status"] == "RETURNED"


def test_handover_locks_after_five_wrong_codes(campus, people):
    finder, owner, admin = client_for(people["finder"]), client_for(people["owner"]), client_for(people["admin"])
    found = post(finder, "/api/items", found_payload(campus)).json()
    claim = post(owner, f"/api/items/{found['id']}/claims", {"proof_text": "It is mine, navy case.", "secret_answer": "x"}).json()
    post(admin, f"/api/claims/{claim['id']}/verify", {"note": "ok then"})
    code = Claim.objects.get(id=claim["id"]).handover_code
    wrong = "000000" if code != "000000" else "111111"
    statuses = [post(admin, f"/api/claims/{claim['id']}/handover", {"code": wrong}).status_code for _ in range(6)]
    assert statuses == [400, 400, 400, 400, 429, 429]
    assert post(admin, f"/api/claims/{claim['id']}/handover", {"code": code}).status_code == 429


def test_fraud_guards(campus, people, settings):
    finder, owner = client_for(people["finder"]), client_for(people["owner"])
    admin = client_for(people["admin"])
    found = post(finder, "/api/items", found_payload(campus)).json()
    url = f"/api/items/{found['id']}/claims"
    body = {"proof_text": "Definitely my earbuds.", "secret_answer": "nope"}

    assert post(finder, url, body).status_code == 403  # own item
    first = post(owner, url, body)
    assert first.status_code == 201
    assert post(owner, url, body).status_code == 409  # one pending claim per item

    # Each rejection counts; the second one flags the user.
    post(admin, f"/api/claims/{first.json()['id']}/reject", {"note": "Wrong answer"})
    assert Item.objects.get(id=found["id"]).status == "OPEN"
    second = post(owner, url, body).json()
    post(admin, f"/api/claims/{second['id']}/reject", {"note": "Still wrong"})
    profile = Profile.objects.get(user=people["owner"])
    assert profile.rejected_claims == 2 and profile.is_flagged
    assert any(u["id"] == people["owner"].id for u in admin.get("/api/ext/admin/flagged").json())

    # Max pending claims.
    settings.MAX_PENDING_CLAIMS = 1
    a = post(finder, "/api/items", found_payload(campus, title="Steel bottle", category="Bottle")).json()
    b = post(finder, "/api/items", found_payload(campus, title="Black umbrella", category="Umbrella")).json()
    other = client_for(people["other"])
    assert post(other, f"/api/items/{a['id']}/claims", body).status_code == 201
    res = post(other, f"/api/items/{b['id']}/claims", body)
    assert res.status_code == 409 and res.json()["error"]["code"] == "too_many_claims"


def test_lost_items_cannot_be_claimed_and_owner_rules(campus, people):
    owner, other = client_for(people["owner"]), client_for(people["other"])
    lost = post(owner, "/api/items", lost_payload(campus)).json()
    assert post(other, f"/api/items/{lost['id']}/claims", {"proof_text": "Mine for sure.", "secret_answer": "x"}).status_code == 409
    assert other.patch(f"/api/items/{lost['id']}", json.dumps({"title": "Hacked"}), content_type="application/json").status_code == 403
    res = owner.patch(f"/api/items/{lost['id']}", json.dumps({"status": "CLOSED"}), content_type="application/json")
    assert res.status_code == 200 and res.json()["status"] == "CLOSED"
    res = owner.patch(f"/api/items/{lost['id']}", json.dumps({"title": "New title"}), content_type="application/json")
    assert res.status_code == 409
    assert owner.delete(f"/api/items/{lost['id']}").status_code == 204
    assert Client().get(f"/api/items/{lost['id']}").status_code == 404


def test_deleting_a_report_reopens_its_only_match(campus, people):
    owner, finder = client_for(people["owner"]), client_for(people["finder"])
    lost = post(owner, "/api/items", lost_payload(campus)).json()
    found = post(finder, "/api/items", found_payload(campus)).json()
    assert Item.objects.get(id=found["id"]).status == "MATCHED"
    assert owner.delete(f"/api/items/{lost['id']}").status_code == 204
    assert Item.objects.get(id=found["id"]).status == "OPEN"
    assert Match.objects.count() == 0


def test_status_machine_rejects_illegal_transitions(campus, people):
    item = Item.objects.create(
        type="LOST", title="Wallet", category="Wallet", location=campus["lib"], event_date=TODAY, reporter=people["owner"]
    )
    transition(item, Item.CLOSED, people["owner"])
    from api.http import ApiError

    with pytest.raises(ApiError) as err:
        transition(item, Item.OPEN, people["owner"])
    assert err.value.status == 409
    assert StatusHistory.objects.filter(entity_id=item.id, to_status="CLOSED").count() == 1


def test_photo_validation(campus, people, settings):
    owner = client_for(people["owner"])
    lost = post(owner, "/api/items", lost_payload(campus)).json()
    url = f"/api/items/{lost['id']}/photo"
    fake = io.BytesIO(b"not an image at all")
    fake.name = "photo.jpg"
    assert owner.post(url, {"photo": fake}).status_code == 400
    assert owner.post(url, {}).status_code == 400
    settings.MAX_UPLOAD_MB = 0
    assert owner.post(url, {"photo": png_bytes()}).status_code == 413


def test_duplicate_check_and_ext_endpoints(campus, people):
    owner = client_for(people["owner"])
    post(owner, "/api/items", lost_payload(campus))
    res = post(owner, "/api/ext/items/check-duplicates", lost_payload(campus))
    dups = res.json()["duplicates"]
    assert dups and dups[0]["score"] >= 80
    meta = Client().get("/api/ext/meta").json()
    assert len(meta["categories"]) == 17 and meta["zones"]
    assert Client().get("/api/ext/search/suggest", {"prefix": "ear"}).json()["suggestions"]
    assert owner.get("/api/ext/me/items").json()[0]["title"] == "Navy boAt earphones"
    assert owner.get("/api/ext/admin/stats").status_code == 403
    assert client_for(people["admin"]).get("/api/ext/admin/stats").json()["open_lost"] == 1
    assert Match.objects.count() == 0
