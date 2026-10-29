"""
AI match recommendation.

The handwritten matcher (api/core/matcher.py) finds candidate matches instantly. For the
strongest candidates, a local language model (Ollama) then reads both reports and gives
a second opinion using the system prompt in api/ai_prompt.py. Local models take tens of
seconds per comparison, so reviews run one at a time in a background thread and the UI
shows them when they are ready. The model's verdict never changes the matcher's score.

Safety rails around the model:
- the reports only contain facts the students entered (plus the campus distance we
  computed), never the found item's secret answer;
- the reply must parse against OUTPUT_SCHEMA, and `match` / `confidence` are recomputed
  from the score using the prompt's own rules, so the stored verdict is always consistent.
"""
import json
import logging
import re
import threading
import time
import urllib.error
import urllib.request

from django.conf import settings
from django.db import close_old_connections, transaction

from ..ai_prompt import OUTPUT_SCHEMA, SYSTEM_PROMPT
from ..models import AIReview

log = logging.getLogger("api")


class AIUnavailable(Exception):
    """The model server could not be reached or gave an unusable answer."""


# ---- building the input ------------------------------------------------------------

def _report(item):
    """Only what the reporter actually entered. Empty fields are left out, never guessed."""
    report = {
        "product": item.title,
        "category": item.category,
        "description": item.description or None,
        "color": item.color,
        "brand": item.brand,
        "location": f"{item.location.name} ({item.location.zone} area)",
        "date": item.event_date.isoformat(),
        "has_photo": bool(item.photo),
    }
    return {k: v for k, v in report.items() if v not in (None, "")}


def _location_relation(hops):
    if hops is None:
        return "the two places are far apart or not connected on the campus map"
    if hops == 0:
        return "same place"
    return f"{hops} place{'s' if hops != 1 else ''} apart on the campus map"


def _compare(a, b, same, missing="not stated in one or both reports"):
    if not a or not b:
        return missing
    return "same" if same(a, b) else "different"


def _fact_checks(lost, found):
    """
    Plain comparisons worked out by our own code, so a small model doesn't misread the
    reports (e.g. claiming two boAt items have "different brands"). Facts, never guesses.
    """
    from ..core.distance import damerau_levenshtein
    from ..core.text import color_group

    return {
        "category": _compare(lost.category, found.category, lambda a, b: a.lower() == b.lower()),
        "brand": _compare(
            lost.brand, found.brand, lambda a, b: damerau_levenshtein(a.lower().strip(), b.lower().strip()) <= 1
        ),
        "color_family": _compare(
            color_group(lost.color or ""), color_group(found.color or ""), lambda a, b: a == b,
            missing="not stated or not a known colour in one or both reports",
        ),
    }


def build_payload(lost, found, hops):
    days = abs((found.event_date - lost.event_date).days)
    return {
        "lost_report": _report(lost),
        "found_report": _report(found),
        "context": {
            "location_relation": _location_relation(hops),
            "days_between_lost_and_found": days,
            "found_before_lost": found.event_date < lost.event_date,
            "fact_checks": _fact_checks(lost, found),
        },
    }


# ---- calling the model --------------------------------------------------------------

def _post(path, body, timeout):
    req = urllib.request.Request(
        f"{settings.AI_BASE_URL}{path}", json.dumps(body).encode(), {"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return json.loads(res.read())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:200]
        raise AIUnavailable(f"model server answered {exc.code}: {detail}")
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise AIUnavailable(f"model server not reachable at {settings.AI_BASE_URL} ({exc})")
    except ValueError:
        raise AIUnavailable("model server sent something that is not JSON")


def _extract_json(text):
    """The reply should be pure JSON; tolerate a stray <think> block or text around it."""
    text = re.sub(r"<think>.*?</think>", "", text or "", flags=re.S).strip()
    try:
        return json.loads(text)
    except ValueError:
        found = re.search(r"\{.*\}", text, flags=re.S)
        if not found:
            raise AIUnavailable("the model did not return JSON")
        try:
            return json.loads(found.group(0))
        except ValueError:
            raise AIUnavailable("the model returned malformed JSON")


def _clean_list(value):
    if not isinstance(value, list):
        return []
    return [str(v).strip()[:160] for v in value if str(v).strip()][:8]


def normalize(raw):
    """Clamp the score and derive match/confidence from it exactly as the prompt defines."""
    try:
        score = int(round(float(raw.get("score"))))
    except (TypeError, ValueError):
        raise AIUnavailable("the model's reply had no usable score")
    score = max(0, min(100, score))
    return {
        "score": score,
        "is_match": score >= 60,
        "confidence": "high" if score >= 85 else "medium" if score >= 60 else "low",
        "reason": str(raw.get("reason") or "").strip()[:600],
        "matching_features": _clean_list(raw.get("matching_features")),
        "conflicting_features": _clean_list(raw.get("conflicting_features")),
    }


def ask_model(payload):
    """One comparison. Returns the normalised verdict or raises AIUnavailable."""
    body = {
        "model": settings.AI_MODEL,
        "stream": False,
        "format": OUTPUT_SCHEMA,
        "options": {"temperature": 0},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ],
    }
    reply = _post("/api/chat", body, settings.AI_TIMEOUT_SECONDS)
    content = (reply.get("message") or {}).get("content", "")
    return normalize(_extract_json(content))


def status():
    """Is the model server up and is the configured model installed?"""
    info = {"enabled": settings.AI_ENABLED, "provider": settings.AI_PROVIDER, "model": settings.AI_MODEL,
            "reachable": False, "model_installed": False}
    if not settings.AI_ENABLED:
        return info
    try:
        req = urllib.request.Request(f"{settings.AI_BASE_URL}/api/tags")
        with urllib.request.urlopen(req, timeout=3) as res:
            tags = json.loads(res.read())
        info["reachable"] = True
        names = {m.get("name") for m in tags.get("models", [])} | {m.get("model") for m in tags.get("models", [])}
        info["model_installed"] = settings.AI_MODEL in names or f"{settings.AI_MODEL}:latest" in names
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        pass
    return info


# ---- queueing ---------------------------------------------------------------------------

def request_reviews(item):
    """After matching: queue AI reviews for this item's strongest matches (no-op when AI is off)."""
    if not settings.AI_ENABLED:
        return []
    from .matching import matches_for

    top = matches_for(item).order_by("-score", "-id")[: max(0, settings.AI_REVIEWS_PER_ITEM)]
    queued = []
    for match in top:
        review, created = AIReview.objects.get_or_create(match=match)
        if created:
            queued.append(review)
        elif review.status == AIReview.FAILED:  # e.g. Ollama was off last time
            reset(review)
            queued.append(review)
    if queued:
        transaction.on_commit(wake_worker)
    return queued


def reset(review):
    """Ask for a fresh opinion (after an edit, a failure, or a manual re-run)."""
    AIReview.objects.filter(id=review.id).update(
        status=AIReview.PENDING, is_match=None, score=None, confidence="", reason="",
        matching_features=[], conflicting_features=[], error="", attempts=0, duration_ms=None,
    )
    transaction.on_commit(wake_worker)


def invalidate(match):
    """The handwritten score changed (the item was edited): the old opinion is stale."""
    review = AIReview.objects.filter(match=match).first()
    if review and review.status != AIReview.PENDING:
        reset(review)


def run_review(review_id):
    """Claim one pending review, ask the model, store the verdict. Returns the review."""
    from ..core.campus import hop_distance
    from .matching import campus_graph

    # Atomic claim: only one worker can move it from PENDING to RUNNING.
    if not AIReview.objects.filter(id=review_id, status=AIReview.PENDING).update(status=AIReview.RUNNING):
        return AIReview.objects.filter(id=review_id).first()
    review = AIReview.objects.select_related("match__lost__location", "match__found__location").get(id=review_id)
    match = review.match
    hops = hop_distance(campus_graph(), match.lost.location_id, match.found.location_id, max_depth=3)
    started = time.monotonic()
    try:
        verdict = ask_model(build_payload(match.lost, match.found, hops))
    except AIUnavailable as exc:
        review.attempts += 1
        review.status = AIReview.FAILED
        review.error = str(exc)[:300]
        review.duration_ms = int((time.monotonic() - started) * 1000)
        review.save(update_fields=["attempts", "status", "error", "duration_ms", "updated_at"])
        log.warning("AI review %s failed: %s", review.id, exc)
        return review
    for field, value in verdict.items():
        setattr(review, field, value)
    review.status = AIReview.DONE
    review.attempts += 1
    review.model_name = settings.AI_MODEL
    review.error = ""
    review.duration_ms = int((time.monotonic() - started) * 1000)
    review.save()
    log.info("AI review %s: %s/100 in %.1fs", review.id, review.score, review.duration_ms / 1000)
    return review


def process_pending(limit=None):
    """Run pending reviews one after another (used by the worker and `manage.py ai_reviews`)."""
    done = 0
    while limit is None or done < limit:
        next_id = AIReview.objects.filter(status=AIReview.PENDING).order_by("created_at", "id").values_list("id", flat=True).first()
        if next_id is None:
            break
        run_review(next_id)
        done += 1
    return done


# ---- background worker ----------------------------------------------------------------

_wake = threading.Event()
_worker = None
_worker_lock = threading.Lock()


def wake_worker():
    if settings.AI_ENABLED and _worker is not None:
        _wake.set()


def _loop():
    # Reviews left RUNNING by a server that stopped mid-review go back in the queue.
    time.sleep(2)
    try:
        AIReview.objects.filter(status=AIReview.RUNNING).update(status=AIReview.PENDING)
    except Exception:
        log.exception("AI worker could not reset running reviews")
    while True:
        try:
            process_pending()
        except Exception:
            log.exception("AI worker error")
        finally:
            close_old_connections()
        _wake.wait(timeout=15)
        _wake.clear()


def start_worker():
    """Start the single background reviewer thread (once per server process)."""
    global _worker
    if not settings.AI_ENABLED:
        return
    with _worker_lock:
        if _worker is None or not _worker.is_alive():
            _worker = threading.Thread(target=_loop, name="findit-ai-reviews", daemon=True)
            _worker.start()
            log.info("AI reviews: using %s at %s", settings.AI_MODEL, settings.AI_BASE_URL)
