"""
Claim rules: fraud guards, the secret-answer check, photo proof, verification and the
handover code that completes a return.
"""
import io
import secrets

from django.conf import settings
from django.db import transaction
from django.db.models import F

from ..core.distance import similarity_percent
from ..core.image_hash import dhash_image, hash_similarity
from ..http import ApiError
from ..models import Claim, Item, Match, Profile
from ..validators import validate_photo
from .. import storage
from .notifications import notify, notify_admins
from .status import can_transition, record_created, transition

CLAIMABLE = [Item.OPEN, Item.MATCHED, Item.CLAIM_PENDING]


def get_claim(claim_id):
    claim = (
        Claim.objects.select_related("item__location", "item__reporter__profile", "claimant__profile")
        .filter(id=claim_id)
        .first()
    )
    if claim is None:
        raise ApiError(404, "not_found", "We couldn't find that claim.")
    return claim


def is_reviewer(user, claim):
    return user.profile.is_admin or claim.item.reporter_id == user.id


def assert_can_view(user, claim):
    if claim.claimant_id != user.id and not is_reviewer(user, claim):
        raise ApiError(403, "forbidden", "Only the claimant, the finder and the admin desk can see this claim.")


def assert_reviewer(user, claim):
    if not is_reviewer(user, claim):
        raise ApiError(403, "forbidden", "Only the finder or the admin desk can review this claim.")


@transaction.atomic
def create_claim(user, item, data):
    if item.type != Item.FOUND:
        raise ApiError(409, "not_claimable", "Only found items can be claimed. This is a lost-item report.")
    if item.reporter_id == user.id:
        raise ApiError(403, "own_item", "You reported this item yourself, so you can't claim it.")
    if item.status not in CLAIMABLE:
        raise ApiError(409, "not_claimable", "This item can't be claimed any more.")
    if item.claims.filter(status=Claim.VERIFIED).exists():
        raise ApiError(409, "already_approved", "A claim on this item is already approved and waiting for handover.")
    if item.claims.filter(claimant=user, status=Claim.PENDING).exists():
        raise ApiError(409, "duplicate_claim", "You already have a claim under review for this item.")
    pending = Claim.objects.filter(claimant=user, status=Claim.PENDING).count()
    if pending >= settings.MAX_PENDING_CLAIMS:
        raise ApiError(
            409,
            "too_many_claims",
            f"You already have {pending} claims under review. Wait for a decision before claiming more.",
        )

    answer = (data.get("secret_answer") or "").strip()
    claim = Claim.objects.create(
        item=item,
        claimant=user,
        proof_text=data["proof_text"].strip() or data["proof_text"],
        secret_answer_given=answer[:80],
        answer_score=similarity_percent(answer, item.secret_answer) if item.secret_answer else None,
    )
    record_created(claim, user, "Claim sent for review")
    if item.status != Item.CLAIM_PENDING:
        transition(item, Item.CLAIM_PENDING, user, f"{user.profile.first_name} sent a claim")
    notify(
        item.reporter,
        "CLAIM_NEW",
        f"New claim on {item.title}",
        f"{user.profile.first_name} says it is theirs. Review the claim.",
        f"/items/{item.id}",
    )
    notify_admins("CLAIM_NEW", f"New claim on {item.title}", "A claim is waiting in the queue.", "/admin?tab=queue")
    return claim


def set_proof_photo(user, claim, upload):
    if claim.claimant_id != user.id:
        raise ApiError(403, "forbidden", "Only the person who made the claim can add a proof photo.")
    if claim.status != Claim.PENDING:
        raise ApiError(409, "not_pending", "Proof photos can only be added while the claim is under review.")
    clear, _, _ = validate_photo(upload)
    old = claim.proof_photo
    claim.proof_photo = storage.save_image("claims", clear, private=True)
    item = claim.item
    if item.photo_hash:
        claim.photo_similarity = hash_similarity(dhash_image(io.BytesIO(clear)), item.photo_hash)
    claim.save(update_fields=["proof_photo", "photo_similarity", "updated_at"])
    storage.delete_image(old)
    return claim


def _new_code():
    length = max(4, settings.HANDOVER_CODE_LENGTH)
    return "".join(secrets.choice("0123456789") for _ in range(length))


@transaction.atomic
def verify_claim(user, claim, note):
    assert_reviewer(user, claim)
    if claim.status == Claim.PENDING and claim.item.claims.filter(status=Claim.VERIFIED).exists():
        raise ApiError(409, "already_approved", "Another claim on this item is already approved.")
    claim.handover_code = _new_code()
    claim.decided_by = user
    claim.decision_note = note.strip()
    transition(claim, Claim.VERIFIED, user, note)  # raises 409 unless PENDING
    claim.save(update_fields=["handover_code", "decided_by", "decision_note", "updated_at"])
    for other in claim.item.claims.filter(status=Claim.PENDING).exclude(id=claim.id):
        other.decision_note = "Another claim on this item was approved."
        other.save(update_fields=["decision_note", "updated_at"])
        transition(other, Claim.REJECTED, user, other.decision_note)
    return claim


@transaction.atomic
def reject_claim(user, claim, note):
    assert_reviewer(user, claim)
    if claim.status == Claim.VERIFIED and not user.profile.is_admin:
        raise ApiError(403, "forbidden", "Only the admin desk can cancel an approved claim.")
    claim.decided_by = user
    claim.decision_note = note.strip()
    transition(claim, Claim.REJECTED, user, note)
    claim.save(update_fields=["decided_by", "decision_note", "updated_at"])
    Profile.objects.filter(user_id=claim.claimant_id).update(rejected_claims=F("rejected_claims") + 1)
    profile = Profile.objects.get(user_id=claim.claimant_id)
    if profile.rejected_claims >= 2 and not profile.is_flagged:
        profile.is_flagged = True
        profile.save(update_fields=["is_flagged"])
    item = claim.item
    still_active = item.claims.filter(status__in=[Claim.PENDING, Claim.VERIFIED]).exists()
    if item.status == Item.CLAIM_PENDING and not still_active:
        transition(item, Item.OPEN, user, "Claim rejected, open for the real owner")
    return claim


def complete_handover(user, claim, code):
    """Check the code (counting wrong attempts, which must survive the error) and then complete the return."""
    assert_reviewer(user, claim)
    if claim.status != Claim.VERIFIED:
        raise ApiError(409, "not_verified", "Only an approved claim can be handed over.")
    limit = settings.HANDOVER_MAX_ATTEMPTS
    if claim.handover_attempts >= limit:
        raise ApiError(429, "locked", "Too many wrong codes. The admin desk must cancel and re-approve this claim.")
    if not secrets.compare_digest(str(code), str(claim.handover_code or "")):
        Claim.objects.filter(id=claim.id).update(handover_attempts=F("handover_attempts") + 1)
        claim.refresh_from_db(fields=["handover_attempts"])
        left = limit - claim.handover_attempts
        if left <= 0:
            raise ApiError(429, "locked", "Too many wrong codes. The admin desk must cancel and re-approve this claim.")
        raise ApiError(400, "wrong_code", f"That code doesn't match. {left} {'try' if left == 1 else 'tries'} left.")
    return _finish_handover(user, claim)


@transaction.atomic
def _finish_handover(user, claim):
    item = claim.item
    transition(claim, Claim.HANDED_OVER, user, "Handed over at the desk")
    transition(item, Item.RETURNED, user, f"Returned to {claim.claimant.profile.first_name}")
    Profile.objects.filter(user_id=item.reporter_id).update(karma=F("karma") + settings.FINDER_KARMA_POINTS)
    # The owner's own lost report for this item is finished too.
    lost_ids = Match.objects.filter(found=item, lost__reporter_id=claim.claimant_id).values_list("lost_id", flat=True)
    for lost in Item.objects.filter(id__in=list(lost_ids)):
        if can_transition(lost, Item.RETURNED):
            transition(lost, Item.RETURNED, user, "Collected from the finder", notify=False)
    return claim
