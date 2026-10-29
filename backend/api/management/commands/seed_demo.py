"""
python manage.py seed_demo [--reset]

Creates a realistic campus: ~20 locations with neighbour edges, an admin, demo students
and a finder, ~30 items spread over the last two weeks (with deliberate typo and synonym
pairs for the search demo), generated placeholder photos, pending claims, one approved
claim with a handover code, one returned item with a full timeline, and a flagged user.

Safe to run twice: locations and users are reused, and items are only created once
unless --reset is given.
"""
import io
import random
from datetime import datetime, time, timedelta

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from PIL import Image, ImageDraw, ImageFilter

from api import storage
from api.demo import DEMO_STUDENTS, admin_account
from api.models import AuthToken, Claim, CustomCategory, Item, Location, Match, Notification, Profile, StatusHistory, User
from api.services import claims as claim_svc
from api.services import items as item_svc
from api.services.notifications import emails_muted
from api.services import search

LOCATIONS = [
    ("Main Block", "Academic"),
    ("Library", "Academic"),
    ("Reading Hall", "Academic"),
    ("CSE Lab", "Academic"),
    ("ECE Lab", "Academic"),
    ("Mechanical Workshop", "Academic"),
    ("Seminar Hall", "Academic"),
    ("Auditorium", "Academic"),
    ("Canteen", "Food"),
    ("Food Court", "Food"),
    ("Boys Hostel", "Hostel"),
    ("Girls Hostel", "Hostel"),
    ("Sports Ground", "Sports"),
    ("Indoor Stadium", "Sports"),
    ("Parking", "Campus services"),
    ("Admin Office", "Campus services"),
    ("Security Desk", "Campus services"),
    ("Placement Cell", "Campus services"),
    ("Bus Stop", "Campus services"),
    ("Temple", "Campus services"),
]

EDGES = [
    ("Main Block", "Library"),
    ("Main Block", "Admin Office"),
    ("Main Block", "Seminar Hall"),
    ("Main Block", "CSE Lab"),
    ("Library", "Reading Hall"),
    ("Library", "Canteen"),
    ("CSE Lab", "ECE Lab"),
    ("ECE Lab", "Mechanical Workshop"),
    ("Seminar Hall", "Auditorium"),
    ("Seminar Hall", "Placement Cell"),
    ("Admin Office", "Placement Cell"),
    ("Admin Office", "Security Desk"),
    ("Canteen", "Food Court"),
    ("Food Court", "Boys Hostel"),
    ("Food Court", "Girls Hostel"),
    ("Boys Hostel", "Sports Ground"),
    ("Sports Ground", "Indoor Stadium"),
    ("Security Desk", "Parking"),
    ("Parking", "Bus Stop"),
    ("Security Desk", "Bus Stop"),
    ("Temple", "Girls Hostel"),
    ("Temple", "Auditorium"),
    ("Mechanical Workshop", "Parking"),
]

COLOR_RGB = {
    "Black": (40, 42, 52), "White": (236, 236, 230), "Grey": (138, 144, 162), "Silver": (196, 201, 212),
    "Blue": (47, 91, 234), "Navy": (30, 42, 90), "Red": (208, 52, 44), "Maroon": (122, 31, 43),
    "Green": (46, 139, 87), "Yellow": (242, 194, 48), "Orange": (238, 123, 48), "Pink": (232, 106, 158),
    "Purple": (123, 82, 201), "Brown": (139, 90, 60), "Beige": (217, 198, 165), "Gold": (201, 162, 39),
}

# (key, type, reporter, title, description, category, color, brand, place, days_ago, photo, secret q, secret a)
ITEMS = [
    ("earbuds_lost", "LOST", "21CS001", "Navy boAt earphones", "boAt Airdopes in a navy case. The left bud has a small scratch.", "Earphones", "Navy", "boAt", "Library", 3, False, None, None),
    ("earbuds_found", "FOUND", "21IT042", "Blue earbuds case", "Blue TWS earbuds case left on a desk near the window.", "Earphones", "Blue", "boAt", "Reading Hall", 2, True, "What name is written on the sticker inside the case?", "Priya"),
    ("calc_lost", "LOST", "21EC014", "Casio calculator fx-991ES", "Scientific calculator, my name is scratched on the back.", "Calculator", "Black", "Casio", "CSE Lab", 5, False, None, None),
    ("calc_found", "FOUND", "22ME033", "Casio scientific calculator", "Found after the lab exam, grey Casio calculator with a cover.", "Calculator", "Grey", "Casio", "ECE Lab", 4, True, "What name is scratched on the back?", "Arjun M"),
    ("tiffin_lost", "LOST", "22ME033", "Steel tiffin box", "Two-layer steel tiffin with a green lid, has a sticker of a cat.", "Other", "Silver", "Milton", "Canteen", 4, False, None, None),
    ("tiffin_found", "FOUND", "21IT042", "Steel lunchbox with green lid", "Steel lunch box left on table 4.", "Other", "Silver", "Milton", "Canteen", 4, True, "What sticker is on the lid?", "Cat"),
    ("bottle_lost", "LOST", "21CS001", "Milton water bottle", "Blue Milton bottle, 1 litre, dented at the bottom.", "Bottle", "Blue", "Milton", "Sports Ground", 6, False, None, None),
    ("bottle_found", "FOUND", "21EC014", "Blue Milton flask", "Blue steel flask near the stands.", "Bottle", "Blue", "Milton", "Indoor Stadium", 5, True, "Where is the dent on the bottle?", "Bottom"),
    ("id_lost", "LOST", "21EC014", "College ID card", "My college ID card on a blue lanyard.", "ID card", "Blue", None, "Main Block", 1, False, None, None),
    ("id_found", "FOUND", "21IT042", "ID card with blue lanyard", "Found on the stairs of the main block.", "ID card", "Blue", None, "Main Block", 0, True, "What is the roll number on the card?", "21EC014"),
    ("phone_lost", "LOST", "22ME033", "Redmi phone", "Redmi Note 12, black, cracked screen protector, purple back cover.", "Phone", "Black", "Redmi", "Girls Hostel", 6, False, None, None),
    ("bag_found", "FOUND", "21CS001", "Black Skybags backpack", "Black Skybags backpack with a water bottle in the side pocket.", "Bag", "Black", "Skybags", "Auditorium", 2, True, "What is inside the front pocket?", "Earphones"),
    ("specs_found", "FOUND", "21IT042", "Spectacles in a brown case", "Reading glasses in a brown hard case.", "Spectacles", "Brown", "Lenskart", "Seminar Hall", 1, True, "What colour is the frame?", "Black"),
    ("wallet_lost", "LOST", "21EC014", "Brown leather wallet", "Woodland wallet with my ID and some cash.", "Wallet", "Brown", "Woodland", "Food Court", 2, False, None, None),
    ("keys_found", "FOUND", "22ME033", "Bunch of keys with a red keychain", "Three keys on a red keychain.", "Keys", "Red", None, "Parking", 3, True, "What is the keychain shaped like?", "Heart"),
    ("charger_lost", "LOST", "21CS001", "HP laptop charger", "HP 65W charger with a round pin.", "Charger", "Black", "HP", "Placement Cell", 7, False, None, None),
    ("charger_found", "FOUND", "21EC014", "Laptop charger, HP 65W", "Charger left plugged in after the talk.", "Charger", "Black", "HP", "Seminar Hall", 6, True, "What is written on the tape on the cable?", "PR"),
    ("watch_lost", "LOST", "21IT042", "Titan watch", "Silver Titan analog watch with a metal strap.", "Watch", "Silver", "Titan", "Indoor Stadium", 9, False, None, None),
    ("umbrella_found", "FOUND", "21CS001", "Maroon umbrella", "Folding umbrella left at the bus stop bench.", "Umbrella", "Maroon", None, "Bus Stop", 4, True, "What is printed on the handle?", "Flowers"),
    ("earring_lost", "LOST", "22ME033", "Gold earring", "Small gold jhumka earring.", "Jewellery", "Gold", None, "Temple", 8, False, None, None),
    ("record_found", "FOUND", "21IT042", "Physics record notebook", "Classmate long notebook with physics lab records.", "Books and notes", "Blue", "Classmate", "Main Block", 5, True, "Whose name is on the first page?", "Sneha"),
    ("hoodie_lost", "LOST", "21EC014", "Grey hoodie", "Grey hoodie with the college logo.", "Clothing", "Grey", None, "Boys Hostel", 10, False, None, None),
    ("oneplus_found", "FOUND", "22ME033", "OnePlus earbuds", "White OnePlus buds in their case.", "Earphones", "White", "OnePlus", "Canteen", 11, True, "What colour is the case cover?", "Green"),
    ("airpods_lost", "LOST", "21CS001", "Apple AirPods", "White AirPods with a green silicone cover.", "Earphones", "White", "Apple", "Auditorium", 12, False, None, None),
    ("powerbank_found", "FOUND", "21IT042", "Mi power bank 10000mAh", "Black Mi power bank with a USB cable.", "Charger", "Black", "Mi", "Library", 3, True, "What sticker is on the power bank?", "Batman"),
    ("laptop_lost", "LOST", "22ME033", "Dell laptop in a black sleeve", "Dell Inspiron in a black sleeve with a keyboard cover.", "Laptop", "Black", "Dell", "CSE Lab", 13, False, None, None),
    ("casio_watch_found", "FOUND", "21EC014", "Black Casio watch", "Digital Casio watch near the football goal.", "Watch", "Black", "Casio", "Sports Ground", 7, True, "What time is the alarm set to?", "6:30"),
    ("dbms_lost", "LOST", "21IT042", "DBMS spiral notes", "Yellow spiral notebook with DBMS notes.", "Books and notes", "Yellow", None, "Reading Hall", 2, False, None, None),
    ("neckband_lost", "LOST", "21EC014", "boAt neckband", "Black boAt Rockerz neckband.", "Earphones", "Black", "boAt", "Mechanical Workshop", 4, False, None, None),
    ("carkeys_found", "FOUND", "22ME033", "Car keys with a Honda tag", "Honda car key with a black remote.", "Keys", "Black", "Honda", "Parking", 0, True, "What is on the keyring besides the key?", "Coin"),
    ("pouch_lost", "LOST", "22ME033", "Purple pencil pouch", "Purple pouch with pens and a geometry box.", "Other", "Purple", None, "Seminar Hall", 3, False, None, None),
    ("raincoat_found", "FOUND", "21IT042", "Blue raincoat", "Blue raincoat left at the security desk.", "Clothing", "Blue", "Wildcraft", "Security Desk", 35, True, "What is in the pocket?", "Ticket"),
]

FLAGGED = {"roll_no": "22CS077", "password": "student123", "display_name": "Sanjay Kumar", "email": "sanjay@findit.local"}


def make_photo(color, category, seed, shift=0):
    """A simple generated placeholder photo: a coloured object shape on a soft background."""
    rng = random.Random(seed)
    base = COLOR_RGB.get(color or "", (120, 120, 140))
    bg = tuple(min(255, 200 + rng.randint(0, 40)) for _ in range(3))
    img = Image.new("RGB", (640, 480), bg)
    d = ImageDraw.Draw(img)
    for _ in range(14):  # table texture
        y = rng.randint(0, 480)
        d.line([(0, y), (640, y + rng.randint(-30, 30))], fill=tuple(c - 12 for c in bg), width=rng.randint(2, 6))
    x0, y0 = 170 + shift, 120 + shift
    shape = category in ("Earphones", "Watch", "Jewellery", "Spectacles")
    if shape:
        d.ellipse([x0, y0, x0 + 300, y0 + 240], fill=base, outline=(20, 20, 20), width=4)
        d.ellipse([x0 + 90, y0 + 70, x0 + 210, y0 + 170], fill=tuple(min(255, c + 50) for c in base))
    else:
        d.rounded_rectangle([x0, y0, x0 + 300, y0 + 240], radius=36, fill=base, outline=(20, 20, 20), width=4)
        d.rectangle([x0 + 40, y0 + 40, x0 + 140, y0 + 90], fill=tuple(min(255, c + 60) for c in base))
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=88)
    return buf.getvalue()


def upload(data, name="photo.jpg"):
    return SimpleUploadedFile(name, data, content_type="image/jpeg")


class Command(BaseCommand):
    help = "Seed demo locations, users, items, claims and matches (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset", action="store_true", help="Delete all items, claims, notifications and added categories first."
        )

    def handle(self, *args, reset=False, **opts):
        random.seed(42)
        if reset:
            self.stdout.write("Removing existing items, claims, notifications and added categories...")
            for model in (Notification, StatusHistory, Match, Claim, Item, CustomCategory, AuthToken):
                model.objects.all().delete()
            storage.delete_all()
            Profile.objects.update(karma=0, rejected_claims=0, is_flagged=False)

        locations = self.seed_locations()
        users = self.seed_users()
        if Item.objects.filter(reporter__in=users.values()).exists():
            self.stdout.write(self.style.WARNING("Demo items already exist. Use --reset to recreate them."))
        else:
            with emails_muted():  # demo history should not flood anyone's inbox
                self.seed_items(locations, users)
        search.rebuild()
        self.stdout.write(self.style.SUCCESS("Demo data ready."))
        self.stdout.write("Log in as: admin {} / {}, students 21CS001 21EC014 22ME033 / student123, finder 21IT042 / finder123".format(
            settings.SEED_ADMIN_EMAIL, settings.SEED_ADMIN_PASSWORD))

    def seed_locations(self):
        locations = {}
        for name, zone in LOCATIONS:
            loc, _ = Location.objects.get_or_create(name=name, defaults={"zone": zone})
            if loc.zone != zone:
                loc.zone = zone
                loc.save(update_fields=["zone"])
            locations[name] = loc
        for a, b in EDGES:
            locations[a].link(locations[b])
        self.stdout.write(f"{len(locations)} locations")
        return locations

    def _user(self, roll_no, password, display_name, email, role):
        user = User.objects.filter(profile__roll_no=roll_no).first()
        if user is None:
            user = User.objects.create_user(username=roll_no.lower(), email=email, password=password)
            Profile.objects.create(user=user, roll_no=roll_no, display_name=display_name, role=role)
        else:
            user.set_password(password)
            user.email = email
            user.save()
            Profile.objects.filter(user=user).update(display_name=display_name, role=role)
        user.first_name = display_name.split()[0]
        user.save(update_fields=["first_name"])
        return User.objects.select_related("profile").get(id=user.id)

    def seed_users(self):
        admin = admin_account()
        users = {"ADMIN": self._user(admin["roll_no"], admin["password"], admin["display_name"], admin["email"], Profile.ADMIN)}
        for s in DEMO_STUDENTS:
            users[s["roll_no"]] = self._user(s["roll_no"], s["password"], s["display_name"], s["email"], Profile.STUDENT)
        users[FLAGGED["roll_no"]] = self._user(
            FLAGGED["roll_no"], FLAGGED["password"], FLAGGED["display_name"], FLAGGED["email"], Profile.STUDENT
        )
        self.stdout.write(f"{len(users)} users")
        return users

    @transaction.atomic
    def seed_items(self, locations, users):
        today = timezone.localdate()
        items = {}
        # Oldest first so timelines and matches build up in a natural order.
        for row in sorted(ITEMS, key=lambda r: -r[9]):
            key, type_, roll, title, desc, cat, color, brand, place, days, photo, q, a = row
            data = {
                "type": type_, "title": title, "description": desc, "category": cat, "color": color,
                "brand": brand, "location_id": locations[place].id,
                "event_date": (today - timedelta(days=days)).isoformat(),
            }
            if type_ == "FOUND":
                data.update(secret_question=q, secret_answer=a)
            item = item_svc.create_item(users[roll], data)
            if photo:
                item = item_svc.set_item_photo(users[roll], item, upload(make_photo(color, cat, key)))
            items[key] = item
            self._backdate_item(item, days)
        self.stdout.write(f"{len(items)} items")

        admin, priya, arjun, kavya, rahul = (
            users["ADMIN"], users["21CS001"], users["21EC014"], users["22ME033"], users["21IT042"]
        )
        sanjay = users[FLAGGED["roll_no"]]

        # 1. Returned with a full timeline: Kavya's tiffin, found by Rahul.
        c = claim_svc.create_claim(kavya, items["tiffin_found"], {
            "proof_text": "It is my two-layer tiffin, the lid has a cat sticker my sister put on.", "secret_answer": "cat"})
        claim_svc.verify_claim(admin, c, "Secret answer matches and the description is detailed.")
        c.refresh_from_db()
        claim_svc.complete_handover(admin, c, c.handover_code)
        self._backdate_claim(c, items["tiffin_found"], hours_after=20)

        # 2. Approved and waiting for handover: Arjun's calculator, found by Kavya.
        c = claim_svc.create_claim(arjun, items["calc_found"], {
            "proof_text": "My Casio fx-991ES, I scratched 'Arjun M' on the back in first year.", "secret_answer": "Arjun M."})
        claim_svc.verify_claim(admin, c, "Name on the back matches.")
        self._backdate_claim(c, items["calc_found"], hours_after=10)

        # 3. Pending, strong evidence with a proof photo: Priya's earbuds, found by Rahul.
        c = claim_svc.create_claim(priya, items["earbuds_found"], {
            "proof_text": "These are my boAt Airdopes, navy case, the left bud has a scratch. Lost them in the library.",
            "secret_answer": "priya"})
        claim_svc.set_proof_photo(priya, c, upload(make_photo("Blue", "Earphones", "earbuds_found", shift=6), "proof.jpg"))
        self._backdate_claim(c, items["earbuds_found"], hours_after=5)

        # 4. Flagged user: two earlier rejected claims, and a weak pending one on the bottle.
        for key, answer in (("umbrella_found", "black"), ("powerbank_found", "none")):
            c = claim_svc.create_claim(sanjay, items[key], {"proof_text": "I think this is mine, I lost one like it.", "secret_answer": answer})
            claim_svc.reject_claim(admin, c, "Secret answer did not match and no other proof.")
            self._backdate_claim(c, items[key], hours_after=8)
        c = claim_svc.create_claim(sanjay, items["bottle_found"], {
            "proof_text": "Blue bottle, I lost it at the ground last week.", "secret_answer": "side"})
        self._backdate_claim(c, items["bottle_found"], hours_after=6)

        # 5. Expired: an old found item nobody claimed.
        call_command("expire_items", verbosity=0)

        Notification.objects.filter(user__in=[admin]).update(is_read=False)
        self.stdout.write(f"{Claim.objects.count()} claims, {Match.objects.count()} matches")

    def _backdate_item(self, item, days_ago):
        tz = timezone.get_current_timezone()
        day = timezone.localdate() - timedelta(days=days_ago)
        created = timezone.make_aware(datetime.combine(day, time(9, 0)), tz) + timedelta(minutes=random.randint(0, 9 * 60))
        created = min(created, timezone.now() - timedelta(minutes=5))
        Item.objects.filter(id=item.id).update(created_at=created, updated_at=created)
        self._spread_history(StatusHistory.ITEM, item.id, created)

    def _backdate_claim(self, claim, item, hours_after):
        item.refresh_from_db()
        created = min(item.created_at + timedelta(hours=hours_after), timezone.now() - timedelta(minutes=2))
        Claim.objects.filter(id=claim.id).update(created_at=created, updated_at=created)
        self._spread_history(StatusHistory.CLAIM, claim.id, created)
        # Item entries caused by this claim happen after it was sent.
        entries = list(StatusHistory.objects.filter(entity_type=StatusHistory.ITEM, entity_id=item.id).order_by("id"))
        first = entries[0].at if entries else item.created_at
        later = [e for e in entries[1:] if e.at > created or e.to_status in (Item.CLAIM_PENDING, Item.RETURNED, Item.OPEN)]
        self._spread(later, max(created, first))
        returned = StatusHistory.objects.filter(entity_type=StatusHistory.ITEM, entity_id=item.id, to_status=Item.RETURNED).first()
        if returned:
            Item.objects.filter(id=item.id).update(returned_at=returned.at, updated_at=returned.at)

    def _spread_history(self, entity_type, entity_id, start):
        entries = list(StatusHistory.objects.filter(entity_type=entity_type, entity_id=entity_id).order_by("id"))
        if entries:
            StatusHistory.objects.filter(id=entries[0].id).update(at=start)
            self._spread(entries[1:], start)

    def _spread(self, entries, start):
        """Space follow-up timeline entries a few hours apart, never in the future."""
        now = timezone.now()
        if not entries:
            return
        room = max(timedelta(minutes=len(entries)), now - start - timedelta(minutes=1))
        step = min(timedelta(hours=7), room / (len(entries) + 1))
        for i, entry in enumerate(entries, start=1):
            StatusHistory.objects.filter(id=entry.id).update(at=start + step * i)
