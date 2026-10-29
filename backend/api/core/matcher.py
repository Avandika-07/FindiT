"""Lost <-> found matcher: scores how likely a found item is the lost one.

Score out of 100 = category 25 + text 30 + colour 10 + brand 10 +
location 15 + time 10. Every point comes with a plain-English reason.
"""

import math
from collections import Counter
from dataclasses import dataclass, field
from datetime import date
from typing import Callable, Optional

from .distance import damerau_levenshtein
from .text import canonical_token, color_group, tokenize_with_surface

K1 = 1.5
LOCATION_POINTS = {0: 15, 1: 10, 2: 5}


@dataclass
class MatchInput:
    """The fields of one report that the matcher looks at."""

    category: str
    title: str
    description: str
    color: Optional[str]
    brand: Optional[str]
    location_id: int
    event_date: date


@dataclass
class MatchResult:
    """Match score (0..100), the points per signal, and reasons in plain English."""

    score: int
    breakdown: dict
    reasons: list = field(default_factory=list)


def _text_vector(item: MatchInput, idf):
    """Build a weighted word vector for an item's title + description.

    Words are mapped to their synonym group's stand-in (canonical_token) so
    "earbuds" and "earphones" count as the same word. Weight =
    saturated tf (tf*(k1+1)/(tf+k1)) x idf, where idf is the highest idf of the
    original words that mapped to it.
    Returns (vector, canonical -> first surface word).
    Time: O(n) in the text length.
    """
    tf = Counter()
    originals = {}
    surface = {}
    for tok, word in tokenize_with_surface((item.title or "") + " " + (item.description or "")):
        c = canonical_token(tok)
        tf[c] += 1
        originals.setdefault(c, set()).add(tok)
        surface.setdefault(c, word)
    vec = {}
    for c, count in tf.items():
        w_idf = max(idf(t) for t in originals[c]) if idf else 1.0
        vec[c] = count * (K1 + 1) / (count + K1) * w_idf
    return vec, surface


def _cosine(a: dict, b: dict) -> float:
    """Cosine similarity of two sparse vectors (1 = same direction, 0 = nothing shared).

    Time: O(len(a) + len(b)).
    """
    if not a or not b:
        return 0.0
    dot = sum(w * b[k] for k, w in a.items() if k in b)
    na = math.sqrt(sum(w * w for w in a.values()))
    nb = math.sqrt(sum(w * w for w in b.values()))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def _score(lost: MatchInput, found: MatchInput, hops, idf, enforce_date_rule: bool):
    """Shared scorer behind score_pair() and is_duplicate().

    Time: O(n) in the combined text length.
    """
    if enforce_date_rule and (lost.event_date - found.event_date).days > 1:
        return None

    breakdown = {"category": 0, "text": 0, "color": 0, "brand": 0, "location": 0, "time": 0}
    reasons = []

    # category
    if (lost.category or "").strip().lower() == (found.category or "").strip().lower() \
            and (lost.category or "").strip():
        breakdown["category"] = 25
        reasons.append(f"Same category: {lost.category.strip()}")

    # text
    va, surf_a = _text_vector(lost, idf)
    vb, _ = _text_vector(found, idf)
    cos = _cosine(va, vb)
    breakdown["text"] = max(0, min(30, round(30 * cos)))
    if breakdown["text"] > 0:
        shared = sorted((k for k in va if k in vb), key=lambda k: (-(va[k] * vb[k]), k))
        words = [surf_a[k] for k in shared[:3]]
        reasons.append("Descriptions share words like " + ", ".join(words))

    # colour
    ga, gb = color_group(lost.color), color_group(found.color)
    if ga is not None and ga == gb:
        breakdown["color"] = 10
        reasons.append(f"Both {ga}")

    # brand
    ba, bb = (lost.brand or "").strip(), (found.brand or "").strip()
    if ba and bb and damerau_levenshtein(ba.lower(), bb.lower()) <= 1:
        breakdown["brand"] = 10
        reasons.append(f"Same brand: {ba}")

    # location
    pts = LOCATION_POINTS.get(hops, 0) if hops is not None else 0
    breakdown["location"] = pts
    if pts:
        if hops == 0:
            reasons.append("Found in the same place")
        elif hops == 1:
            reasons.append("Found 1 place away")
        else:
            reasons.append(f"Found {hops} places away")

    # time
    days = abs((found.event_date - lost.event_date).days)
    breakdown["time"] = max(0, 10 - days)
    if breakdown["time"]:
        if days == 0:
            reasons.append("Same day")
        elif days == 1:
            reasons.append("1 day apart")
        else:
            reasons.append(f"{days} days apart")

    return MatchResult(sum(breakdown.values()), breakdown, reasons)


def score_pair(lost: MatchInput, found: MatchInput, hops: Optional[int],
               idf: Optional[Callable[[str], float]] = None) -> Optional[MatchResult]:
    """Score how well a FOUND report matches a LOST report (0..100) with reasons.

    Returns None if the item was found more than 1 day BEFORE it was lost
    (impossible match). `hops` is the campus distance between the two
    locations (None = far/unknown). `idf(token)` optionally makes rare words
    count more; it receives stemmed tokens.
    Time: O(n) in the combined text length.
    """
    return _score(lost, found, hops, idf, enforce_date_rule=True)


def duplicate_score(a: MatchInput, b: MatchInput, hops: Optional[int]) -> int:
    """Similarity score (0..100) of two reports of the SAME type.

    Same signals as score_pair(), but the found-before-lost date rule is
    ignored, so this always returns a number.
    Time: O(n) in the combined text length.
    """
    return _score(a, b, hops, None, enforce_date_rule=False).score


def is_duplicate(a: MatchInput, b: MatchInput, hops: Optional[int]) -> bool:
    """True if two reports of the SAME type look like the same item (score >= 80).

    The found-before-lost date rule is ignored here.
    Time: O(n).
    """
    return duplicate_score(a, b, hops) >= 80
