from django.conf import settings
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models

from .ids import next_id

CATEGORIES = [
    ("Phone", "smartphone"),
    ("Earphones", "headphones"),
    ("Wallet", "wallet"),
    ("ID card", "id-card"),
    ("Keys", "key-round"),
    ("Bag", "backpack"),
    ("Bottle", "milk"),
    ("Laptop", "laptop"),
    ("Charger", "plug-zap"),
    ("Watch", "watch"),
    ("Spectacles", "glasses"),
    ("Calculator", "calculator"),
    ("Books and notes", "book-open"),
    ("Umbrella", "umbrella"),
    ("Jewellery", "gem"),
    ("Clothing", "shirt"),
    ("Other", "package"),
]
CATEGORY_NAMES = [name for name, _ in CATEGORIES]

COLORS = [
    ("Black", "#1F2330"),
    ("White", "#F4F4F0"),
    ("Grey", "#8A90A2"),
    ("Silver", "#C4C9D4"),
    ("Blue", "#2F5BEA"),
    ("Navy", "#1E2A5A"),
    ("Red", "#D0342C"),
    ("Maroon", "#7A1F2B"),
    ("Green", "#2E8B57"),
    ("Yellow", "#F2C230"),
    ("Orange", "#EE7B30"),
    ("Pink", "#E86A9E"),
    ("Purple", "#7B52C9"),
    ("Brown", "#8B5A3C"),
    ("Beige", "#D9C6A5"),
    ("Gold", "#C9A227"),
]


class Counter(models.Model):
    """Named sequence used to hand out integer ids (see api/ids.py)."""

    name = models.CharField(max_length=60, primary_key=True, db_column="_id")
    seq = models.BigIntegerField(default=0)


class IntIdModel(models.Model):
    """
    Base for every FindiT table: an integer primary key stored in `_id`, assigned from a
    counter on first save. Works the same on SQLite and MongoDB, so ids stay integers as
    the API contract requires.
    """

    id = models.BigIntegerField(primary_key=True, db_column="_id", editable=False)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if self.id is None:
            self.id = next_id(type(self))
            kwargs["force_insert"] = True
        super().save(*args, **kwargs)


class UserManager(BaseUserManager):
    def create_user(self, username, email="", password=None, **extra):
        user = self.model(username=username, email=self.normalize_email(email), **extra)
        user.set_password(password)
        user.save()
        return user


class User(IntIdModel, AbstractBaseUser):
    """Login account. Student/admin details live on Profile."""

    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(blank=True, default="")
    first_name = models.CharField(max_length=150, blank=True, default="")
    is_active = models.BooleanField(default=True)

    USERNAME_FIELD = "username"
    EMAIL_FIELD = "email"
    objects = UserManager()

    def __str__(self):
        return self.username


class Location(IntIdModel):
    name = models.CharField(max_length=80, unique=True)
    zone = models.CharField(max_length=40)

    class Meta:
        ordering = ["zone", "name"]

    def __str__(self):
        return self.name

    def link(self, other):
        """Mark two places as next to each other (both directions)."""
        for a, b in ((self, other), (other, self)):
            LocationLink.objects.get_or_create(from_location=a, to_location=b)


class LocationLink(IntIdModel):
    """One edge of the campus map: `from_location` is next to `to_location`."""

    from_location = models.ForeignKey(Location, on_delete=models.CASCADE, related_name="links_out")
    to_location = models.ForeignKey(Location, on_delete=models.CASCADE, related_name="links_in")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["from_location", "to_location"], name="unique_location_link")]


class CustomCategory(IntIdModel):
    """A kind of item a student added while reporting, shown after the built-in CATEGORIES."""

    name = models.CharField(max_length=30)
    key = models.CharField(max_length=30, unique=True)  # lower-case name, so "power bank" == "Power Bank"
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Profile(IntIdModel):
    STUDENT = "STUDENT"
    ADMIN = "ADMIN"
    ROLES = [(STUDENT, "Student"), (ADMIN, "Admin")]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    roll_no = models.CharField(max_length=40, unique=True)
    display_name = models.CharField(max_length=80)
    role = models.CharField(max_length=10, choices=ROLES, default=STUDENT)
    karma = models.IntegerField(default=0)
    rejected_claims = models.IntegerField(default=0)
    is_flagged = models.BooleanField(default=False)

    @property
    def is_admin(self):
        return self.role == self.ADMIN

    @property
    def first_name(self):
        return (self.display_name.split() or ["Someone"])[0]


class AuthToken(IntIdModel):
    key = models.CharField(max_length=64, unique=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tokens")
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()


class Item(IntIdModel):
    LOST = "LOST"
    FOUND = "FOUND"
    TYPES = [(LOST, "Lost"), (FOUND, "Found")]

    OPEN = "OPEN"
    MATCHED = "MATCHED"
    CLAIM_PENDING = "CLAIM_PENDING"
    RETURNED = "RETURNED"
    EXPIRED = "EXPIRED"
    CLOSED = "CLOSED"
    STATUSES = [(s, s) for s in (OPEN, MATCHED, CLAIM_PENDING, RETURNED, EXPIRED, CLOSED)]

    type = models.CharField(max_length=5, choices=TYPES)
    title = models.CharField(max_length=80)
    description = models.TextField(blank=True, default="")
    category = models.CharField(max_length=30)
    color = models.CharField(max_length=30, null=True, blank=True)
    brand = models.CharField(max_length=40, null=True, blank=True)
    location = models.ForeignKey(Location, on_delete=models.PROTECT, related_name="items")
    event_date = models.DateField()
    photo = models.CharField(max_length=200, blank=True, default="")          # clear copy, private name
    photo_blurred = models.CharField(max_length=200, blank=True, default="")  # public blurred copy
    photo_hash = models.CharField(max_length=16, blank=True, default="")
    secret_question = models.CharField(max_length=160, null=True, blank=True)
    secret_answer = models.CharField(max_length=80, null=True, blank=True)    # never serialized
    status = models.CharField(max_length=15, choices=STATUSES, default=OPEN)
    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="items")
    returned_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["type", "status"]), models.Index(fields=["event_date"])]


class Claim(IntIdModel):
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"
    HANDED_OVER = "HANDED_OVER"
    STATUSES = [(s, s) for s in (PENDING, VERIFIED, REJECTED, HANDED_OVER)]

    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="claims")
    claimant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="claims")
    proof_text = models.TextField()
    proof_photo = models.CharField(max_length=200, blank=True, default="")
    secret_answer_given = models.CharField(max_length=80, blank=True, default="")
    answer_score = models.IntegerField(null=True, blank=True)
    photo_similarity = models.IntegerField(null=True, blank=True)
    status = models.CharField(max_length=12, choices=STATUSES, default=PENDING)
    decision_note = models.CharField(max_length=500, null=True, blank=True)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    handover_code = models.CharField(max_length=12, null=True, blank=True)
    handover_attempts = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class Match(IntIdModel):
    lost = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="matches_as_lost")
    found = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="matches_as_found")
    score = models.IntegerField()
    breakdown = models.JSONField(default=dict)
    reasons = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-score", "-id"]
        constraints = [models.UniqueConstraint(fields=["lost", "found"], name="unique_lost_found")]


class AIReview(IntIdModel):
    """
    The AI's second opinion on one Match, produced in the background by a local model.
    The handwritten score on Match stays the source of truth; this is a recommendation.
    """

    PENDING = "PENDING"
    RUNNING = "RUNNING"
    DONE = "DONE"
    FAILED = "FAILED"
    STATUSES = [(s, s) for s in (PENDING, RUNNING, DONE, FAILED)]

    match = models.OneToOneField(Match, on_delete=models.CASCADE, related_name="ai_review")
    status = models.CharField(max_length=10, choices=STATUSES, default=PENDING)
    is_match = models.BooleanField(null=True, blank=True)
    score = models.IntegerField(null=True, blank=True)
    confidence = models.CharField(max_length=10, blank=True, default="")
    reason = models.CharField(max_length=600, blank=True, default="")
    matching_features = models.JSONField(default=list)
    conflicting_features = models.JSONField(default=list)
    model_name = models.CharField(max_length=80, blank=True, default="")
    error = models.CharField(max_length=300, blank=True, default="")
    attempts = models.IntegerField(default=0)
    duration_ms = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [models.Index(fields=["status"])]


class StatusHistory(IntIdModel):
    ITEM = "ITEM"
    CLAIM = "CLAIM"
    ENTITIES = [(ITEM, "Item"), (CLAIM, "Claim")]

    entity_type = models.CharField(max_length=5, choices=ENTITIES)
    entity_id = models.IntegerField()
    from_status = models.CharField(max_length=15, null=True, blank=True)
    to_status = models.CharField(max_length=15)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    note = models.CharField(max_length=300, blank=True, default="")
    at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["at", "id"]
        indexes = [models.Index(fields=["entity_type", "entity_id"])]


class Notification(IntIdModel):
    KINDS = [
        (k, k) for k in ("MATCH", "CLAIM_NEW", "CLAIM_VERIFIED", "CLAIM_REJECTED", "RETURNED", "SYSTEM")
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=20, choices=KINDS)
    title = models.CharField(max_length=120)
    body = models.CharField(max_length=300, blank=True, default="")
    link = models.CharField(max_length=200, null=True, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
