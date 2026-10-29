"""
Glue between the database and the handwritten search engine in api/core.

The engine keeps a single in-memory index (INDEX). It is built lazily from the database
on first use and kept up to date on every item create, update and delete.
"""
import math
import threading

from ..core.search_index import IndexedDoc, SearchFilters, SearchIndex
from ..models import Item

_lock = threading.RLock()
_index = None


def doc_for(item):
    body = " ".join(
        part for part in (item.description, item.brand, item.category, item.color, item.location.name) if part
    )
    return IndexedDoc(
        doc_id=item.id,
        title=item.title,
        body=body,
        type=item.type,
        category=item.category,
        status=item.status,
        location_id=item.location_id,
        event_date=item.event_date,
        created_at=item.created_at,
    )


def get_index():
    global _index
    if _index is None:
        with _lock:
            if _index is None:
                fresh = SearchIndex()
                for item in Item.objects.select_related("location").iterator():
                    fresh.add(doc_for(item))
                _index = fresh
    return _index


def rebuild():
    global _index
    with _lock:
        _index = None
    return get_index()


def index_item(item):
    if _index is None:  # will be built from the database on first use
        return
    with _lock:
        _index.add(doc_for(item))


def unindex_item(item_id):
    if _index is None:
        return
    with _lock:
        _index.remove(item_id)


def idf(token):
    """Inverse document frequency from the live index, used to weight words in matching."""
    index = get_index()
    n, df = index.n_docs, index.doc_freq(token)
    return math.log((n - df + 0.5) / (df + 0.5) + 1) if n else 1.0


def search(q, *, type=None, category=None, status=None, location_id=None, date_from=None, date_to=None):
    filters = SearchFilters(
        type=type,
        category=category,
        statuses={status} if status else None,
        location_id=location_id,
        date_from=date_from,
        date_to=date_to,
    )
    with _lock:
        return get_index().search(q, filters)


def suggest(prefix, limit=8):
    with _lock:
        return get_index().suggest(prefix, limit)


def explain(q):
    with _lock:
        index = get_index()
        outcome = index.search(q)
        return outcome, index.explain(q)
