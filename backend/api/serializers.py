"""
Handwritten serializers. Each function turns a model into exactly the dict the contract
describes, and decides what this particular viewer is allowed to see (clear photos,
evidence scores, handover codes). The secret answer is never serialized anywhere.
"""
from datetime import timezone as dt_timezone

from .models import Claim, Item
from .storage import image_url


def iso(dt):
    """Datetime → ISO 8601 in UTC with a trailing Z."""
    if dt is None:
        return None
    return dt.astimezone(dt_timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def media_url(ref):
    """Browser URL for a stored photo (served from /media/)."""
    return image_url(ref)


class Viewer:
    """Who is looking. Caches which found items this user has a verified claim on."""

    def __init__(self, user):
        self.user = user
        self._verified_items = None

    @property
    def is_admin(self):
        return bool(self.user and self.user.profile.is_admin)

    def verified_item_ids(self):
        if self._verified_items is None:
            if self.user is None:
                self._verified_items = set()
            else:
                self._verified_items = set(
                    Claim.objects.filter(
                        claimant=self.user, status__in=[Claim.VERIFIED, Claim.HANDED_OVER]
                    ).values_list("item_id", flat=True)
                )
        return self._verified_items

    def owns(self, item):
        return bool(self.user and item.reporter_id == self.user.id)

    def can_see_clear_photo(self, item):
        if item.type == Item.LOST:
            return True
        return self.is_admin or self.owns(item) or item.id in self.verified_item_ids()

    def reviews(self, claim):
        """Admins and the finder (reporter of the found item) review claims."""
        return self.is_admin or self.owns(claim.item)


def as_viewer(user_or_viewer):
    return user_or_viewer if isinstance(user_or_viewer, Viewer) else Viewer(user_or_viewer)


def location_ref(location):
    return {"id": location.id, "name": location.name, "zone": location.zone}


def location_to_dict(location, neighbor_ids):
    return {**location_ref(location), "neighbor_ids": sorted(neighbor_ids)}


def user_ref(user):
    if user is None:
        return None
    profile = getattr(user, "profile", None)
    name = profile.first_name if profile else (user.first_name or "Someone")
    return {"id": user.id, "display_name": name}


def item_to_dict(item, viewer):
    viewer = as_viewer(viewer)
    photo_url, blurred = None, False
    if item.photo:
        if viewer.can_see_clear_photo(item):
            photo_url = media_url(item.photo)
        else:
            photo_url, blurred = media_url(item.photo_blurred or item.photo), bool(item.photo_blurred)
    return {
        "id": item.id,
        "type": item.type,
        "title": item.title,
        "description": item.description or "",
        "category": item.category,
        "color": item.color or None,
        "brand": item.brand or None,
        "location": location_ref(item.location),
        "event_date": item.event_date.isoformat(),
        "photo_url": photo_url,
        "photo_blurred": blurred,
        "secret_question": item.secret_question if item.type == Item.FOUND else None,
        "status": item.status,
        "reporter": user_ref(item.reporter),
        "created_at": iso(item.created_at),
        "updated_at": iso(item.updated_at),
    }


def claim_to_dict(claim, viewer):
    viewer = as_viewer(viewer)
    reviewer = viewer.reviews(claim)
    is_claimant = bool(viewer.user and claim.claimant_id == viewer.user.id)
    show_code = is_claimant and claim.status == Claim.VERIFIED
    return {
        "id": claim.id,
        "item": item_to_dict(claim.item, viewer),
        "claimant": user_ref(claim.claimant),
        "proof_text": claim.proof_text,
        "proof_photo_url": media_url(claim.proof_photo) if (reviewer or is_claimant) else None,
        "answer_score": claim.answer_score if reviewer else None,
        "photo_similarity": claim.photo_similarity if reviewer else None,
        "status": claim.status,
        "decision_note": claim.decision_note or None,
        "handover_code": claim.handover_code if show_code else None,
        "created_at": iso(claim.created_at),
        "updated_at": iso(claim.updated_at),
    }


def match_to_dict(match, other_item, viewer):
    breakdown = {k: int(match.breakdown.get(k, 0)) for k in ("category", "text", "color", "brand", "location", "time")}
    return {
        "id": match.id,
        "score": int(match.score),
        "breakdown": breakdown,
        "reasons": list(match.reasons or []),
        "item": item_to_dict(other_item, viewer),
        "created_at": iso(match.created_at),
    }


def ai_review_to_dict(review):
    """The AI's second opinion on a match (None when no review was requested)."""
    if review is None:
        return None
    done = review.status == "DONE"
    return {
        "match_id": review.match_id,
        "status": review.status,
        "match": review.is_match if done else None,
        "score": review.score if done else None,
        "confidence": review.confidence if done else None,
        "reason": review.reason if done else None,
        "matching_features": list(review.matching_features or []) if done else [],
        "conflicting_features": list(review.conflicting_features or []) if done else [],
        "model": review.model_name or None,
        "error": review.error or None if review.status == "FAILED" else None,
        "seconds": round(review.duration_ms / 1000, 1) if review.duration_ms else None,
        "updated_at": iso(review.updated_at),
    }


def me_to_dict(user):
    profile = user.profile
    return {
        "id": user.id,
        "roll_no": profile.roll_no,
        "email": user.email or "",
        "display_name": profile.first_name,
        "full_name": profile.display_name,
        "role": profile.role,
        "karma": profile.karma,
        "rejected_claims": profile.rejected_claims,
        "is_flagged": profile.is_flagged,
        "returns_count": Item.objects.filter(reporter=user, type=Item.FOUND, status=Item.RETURNED).count(),
    }


def history_to_dict(entry):
    return {
        "id": entry.id,
        "from_status": entry.from_status,
        "to_status": entry.to_status,
        "note": entry.note or "",
        "actor": user_ref(entry.actor) if entry.actor_id else None,
        "at": iso(entry.at),
    }


def notification_to_dict(n):
    return {
        "id": n.id,
        "kind": n.kind,
        "title": n.title,
        "body": n.body,
        "link": n.link,
        "is_read": n.is_read,
        "created_at": iso(n.created_at),
    }
