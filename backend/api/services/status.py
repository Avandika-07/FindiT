"""
The one place where statuses change.

`transition()` checks the allowed-transitions table, refuses illegal moves with a 409,
writes a StatusHistory row (which powers the courier-style timeline) and sends the
notifications that belong to that change.
"""
from django.utils import timezone

from ..http import ApiError
from ..models import Claim, Item, StatusHistory

I, C = Item, Claim

ITEM_TRANSITIONS = {
    I.OPEN: {I.MATCHED, I.CLAIM_PENDING, I.EXPIRED, I.CLOSED, I.RETURNED},
    I.MATCHED: {I.OPEN, I.CLAIM_PENDING, I.CLOSED, I.RETURNED},
    I.CLAIM_PENDING: {I.OPEN, I.RETURNED},
    I.RETURNED: set(),
    I.EXPIRED: set(),
    I.CLOSED: set(),
}

CLAIM_TRANSITIONS = {
    C.PENDING: {C.VERIFIED, C.REJECTED},
    C.VERIFIED: {C.HANDED_OVER, C.REJECTED},  # admin may cancel a locked or abandoned handover
    C.REJECTED: set(),
    C.HANDED_OVER: set(),
}

ITEM_LABELS = {
    I.OPEN: "Open",
    I.MATCHED: "Matched",
    I.CLAIM_PENDING: "Claim pending",
    I.RETURNED: "Returned",
    I.EXPIRED: "Expired",
    I.CLOSED: "Closed",
}
CLAIM_LABELS = {C.PENDING: "Under review", C.VERIFIED: "Approved", C.REJECTED: "Rejected", C.HANDED_OVER: "Collected"}


def _entity(obj):
    if isinstance(obj, Item):
        return StatusHistory.ITEM, ITEM_TRANSITIONS, ITEM_LABELS
    if isinstance(obj, Claim):
        return StatusHistory.CLAIM, CLAIM_TRANSITIONS, CLAIM_LABELS
    raise TypeError(f"Cannot transition {type(obj).__name__}")


def can_transition(obj, to_status):
    _, table, _ = _entity(obj)
    return to_status in table.get(obj.status, set())


def transition(obj, to_status, actor=None, note="", notify=True):
    """Move an Item or Claim to `to_status`, or raise ApiError(409) if that move is not allowed."""
    entity_type, table, labels = _entity(obj)
    from_status = obj.status
    if to_status not in table.get(from_status, set()):
        raise ApiError(
            409,
            "invalid_transition",
            f"This can't go from {labels.get(from_status, from_status).lower()} to {labels.get(to_status, to_status).lower()}.",
        )
    obj.status = to_status
    fields = ["status", "updated_at"]
    if isinstance(obj, Item) and to_status == I.RETURNED:
        obj.returned_at = timezone.now()
        fields.append("returned_at")
    obj.save(update_fields=fields)
    StatusHistory.objects.create(
        entity_type=entity_type,
        entity_id=obj.id,
        from_status=from_status,
        to_status=to_status,
        actor=actor,
        note=(note or "")[:300],
    )
    if isinstance(obj, Item):
        from . import search

        search.index_item(obj)  # status filters and the open-item boost read the index
    if notify:
        from . import notifications

        notifications.on_transition(obj, from_status, to_status, actor, note)
    return obj


def record_created(obj, actor, note):
    """First timeline entry for a new item or claim."""
    entity_type, _, _ = _entity(obj)
    StatusHistory.objects.create(
        entity_type=entity_type, entity_id=obj.id, from_status=None, to_status=obj.status, actor=actor, note=note
    )
