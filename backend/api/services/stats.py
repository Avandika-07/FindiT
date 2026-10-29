"""Numbers for the home page, the admin desk, hotspots and the leaderboard."""
from collections import Counter, defaultdict
from datetime import datetime, time, timedelta

from django.db.models import Count, Q
from django.utils import timezone

from ..models import Claim, Item, Location, User
from ..serializers import user_ref


def _avg_days_to_return(qs):
    durations = [
        (item.returned_at - item.created_at).total_seconds() / 86400
        for item in qs.only("created_at", "returned_at")
        if item.returned_at
    ]
    return round(sum(durations) / len(durations), 1) if durations else None


def _returned_found():
    return Item.objects.filter(type=Item.FOUND, status=Item.RETURNED)


def _local_midnight(day):
    """Start of a local calendar day as an aware datetime (works on SQLite and MongoDB)."""
    return timezone.make_aware(datetime.combine(day, time.min))


def public_stats():
    month_start = _local_midnight(timezone.localdate().replace(day=1))
    returned = _returned_found()
    return {
        "returned_this_month": returned.filter(returned_at__gte=month_start).count(),
        "avg_days_to_return": _avg_days_to_return(returned),
        "open_found": Item.objects.filter(type=Item.FOUND, status__in=[Item.OPEN, Item.MATCHED, Item.CLAIM_PENDING]).count(),
        "total_returned": returned.count(),
    }


def admin_stats():
    now = timezone.now()
    today = timezone.localdate()
    open_states = [Item.OPEN, Item.MATCHED, Item.CLAIM_PENDING]
    returned = _returned_found()

    by_category = defaultdict(lambda: {"lost": 0, "found": 0})
    for row in Item.objects.values("category", "type").annotate(n=Count("id")):
        by_category[row["category"]][row["type"].lower()] += row["n"]

    start = today - timedelta(days=13)
    daily = {start + timedelta(days=i): {"lost": 0, "found": 0, "returned": 0} for i in range(14)}
    since = _local_midnight(start)
    for item in Item.objects.filter(created_at__gte=since).only("type", "created_at"):
        day = timezone.localtime(item.created_at).date()
        if day in daily:
            daily[day][item.type.lower()] += 1
    for item in returned.filter(returned_at__gte=since).only("returned_at"):
        day = timezone.localtime(item.returned_at).date()
        if day in daily:
            daily[day]["returned"] += 1

    return {
        "open_lost": Item.objects.filter(type=Item.LOST, status__in=open_states).count(),
        "open_found": Item.objects.filter(type=Item.FOUND, status__in=open_states).count(),
        "pending_claims": Claim.objects.filter(status=Claim.PENDING).count(),
        "verified_claims": Claim.objects.filter(status=Claim.VERIFIED).count(),
        "returned_this_week": returned.filter(returned_at__gte=now - timedelta(days=7)).count(),
        "returned_this_month": returned.filter(returned_at__gte=now - timedelta(days=30)).count(),
        "avg_days_to_return": _avg_days_to_return(returned),
        "by_category": sorted(
            ({"category": c, **v} for c, v in by_category.items()),
            key=lambda r: -(r["lost"] + r["found"]),
        ),
        "last_14_days": [{"date": d.isoformat(), **v} for d, v in sorted(daily.items())],
    }


def hotspots():
    counts = Location.objects.annotate(
        lost_count=Count("items", filter=Q(items__type=Item.LOST)),
        found_count=Count("items", filter=Q(items__type=Item.FOUND)),
    )
    zones = defaultdict(list)
    rows = []
    for loc in counts:
        row = {"id": loc.id, "name": loc.name, "zone": loc.zone, "lost_count": loc.lost_count, "found_count": loc.found_count}
        rows.append(row)
        zones[loc.zone].append({k: row[k] for k in ("id", "name", "lost_count", "found_count")})
    top = sorted(rows, key=lambda r: (-r["lost_count"], -r["found_count"], r["name"]))[:8]

    # Zone x weekday of the event date (Monday first) for the heat map.
    zone_of = {r["id"]: r["zone"] for r in rows}
    weekly = {z: {"lost": [0] * 7, "found": [0] * 7} for z in zones}
    for kind, day, loc_id in Item.objects.values_list("type", "event_date", "location_id"):
        if loc_id in zone_of:
            weekly[zone_of[loc_id]][kind.lower()][day.weekday()] += 1

    return {
        "zones": [{"zone": z, "locations": sorted(locs, key=lambda r: r["name"])} for z, locs in sorted(zones.items())],
        "top": top,
        "by_weekday": [{"zone": z, **v} for z, v in sorted(weekly.items())],
    }


def leaderboard(viewer=None, limit=20):
    returns = Counter(
        _returned_found().values_list("reporter_id", flat=True)
    )
    users = list(
        User.objects.select_related("profile")
        .filter(profile__role="STUDENT", is_active=True)
        .order_by("-profile__karma", "id")
    )
    users = [u for u in users if u.profile.karma > 0 or returns.get(u.id)]
    entries, me = [], None
    for rank, user in enumerate(users, start=1):
        row = {"rank": rank, "user": user_ref(user), "karma": user.profile.karma, "returns": returns.get(user.id, 0)}
        if rank <= limit:
            entries.append(row)
        if viewer is not None and user.id == viewer.id:
            me = {"rank": rank, "karma": row["karma"], "returns": row["returns"]}
    if viewer is not None and me is None and hasattr(viewer, "profile"):
        me = {"rank": None, "karma": viewer.profile.karma, "returns": returns.get(viewer.id, 0)}
    return {"entries": entries, "me": me}
