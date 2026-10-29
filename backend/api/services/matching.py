"""
Runs the handwritten matcher (api/core/matcher.py) against the database: every new or
edited item is scored against open items of the opposite type, matches at or above
MATCH_THRESHOLD are saved, and the lost item's owner is told.
"""
from django.conf import settings
from django.db.models import Q

from ..core.campus import hop_distance
from ..core.matcher import MatchInput, duplicate_score, score_pair
from ..models import Item, Location, LocationLink, Match
from . import ai, search
from .notifications import notify
from .status import can_transition, transition

MATCHABLE = [Item.OPEN, Item.MATCHED]
DUPLICATE_SCORE = 80


def campus_graph():
    graph = {loc_id: set() for loc_id in Location.objects.values_list("id", flat=True)}
    for a, b in LocationLink.objects.values_list("from_location_id", "to_location_id"):
        graph.setdefault(a, set()).add(b)
        graph.setdefault(b, set()).add(a)
    return graph


def as_input(item):
    return MatchInput(
        category=item.category,
        title=item.title,
        description=item.description or "",
        color=item.color,
        brand=item.brand,
        location_id=item.location_id,
        event_date=item.event_date,
    )


def run_matching(item, graph=None, notify_owner=True):
    """Score `item` against every matchable item of the opposite type. Returns new Match rows."""
    if item.status not in MATCHABLE:
        return []
    graph = graph if graph is not None else campus_graph()
    other_type = Item.FOUND if item.type == Item.LOST else Item.LOST
    candidates = (
        Item.objects.select_related("location", "reporter")
        .filter(type=other_type, status__in=MATCHABLE)
        .exclude(reporter_id=item.reporter_id)
    )
    created = []
    for other in candidates:
        lost, found = (item, other) if item.type == Item.LOST else (other, item)
        hops = hop_distance(graph, lost.location_id, found.location_id, max_depth=3)
        result = score_pair(as_input(lost), as_input(found), hops, search.idf)
        existing = Match.objects.filter(lost=lost, found=found).first()
        if result is None or result.score < settings.MATCH_THRESHOLD:
            if existing:
                existing.delete()
            continue
        if existing:
            changed = (existing.score, existing.breakdown, existing.reasons) != (result.score, result.breakdown, result.reasons)
            if changed:
                existing.score, existing.breakdown, existing.reasons = result.score, result.breakdown, result.reasons
                existing.save(update_fields=["score", "breakdown", "reasons"])
                ai.invalidate(existing)  # the reports changed, so the AI's old opinion is stale
            continue
        match = Match.objects.create(lost=lost, found=found, score=result.score, breakdown=result.breakdown, reasons=result.reasons)
        created.append(match)
        for side in (lost, found):
            if side.status == Item.OPEN and can_transition(side, Item.MATCHED):
                transition(side, Item.MATCHED, None, f"Possible match with “{(found if side is lost else lost).title}”", notify=False)
        if notify_owner:
            notify(
                lost.reporter,
                "MATCH",
                f"Possible match for your {lost.title}",
                f"Someone found “{found.title}” at {found.location.name}. It is a {result.score}% match.",
                f"/items/{lost.id}",
            )
            notify(
                found.reporter,
                "MATCH",
                f"The {found.title} you found may have an owner",
                f"“{lost.title}” was reported lost at {lost.location.name}. It is a {result.score}% match. "
                "The owner can now send a claim.",
                f"/items/{found.id}",
            )
    settle(item)
    ai.request_reviews(item)  # background second opinion on the strongest candidates
    return created


def settle(item):
    """An item whose matches all disappeared (e.g. after an edit) goes back to Open."""
    if item.status == Item.MATCHED and not matches_for(item).exists():
        transition(item, Item.OPEN, None, "No close matches any more", notify=False)


def matches_for(item):
    return Match.objects.filter(Q(lost=item) | Q(found=item))


def matches_with_items(item):
    """[(match, other_item)] strongest first, hiding closed counterparts."""
    rows = matches_for(item).select_related(
        "lost__location", "lost__reporter__profile", "found__location", "found__reporter__profile"
    ).order_by("-score", "-id")
    out = []
    for match in rows:
        other = match.found if match.lost_id == item.id else match.lost
        if other.status != Item.CLOSED:
            out.append((match, other))
    return out


def find_duplicates(user, data, graph=None):
    """The user's own open reports of the same type that look like the same thing (score ≥ 80)."""
    from datetime import date

    graph = graph if graph is not None else campus_graph()
    probe = MatchInput(
        category=data.get("category") or "",
        title=data.get("title") or "",
        description=data.get("description") or "",
        color=data.get("color"),
        brand=data.get("brand"),
        location_id=data.get("location_id") or 0,
        event_date=data.get("event_date") or date.today(),
    )
    out = []
    mine = Item.objects.select_related("location", "reporter__profile").filter(
        reporter=user, type=data.get("type"), status__in=MATCHABLE
    )
    for item in mine:
        hops = hop_distance(graph, probe.location_id, item.location_id, max_depth=3) if probe.location_id else None
        score = duplicate_score(probe, as_input(item), hops)
        if score >= DUPLICATE_SCORE:
            out.append((item, score))
    return sorted(out, key=lambda pair: -pair[1])
