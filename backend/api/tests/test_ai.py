"""AI match recommendation: input safety, verdict normalisation, queueing and endpoints (model faked)."""
import json

import pytest

from api.models import AIReview, Match
from api.services import ai
from api.tests.test_api import campus, client_for, found_payload, lost_payload, people, post  # noqa: F401  (fixtures)

pytestmark = pytest.mark.django_db


@pytest.fixture
def ai_on(settings, monkeypatch):
    settings.AI_ENABLED = True
    settings.AI_PROVIDER = "ollama"
    settings.AI_REVIEWS_PER_ITEM = 3
    calls = []

    def fake_post(path, body, timeout):
        calls.append(body)
        reply = {"match": False, "score": 91.6, "confidence": "low", "reason": "Same boAt case and brand.",
                 "matching_features": ["brand boAt", "earphone case"], "conflicting_features": []}
        return {"message": {"content": "<think>hmm</think>" + json.dumps(reply)}}

    monkeypatch.setattr(ai, "_post", fake_post)
    return calls


def test_normalize_enforces_prompt_rules():
    v = ai.normalize({"score": 150, "match": False, "confidence": "low", "reason": " x ", "matching_features": ["a", ""]})
    assert v["score"] == 100 and v["is_match"] is True and v["confidence"] == "high"
    assert v["matching_features"] == ["a"] and v["conflicting_features"] == []
    assert ai.normalize({"score": 72})["confidence"] == "medium"
    v = ai.normalize({"score": 59, "match": True})
    assert v["is_match"] is False and v["confidence"] == "low"
    with pytest.raises(ai.AIUnavailable):
        ai.normalize({"score": "lots"})


def test_extract_json_tolerates_think_blocks_and_noise():
    assert ai._extract_json('<think>long</think>\n{"score": 5}') == {"score": 5}
    assert ai._extract_json('Here you go: {"score": 7} thanks') == {"score": 7}
    with pytest.raises(ai.AIUnavailable):
        ai._extract_json("no json here")


def test_reviews_are_queued_and_never_see_the_secret_answer(campus, people, ai_on):
    owner, finder = client_for(people["owner"]), client_for(people["finder"])
    post(owner, "/api/items", lost_payload(campus))
    post(finder, "/api/items", found_payload(campus))
    review = AIReview.objects.get()
    assert review.status == AIReview.PENDING

    ai.process_pending()
    review.refresh_from_db()
    assert review.status == AIReview.DONE
    assert review.score == 92 and review.is_match is True and review.confidence == "high"  # normalised, not trusted
    assert review.model_name

    sent = json.dumps(ai_on[0])
    assert "Priya" not in sent  # the found item's secret answer
    payload = json.loads(ai_on[0]["messages"][1]["content"])
    assert payload["context"]["location_relation"] == "1 place apart on the campus map"
    assert "brand" in payload["lost_report"] and "secret_question" not in payload["found_report"]
    assert ai_on[0]["messages"][0]["content"].startswith("You are a Lost & Found Product Matching AI.")


def test_failure_is_recorded_and_can_be_retried(campus, people, ai_on, monkeypatch):
    def down(*a, **k):
        raise ai.AIUnavailable("model server not reachable")

    monkeypatch.setattr(ai, "_post", down)
    post(client_for(people["owner"]), "/api/items", lost_payload(campus))
    post(client_for(people["finder"]), "/api/items", found_payload(campus))
    ai.process_pending()
    review = AIReview.objects.get()
    assert review.status == AIReview.FAILED and "not reachable" in review.error

    res = client_for(people["owner"]).post(f"/api/ext/matches/{review.match_id}/ai-review")
    assert res.status_code == 202 and res.json()["status"] == "PENDING"


def test_ai_endpoints(campus, people, ai_on):
    owner, finder, other = client_for(people["owner"]), client_for(people["finder"]), client_for(people["other"])
    lost = post(owner, "/api/items", lost_payload(campus)).json()
    post(finder, "/api/items", found_payload(campus))
    ai.process_pending()
    match = Match.objects.get()

    data = owner.get(f"/api/ext/items/{lost['id']}/ai-reviews").json()
    assert data["enabled"] is True and data["reviews"][0]["match_id"] == match.id
    assert data["reviews"][0]["score"] == 92 and data["reviews"][0]["matching_features"]

    assert other.post(f"/api/ext/matches/{match.id}/ai-review").status_code == 403
    assert owner.post("/api/ext/matches/999999/ai-review").status_code == 404
    assert "queue" in owner.get("/api/ext/ai/status").json()

    # Editing the lost report changes the matcher score, so the old AI opinion is reset.
    owner.patch(f"/api/items/{lost['id']}", json.dumps({"description": "Black wired earphones, no case"}),
                content_type="application/json")
    if Match.objects.filter(id=match.id).exists():
        assert AIReview.objects.get(match=match).status == AIReview.PENDING


def test_ai_off_means_no_reviews(campus, people, settings):
    settings.AI_ENABLED = False
    post(client_for(people["owner"]), "/api/items", lost_payload(campus))
    post(client_for(people["finder"]), "/api/items", found_payload(campus))
    assert Match.objects.count() == 1 and AIReview.objects.count() == 0
    res = client_for(people["owner"]).post(f"/api/ext/matches/{Match.objects.get().id}/ai-review")
    assert res.status_code == 409
