"""FindiT's handwritten search engine.

An in-memory inverted index scored with BM25, plus a forgiving per-word
pipeline that tries, in order: exact word -> synonym -> prefix -> sounds-like
-> typo. A "did you mean" pass fixes queries that find nothing.
"""

import math
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional

from . import binsearch
from .distance import damerau_levenshtein, typo_allowance
from .text import (
    COLOR_GROUPS,
    color_group,
    color_of_word,
    sound_key,
    stem,
    synonyms_of,
    tokenize_with_surface,
)
from .trie import Trie
from .trigram import TrigramIndex

# BM25 tuning constants (standard values)
K1 = 1.5
B = 0.75

# Weight of each pipeline step: exact matches count most, typos least.
STEP_WEIGHTS = {
    "exact": 1.0,
    "synonym": 0.9,
    "prefix": 0.8,
    "sounds_like": 0.7,
    "typo": 0.6,
}
MAX_PREFIX_EXPANSIONS = 10


@dataclass
class IndexedDoc:
    """One lost/found item as the search engine sees it."""

    doc_id: int
    title: str
    body: str            # description + brand + category + color + location name
    type: str            # "LOST" | "FOUND"
    category: str
    status: str
    location_id: int
    event_date: date
    created_at: datetime  # only used for the "recent items" boost


@dataclass
class SearchFilters:
    """Optional filters; a None field means "don't filter on this"."""

    type: Optional[str] = None
    category: Optional[str] = None
    statuses: Optional[set] = None
    location_id: Optional[int] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None


@dataclass
class Reason:
    """Why a result matched: which query word matched which indexed word, and how."""

    query_term: str
    matched_term: str
    method: str  # "exact" | "synonym" | "prefix" | "sounds_like" | "typo"


@dataclass
class SearchHit:
    """One search result with its score and reasons."""

    doc_id: int
    score: float
    reasons: list = field(default_factory=list)


@dataclass
class SearchOutcome:
    """Everything search() returns: hits sorted best first, plus any spelling fix."""

    query: str
    corrected_query: Optional[str]
    hits: list


@dataclass
class TokenExplanation:
    """How one query word was understood (for the "how search works" demo)."""

    token: str
    step: str
    matched_terms: list
    weight: float


def _to_date(value):
    """Turn a datetime/date into a date (None stays None). Time: O(1)."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    return value


class SearchIndex:
    """In-memory search index over lost/found items."""

    def __init__(self):
        """Create an empty index. Time: O(1)."""
        self.clear()

    # ------------------------------------------------------------------ build

    def clear(self) -> None:
        """Forget every document. Time: O(1) (old structures are dropped)."""
        self._docs = {}            # doc_id -> IndexedDoc
        self._doc_tf = {}          # doc_id -> Counter(token -> tf)
        self._doc_surface = {}     # doc_id -> Counter((token, word) -> count)
        self._doc_len = {}         # doc_id -> weighted length
        self._total_len = 0
        self._postings = {}        # token -> {doc_id: tf}
        self._trie = Trie()        # tokens, frequency = document frequency
        self._trigrams = TrigramIndex()
        self._sound = {}           # sound_key -> set(tokens)
        self._freq = Counter()     # token -> document frequency
        self._surface = {}         # token -> Counter(original word -> count)
        self._dates = []           # sorted [(event_date, doc_id)]

    def add(self, doc: IndexedDoc) -> None:
        """Add or replace a document in every index structure.

        Title words count double (tf += 2), body words once. The colour family
        (e.g. "blue" for "Navy") is added as an extra body word.
        Time: O(T * L + log n) for T tokens of length L, plus O(n) for the
        sorted-date list insert.
        """
        if doc.doc_id in self._docs:
            self.remove(doc.doc_id)

        tf = Counter()
        surface = Counter()
        for tok, word in tokenize_with_surface(doc.title):
            tf[tok] += 2
            surface[(tok, word)] += 1
        for tok, word in tokenize_with_surface(doc.body):
            tf[tok] += 1
            surface[(tok, word)] += 1
        group = color_group((doc.title or "") + " " + (doc.body or ""))
        if group:
            tf[group] += 1
            surface[(group, group)] += 1

        self._docs[doc.doc_id] = doc
        self._doc_tf[doc.doc_id] = tf
        self._doc_surface[doc.doc_id] = surface
        length = sum(tf.values())
        self._doc_len[doc.doc_id] = length
        self._total_len += length

        for tok, count in tf.items():
            plist = self._postings.get(tok)
            if plist is None:
                plist = {}
                self._postings[tok] = plist
                self._trigrams.add(tok)
                self._sound.setdefault(sound_key(tok), set()).add(tok)
            plist[doc.doc_id] = count
            self._trie.insert(tok)
            self._freq[tok] += 1
        for (tok, word), count in surface.items():
            self._surface.setdefault(tok, Counter())[word] += count

        key = (doc.event_date, doc.doc_id)
        self._dates.insert(binsearch.lower_bound(self._dates, key), key)

    def remove(self, doc_id: int) -> None:
        """Delete a document from every structure (no-op if unknown).

        Time: O(T * L) for its tokens plus O(n) for the date list.
        """
        doc = self._docs.pop(doc_id, None)
        if doc is None:
            return
        tf = self._doc_tf.pop(doc_id)
        surface = self._doc_surface.pop(doc_id)
        self._total_len -= self._doc_len.pop(doc_id)

        for tok in tf:
            plist = self._postings.get(tok)
            if plist is not None:
                plist.pop(doc_id, None)
            self._trie.remove(tok)
            self._freq[tok] -= 1
            if self._freq[tok] <= 0:
                del self._freq[tok]
            if not plist:
                self._postings.pop(tok, None)
                self._trigrams.remove(tok)
                key = sound_key(tok)
                bucket = self._sound.get(key)
                if bucket is not None:
                    bucket.discard(tok)
                    if not bucket:
                        del self._sound[key]
        for (tok, word), count in surface.items():
            words = self._surface.get(tok)
            if words is None:
                continue
            words[word] -= count
            if words[word] <= 0:
                del words[word]
            if not words:
                del self._surface[tok]

        key = (doc.event_date, doc_id)
        i = binsearch.lower_bound(self._dates, key)
        if i < len(self._dates) and self._dates[i] == key:
            self._dates.pop(i)

    # ---------------------------------------------------------------- queries

    @property
    def n_docs(self) -> int:
        """Number of indexed documents. Time: O(1)."""
        return len(self._docs)

    def __contains__(self, doc_id) -> bool:
        """True if the document id is indexed. Time: O(1)."""
        return doc_id in self._docs

    def doc_freq(self, token: str) -> int:
        """How many documents contain the token (raw words are stemmed first).

        Time: O(L).
        """
        if not token:
            return 0
        t = token.lower()
        if t in self._postings:
            return len(self._postings[t])
        return len(self._postings.get(stem(t), ()))

    def _display(self, token: str) -> str:
        """Most common original spelling of a stemmed token ("earphone" -> "earphones").

        Time: O(S) for S spellings of the token (tiny).
        """
        words = self._surface.get(token)
        if not words:
            return token
        return sorted(words.items(), key=lambda p: (-p[1], p[0]))[0][0]

    def _idf(self, token: str) -> float:
        """BM25 inverse document frequency: rare words matter more. Time: O(1)."""
        n = len(self._docs)
        df = len(self._postings.get(token, ()))
        return math.log((n - df + 0.5) / (df + 0.5) + 1)

    def _bm25(self, token: str, doc_id: int, idf: float) -> float:
        """BM25 score of one token in one document. Time: O(1)."""
        tf = self._postings[token].get(doc_id, 0)
        if tf == 0:
            return 0.0
        avg = self._total_len / len(self._docs) if self._docs else 1.0
        if avg <= 0:
            avg = 1.0
        norm = 1 - B + B * self._doc_len[doc_id] / avg
        return idf * tf * (K1 + 1) / (tf + K1 * norm)

    def _expand(self, token: str):
        """Run the pipeline for one query token; stop at the first step with matches.

        Returns (step, [indexed tokens]) or ("none", []).
        Time: exact/synonym O(1); prefix O(P + K log K); sounds-like O(1);
        typo O(C * L^2) for C trigram candidates.
        """
        # a) exact
        if token in self._postings:
            return "exact", [token]

        # b) synonyms (and other colours in the same colour family)
        related = set(synonyms_of(token))
        group = color_of_word(token)
        if group:
            related |= COLOR_GROUPS[group]
        related.discard(token)
        found = sorted(t for t in related if t in self._postings)
        if found:
            return "synonym", found

        # c) prefix (autocomplete-style)
        if len(token) >= 3:
            found = [t for t in self._trie.starts_with(token, MAX_PREFIX_EXPANSIONS + 1)
                     if t != token][:MAX_PREFIX_EXPANSIONS]
            if found:
                return "prefix", found

        # d) sounds alike
        if len(token) >= 3:
            found = sorted(t for t in self._sound.get(sound_key(token), ()) if t != token)
            if found:
                return "sounds_like", found

        # e) typo (trigram candidates checked with Damerau-Levenshtein)
        allowance = typo_allowance(token)
        if allowance > 0:
            found = [
                cand for cand, _ in self._trigrams.candidates(token, min_jaccard=0.2)
                if cand != token and damerau_levenshtein(token, cand) <= allowance
            ]
            if found:
                return "typo", found

        return "none", []

    @staticmethod
    def _query_tokens(query: str):
        """Tokenize the query, dropping repeated tokens but keeping the original words.

        Time: O(n) in the query length.
        """
        seen = set()
        out = []
        for tok, word in tokenize_with_surface(query):
            if tok not in seen:
                seen.add(tok)
                out.append((tok, word))
        return out

    def _passes(self, doc: IndexedDoc, filters, date_ok) -> bool:
        """Check a document against the non-date filters and the date allow-set. Time: O(1)."""
        if filters is None:
            return True
        if filters.type and (doc.type or "").upper() != filters.type.upper():
            return False
        if filters.category and (doc.category or "").lower() != filters.category.lower():
            return False
        if filters.statuses is not None and doc.status not in filters.statuses:
            return False
        if filters.location_id is not None and doc.location_id != filters.location_id:
            return False
        if date_ok is not None and doc.doc_id not in date_ok:
            return False
        return True

    def _date_allowed(self, filters):
        """Doc ids inside the date range, found by binary search on the sorted
        (event_date, doc_id) list; None when there is no date filter.

        Time: O(log n + k) for k docs in range.
        """
        if filters is None or (filters.date_from is None and filters.date_to is None):
            return None
        lo = _to_date(filters.date_from) or date.min
        hi = _to_date(filters.date_to) or date.max
        if lo > hi:
            return set()
        return {doc_id for _, doc_id in
                binsearch.range_slice(self._dates, (lo,), (hi, float("inf")))}

    def _run(self, qtokens, filters, today) -> list:
        """Score every candidate document for already-tokenized query words.

        Time: O(Q * M * D) for Q query tokens, M matched terms each and D
        documents in their postings, plus O(H log H) to sort H hits.
        """
        if not qtokens or not self._docs:
            return []
        # doc_id -> {query token: (score, Reason)}
        best = {}
        for tok, word in qtokens:
            step, terms = self._expand(tok)
            if not terms:
                continue
            weight = STEP_WEIGHTS[step]
            for term in terms:
                idf = self._idf(term)
                for doc_id in self._postings[term]:
                    s = self._bm25(term, doc_id, idf) * weight
                    per_doc = best.setdefault(doc_id, {})
                    cur = per_doc.get(tok)
                    if cur is None or s > cur[0]:
                        per_doc[tok] = (s, Reason(word, self._display(term), step))

        date_ok = self._date_allowed(filters)
        hits = []
        for doc_id, per_tok in best.items():
            doc = self._docs[doc_id]
            if not self._passes(doc, filters, date_ok):
                continue
            score = sum(s for s, _ in per_tok.values())
            created = _to_date(doc.created_at) or today
            age_days = max(0, (today - created).days)
            score *= 1 + 0.1 * max(0.0, 1 - age_days / 30)
            if doc.status == "OPEN":
                score *= 1.05
            reasons = [per_tok[t][1] for t, _ in qtokens if t in per_tok]
            hits.append(SearchHit(doc_id, round(score, 4), reasons))
        hits.sort(key=lambda h: (-h.score, h.doc_id))
        return hits

    def _correct(self, qtokens):
        """Build a "did you mean" token list, or None if nothing could be fixed.

        Each token not in the index exactly is replaced by the trigram candidate
        with the smallest edit distance (<= max(2, typo allowance)), ties going
        to the more frequent word.
        Time: O(Q * C * L^2).
        """
        changed = False
        fixed = []
        for tok, word in qtokens:
            if tok in self._postings:
                fixed.append((tok, word))
                continue
            limit = max(2, typo_allowance(tok))
            choice = None
            for cand, _ in self._trigrams.candidates(tok, min_jaccard=0.2):
                d = damerau_levenshtein(tok, cand)
                if d > limit:
                    continue
                key = (d, -self._freq[cand], cand)
                if choice is None or key < choice[0]:
                    choice = (key, cand)
            if choice is None:
                fixed.append((tok, word))
            else:
                changed = True
                cand = choice[1]
                fixed.append((cand, self._display(cand)))
        return fixed if changed else None

    def search(self, query: str, filters: SearchFilters = None, today: date = None) -> SearchOutcome:
        """Find documents for a free-text query, best first.

        Each query word runs the pipeline exact -> synonym -> prefix ->
        sounds-like -> typo. A doc's score is the sum over query words of the
        best BM25 x step-weight among its matched terms, then boosted for
        recent items (up to +10% in the first 30 days) and OPEN items (+5%).
        If nothing matches, a spelling-corrected query is tried.
        Time: see _run(); roughly O(Q * M * D + H log H).
        """
        today = _to_date(today) or date.today()
        qtokens = self._query_tokens(query or "")
        hits = self._run(qtokens, filters, today)
        if hits or not qtokens:
            return SearchOutcome(query, None, hits)

        fixed = self._correct(qtokens)
        if fixed is None:
            return SearchOutcome(query, None, [])
        hits = self._run(fixed, filters, today)
        if not hits:
            return SearchOutcome(query, None, [])
        corrected = " ".join(word for _, word in fixed)
        return SearchOutcome(query, corrected, hits)

    def suggest(self, prefix: str, limit: int = 8) -> list:
        """Autocomplete: indexed words starting with the last typed word, most
        frequent first, shown in their common spelling.

        Time: O(P + K log K) for K words under the prefix.
        """
        words = tokenize_with_surface(prefix or "")
        raw = (prefix or "").strip().lower()
        if not raw or limit <= 0:
            return []
        last = raw.split()[-1]
        last = "".join(ch for ch in last if ch.isalnum())
        if not last:
            return []
        found = self._trie.starts_with(last, limit)
        if not found and words:
            found = self._trie.starts_with(words[-1][0], limit)
        out = []
        for tok in found:
            disp = self._display(tok)
            if disp not in out:
                out.append(disp)
        return out[:limit]

    def explain(self, query: str) -> list:
        """Show how each query word was understood: which step matched and what.

        Time: same as the pipeline, O(Q * pipeline cost).
        """
        out = []
        for tok, word in self._query_tokens(query or ""):
            step, terms = self._expand(tok)
            out.append(TokenExplanation(
                token=word,
                step=step,
                matched_terms=[self._display(t) for t in terms],
                weight=STEP_WEIGHTS.get(step, 0.0),
            ))
        return out
