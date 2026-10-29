"""
Extra endpoints that power the UI but are not part of openapi.yaml. They all live under
<base path>/ext/ so they can never collide with the contract. Shapes: backend/EXT_API.md.
"""
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .demo import demo_logins
from .http import (
    ApiError,
    json_body,
    json_response,
    require_admin,
    require_user,
    uploaded_file,
    user_from_request,
)
from .models import COLORS, AIReview, AuthToken, Claim, Item, Location, Match, Notification, StatusHistory, User
from .serializers import (
    Viewer,
    ai_review_to_dict,
    claim_to_dict,
    history_to_dict,
    item_to_dict,
    match_to_dict,
    me_to_dict,
    notification_to_dict,
)
from .services import claims as claim_svc
from .services import items as item_svc
from .services import ai, categories, matching, stats
from .services import search as search_svc
from .validators import int_param, require_str

CLAIM_RELATED = ("item__location", "item__reporter__profile", "claimant__profile")


# ---- auth ----------------------------------------------------------------------------

def login(request):
    data = json_body(request)
    if not isinstance(data, dict):
        raise ApiError(400, "invalid_json", "Send your roll number and password.")
    login_id = require_str(data, "roll_no", max_len=120)
    password = data.get("password")
    if not isinstance(password, str) or not password:
        raise ApiError(400, "validation_error", "Enter your password.", fields={"password": "Enter your password."})
    user = (
        User.objects.select_related("profile")
        .filter(Q(profile__roll_no__iexact=login_id) | Q(email__iexact=login_id), is_active=True)
        .first()
    )
    if user is None or not hasattr(user, "profile") or not user.check_password(password):
        raise ApiError(400, "invalid_credentials", "That roll number and password don't match. Check both and try again.")
    token = AuthToken.objects.create(
        key=secrets.token_hex(32),
        user=user,
        expires_at=timezone.now() + timedelta(hours=settings.AUTH_TOKEN_TTL_HOURS),
    )
    AuthToken.objects.filter(user=user, expires_at__lte=timezone.now()).delete()
    return json_response({"token": token.key, "expires_at": token.expires_at.strftime("%Y-%m-%dT%H:%M:%SZ"), "user": me_to_dict(user)})


def logout(request):
    require_user(request)
    key = request.META.get("HTTP_AUTHORIZATION", "").split()[-1]
    AuthToken.objects.filter(key=key).delete()
    return json_response(None, status=204)


def me(request):
    return json_response(me_to_dict(require_user(request)))


def demo_users(request):
    if not settings.DEBUG:
        raise ApiError(404, "not_found", "There is nothing at this address.")
    return json_response(demo_logins())


# ---- meta and public stats -------------------------------------------------------------

def meta(request):
    zones = {}
    for loc in Location.objects.all():
        zones.setdefault(loc.zone, []).append({"id": loc.id, "name": loc.name, "zone": loc.zone})
    return json_response(
        {
            "app_name": "FindiT",
            "categories": [{"name": name, "icon": icon} for name, icon in categories.all_categories()],
            "colors": [{"name": name, "hex": hex_} for name, hex_ in COLORS],
            "zones": [{"zone": zone, "locations": locs} for zone, locs in zones.items()],
            "max_upload_mb": settings.MAX_UPLOAD_MB,
            "handover_code_length": settings.HANDOVER_CODE_LENGTH,
            "item_expiry_days": settings.ITEM_EXPIRY_DAYS,
            "debug": settings.DEBUG,
            "ai_enabled": settings.AI_ENABLED,
            "ai_model": settings.AI_MODEL if settings.AI_ENABLED else None,
        }
    )


def public_stats(request):
    return json_response(stats.public_stats())


def leaderboard(request):
    return json_response(stats.leaderboard(user_from_request(request)))


# ---- items -----------------------------------------------------------------------------

def _timeline(entity_type, entity_id):
    rows = StatusHistory.objects.select_related("actor__profile").filter(entity_type=entity_type, entity_id=entity_id)
    return json_response([history_to_dict(r) for r in rows])


def item_timeline(request, item_id):
    item_svc.get_item(item_id)
    return _timeline(StatusHistory.ITEM, item_id)


def check_duplicates(request):
    user = require_user(request)
    data = json_body(request)
    if not isinstance(data, dict) or data.get("type") not in (Item.LOST, Item.FOUND):
        raise ApiError(400, "validation_error", "Say whether the item is lost or found.", fields={"type": "Choose LOST or FOUND."})
    from datetime import date

    probe = dict(data)
    try:
        probe["event_date"] = date.fromisoformat(data["event_date"]) if data.get("event_date") else None
    except (TypeError, ValueError):
        probe["event_date"] = None
    if not isinstance(probe.get("location_id"), int):
        probe["location_id"] = None
    viewer = Viewer(user)
    found = matching.find_duplicates(user, probe)
    return json_response({"duplicates": [{"item": item_to_dict(item, viewer), "score": score} for item, score in found]})


def rematch(request, item_id):
    user = require_user(request)
    item = item_svc.get_item(item_id)
    if item.reporter_id != user.id and not user.profile.is_admin:
        raise ApiError(403, "forbidden", "Only the person who reported this item can do this.")
    matching.run_matching(item)
    item.refresh_from_db()
    viewer = Viewer(user)
    return json_response([match_to_dict(m, other, viewer) for m, other in matching.matches_with_items(item)])


def item_ai_reviews(request, item_id):
    """AI second opinions for an item's matches, keyed by match id."""
    item = item_svc.get_item(item_id)
    reviews = AIReview.objects.filter(match__in=matching.matches_for(item))
    return json_response(
        {
            "enabled": settings.AI_ENABLED,
            "model": settings.AI_MODEL if settings.AI_ENABLED else None,
            "reviews": [ai_review_to_dict(r) for r in reviews],
        }
    )


def rerun_ai_review(request, match_id):
    """Ask the AI again for one match (either item's reporter or an admin)."""
    user = require_user(request)
    if not settings.AI_ENABLED:
        raise ApiError(409, "ai_off", "AI recommendations are turned off on this server.")
    match = Match.objects.select_related("lost", "found").filter(id=match_id).first()
    if match is None:
        raise ApiError(404, "not_found", "We couldn't find that match.")
    if user.id not in (match.lost.reporter_id, match.found.reporter_id) and not user.profile.is_admin:
        raise ApiError(403, "forbidden", "Only the people who reported these items can ask for a new AI review.")
    review, created = AIReview.objects.get_or_create(match=match)
    if not created and review.status != AIReview.RUNNING:
        ai.reset(review)
    else:
        transaction.on_commit(ai.wake_worker)
    review.refresh_from_db()
    return json_response(ai_review_to_dict(review), status=202)


def ai_status(request):
    info = ai.status()
    counts = {s.lower(): AIReview.objects.filter(status=s).count() for s, _ in AIReview.STATUSES}
    return json_response({**info, "queue": counts})


def my_items(request):
    user = require_user(request)
    viewer = Viewer(user)
    items = Item.objects.select_related("location", "reporter__profile").filter(reporter=user)
    return json_response([item_to_dict(i, viewer) for i in items])


def my_claims(request):
    user = require_user(request)
    viewer = Viewer(user)
    claims = Claim.objects.select_related(*CLAIM_RELATED).filter(claimant=user)
    return json_response([claim_to_dict(c, viewer) for c in claims])


# ---- claims ----------------------------------------------------------------------------

def claim_proof_photo(request, claim_id):
    user = require_user(request)
    claim = claim_svc.get_claim(claim_id)
    claim = claim_svc.set_proof_photo(user, claim, uploaded_file(request, "photo"))
    return json_response(claim_to_dict(claim_svc.get_claim(claim.id), Viewer(user)))


def claim_timeline(request, claim_id):
    user = require_user(request)
    claim = claim_svc.get_claim(claim_id)
    claim_svc.assert_can_view(user, claim)
    return _timeline(StatusHistory.CLAIM, claim_id)


# ---- search ----------------------------------------------------------------------------

def search_suggest(request):
    prefix = (request.GET.get("prefix") or "").strip()[:40]
    limit = int_param(request, "limit", 8, 1, 20)
    return json_response({"suggestions": search_svc.suggest(prefix.lower(), limit) if prefix else []})


def search_explain(request):
    q = (request.GET.get("q") or "").strip()
    if not q or len(q) > 100:
        raise ApiError(400, "validation_error", "Type 1 to 100 characters to search.", fields={"q": "Type 1 to 100 characters."})
    outcome, tokens = search_svc.explain(q)
    return json_response(
        {
            "query": q,
            "corrected_query": outcome.corrected_query,
            "tokens": [
                {"token": t.token, "step": t.step, "matched_terms": list(t.matched_terms), "weight": t.weight}
                for t in tokens
            ],
        }
    )


# ---- notifications ---------------------------------------------------------------------

def notifications(request):
    user = require_user(request)
    rows = Notification.objects.filter(user=user)[:50]
    unread = Notification.objects.filter(user=user, is_read=False).count()
    return json_response({"unread": unread, "items": [notification_to_dict(n) for n in rows]})


def notifications_read_all(request):
    user = require_user(request)
    Notification.objects.filter(user=user, is_read=False).update(is_read=True)
    return json_response(None, status=204)


def notification_read(request, notification_id):
    user = require_user(request)
    updated = Notification.objects.filter(user=user, id=notification_id).update(is_read=True)
    if not updated:
        raise ApiError(404, "not_found", "We couldn't find that notification.")
    return json_response(None, status=204)


# ---- admin -----------------------------------------------------------------------------

def _guidance(claim, profile):
    reasons = []
    score = claim.answer_score
    if score is not None:
        reasons.append(f"Secret answer is a {score}% match")
    else:
        reasons.append("This item has no secret question")
    if claim.photo_similarity is not None:
        reasons.append(f"Proof photo is {claim.photo_similarity}% similar")
    if profile.rejected_claims:
        n = profile.rejected_claims
        reasons.append(f"{n} earlier claim{'s' if n != 1 else ''} rejected")
    if profile.is_flagged:
        reasons.append("Claimant is flagged for repeated wrong claims")
    if score is not None and score >= 80 and not profile.is_flagged:
        level = "STRONG"
    elif score is not None and score < 50:
        level = "WEAK"
    else:
        level = "CHECK_CAREFULLY"
    return level, reasons


def _queue_entries(request, status, order):
    user = require_admin(request)
    viewer = Viewer(user)
    out = []
    for claim in Claim.objects.select_related(*CLAIM_RELATED).filter(status=status).order_by(order):
        level, reasons = _guidance(claim, claim.claimant.profile)
        out.append(
            {
                "claim": claim_to_dict(claim, viewer),
                "secret_question": claim.item.secret_question,
                "claimant": me_to_dict(claim.claimant),
                "guidance": level,
                "guidance_reasons": reasons,
                "ai_review": _claimant_ai_review(claim),
            }
        )
    return json_response(out)


def _claimant_ai_review(claim):
    """If the claimant reported this item as lost, the AI's opinion on that lost ↔ found pair."""
    review = (
        AIReview.objects.filter(match__found_id=claim.item_id, match__lost__reporter_id=claim.claimant_id)
        .order_by("-match__score")
        .first()
    )
    return ai_review_to_dict(review)


def admin_queue(request):
    return _queue_entries(request, Claim.PENDING, "created_at")


def admin_verified(request):
    return _queue_entries(request, Claim.VERIFIED, "updated_at")


def admin_stats(request):
    require_admin(request)
    return json_response(stats.admin_stats())


def admin_hotspots(request):
    require_admin(request)
    return json_response(stats.hotspots())


def admin_flagged(request):
    require_admin(request)
    users = User.objects.select_related("profile").filter(profile__is_flagged=True).order_by("-profile__rejected_claims")
    return json_response([me_to_dict(u) for u in users])


def admin_expired(request):
    user = require_admin(request)
    viewer = Viewer(user)
    items = Item.objects.select_related("location", "reporter__profile").filter(status=Item.EXPIRED)
    return json_response([item_to_dict(i, viewer) for i in items])
