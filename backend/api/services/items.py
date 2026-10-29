"""Item rules: reporting, editing, closing, deleting, photos and browsing."""
import io
from datetime import date

from django.db import transaction

from .. import storage
from ..core.image_hash import dhash_image
from ..http import ApiError
from ..models import Item, Location
from ..validators import validate_photo
from . import categories, matching, search
from .status import record_created, transition

EDITABLE = [Item.OPEN, Item.MATCHED]


def get_item(item_id):
    item = Item.objects.select_related("location", "reporter__profile").filter(id=item_id).first()
    if item is None:
        raise ApiError(404, "not_found", "We couldn't find that item. It may have been deleted.")
    return item


def _location(location_id):
    location = Location.objects.filter(id=location_id).first()
    if location is None:
        raise ApiError(404, "location_not_found", "That place is not on the campus map. Pick one from the list.")
    return location


def _clean(value):
    if value is None:
        return None
    value = " ".join(str(value).split())
    return value or None


def _check_date(value):
    event_date = date.fromisoformat(value)
    if event_date > date.today():
        raise ApiError(
            400, "validation_error", "The date can't be in the future.", fields={"event_date": "Pick today or an earlier day."}
        )
    return event_date


def _assert_owner(item, user):
    if item.reporter_id != user.id and not user.profile.is_admin:
        raise ApiError(403, "forbidden", "Only the person who reported this item can change it.")


@transaction.atomic
def create_item(user, data):
    location = _location(data["location_id"])
    is_found = data["type"] == Item.FOUND
    title = _clean(data["title"])
    if not title or len(title) < 3:
        raise ApiError(400, "validation_error", "Give the item a short title.", fields={"title": "Use at least 3 characters."})
    item = Item.objects.create(
        type=data["type"],
        title=title,
        description=(data.get("description") or "").strip(),
        category=categories.resolve(data["category"], user),
        color=_clean(data.get("color")),
        brand=_clean(data.get("brand")),
        location=location,
        event_date=_check_date(data["event_date"]),
        secret_question=(_clean(data["secret_question"]) or data["secret_question"]) if is_found else None,
        secret_answer=(_clean(data["secret_answer"]) or data["secret_answer"]) if is_found else None,
        reporter=user,
    )
    record_created(item, user, "Reported lost" if item.type == Item.LOST else "Reported found")
    search.index_item(item)
    matching.run_matching(item)
    item.refresh_from_db()
    return item


@transaction.atomic
def update_item(user, item, data):
    _assert_owner(item, user)
    if data.get("status") == Item.CLOSED:
        transition(item, Item.CLOSED, user, "Closed by the reporter")
        return item
    if item.status not in EDITABLE:
        raise ApiError(409, "not_editable", "This item can't be edited any more because it has a claim or is finished.")
    for field in ("title", "brand", "color"):
        if field in data:
            setattr(item, field, _clean(data[field]))
    if item.title is None or len(item.title) < 3:
        raise ApiError(400, "validation_error", "Give the item a short title.", fields={"title": "Use at least 3 characters."})
    if "description" in data:
        item.description = (data["description"] or "").strip()
    if "location_id" in data:
        item.location = _location(data["location_id"])
    if "event_date" in data:
        item.event_date = _check_date(data["event_date"])
    item.save()
    search.index_item(item)
    matching.run_matching(item)
    item.refresh_from_db()
    return item


@transaction.atomic
def delete_item(user, item):
    _assert_owner(item, user)
    if item.claims.exists():
        raise ApiError(409, "has_claims", "This item has claims on it, so it can't be deleted. Close it instead.")
    for ref in (item.photo, item.photo_blurred):
        storage.delete_image(ref)
    # Items matched only to this one go back to Open once their match disappears.
    counterparts = [m.found if m.lost_id == item.id else m.lost for m in matching.matches_for(item).select_related("lost", "found")]
    item_id = item.id
    item.delete()
    search.unindex_item(item_id)
    for other in counterparts:
        matching.settle(other)


def set_item_photo(user, item, upload):
    _assert_owner(item, user)
    clear, blurred, _ = validate_photo(upload)
    old = (item.photo, item.photo_blurred)
    # The clear photo of a found item is private (only the finder, admins and a verified
    # claimant see it). Lost-item photos help people recognise the item, so they are public.
    item.photo = storage.save_image("items", clear, private=item.type == Item.FOUND)
    item.photo_blurred = storage.save_image("items/public", blurred, private=False)
    item.photo_hash = dhash_image(io.BytesIO(clear))
    item.save(update_fields=["photo", "photo_blurred", "photo_hash", "updated_at"])
    for ref in old:
        storage.delete_image(ref)
    return item


def list_items(params):
    qs = Item.objects.select_related("location", "reporter__profile")
    if params.get("type"):
        qs = qs.filter(type=params["type"])
    if params.get("category"):
        qs = qs.filter(category=params["category"])
    if params.get("status"):
        qs = qs.filter(status=params["status"])
    if params.get("location_id"):
        qs = qs.filter(location_id=params["location_id"])
    if params.get("date_from"):
        qs = qs.filter(event_date__gte=date.fromisoformat(params["date_from"]))
    if params.get("date_to"):
        qs = qs.filter(event_date__lte=date.fromisoformat(params["date_to"]))
    page, size = params.get("page") or 1, params.get("page_size") or 20
    total = qs.count()
    start = (page - 1) * size
    return list(qs[start : start + size]), total, page, size


def items_by_ids(ids):
    found = Item.objects.select_related("location", "reporter__profile").in_bulk(ids)
    return [found[i] for i in ids if i in found]
