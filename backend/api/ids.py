"""
Integer ids that work on both SQLite and MongoDB.

MongoDB has no auto-increment, and the API contract promises integer ids, so every model
gets its id from a named counter. On MongoDB the counter is a single atomic
find_one_and_update($inc). On SQL databases it is an UPDATE ... SET seq = seq + 1 inside a
transaction, which the database serialises.
"""
from django.db import IntegrityError, connection, transaction
from django.db.models import F, Max


def _start_value(model):
    """First id for a counter: one past the largest id already stored (0 for an empty table)."""
    return (model._base_manager.aggregate(top=Max("id"))["top"] or 0) + 1


def next_id(model):
    from .models import Counter

    key = model._meta.db_table
    if connection.vendor == "mongodb":
        from pymongo import ReturnDocument

        counters = connection.database[Counter._meta.db_table]
        doc = counters.find_one_and_update(
            {"_id": key}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
        )
        if doc["seq"] == 1:  # brand-new counter: skip past any rows created before it existed
            start = _start_value(model)
            if start > 1:
                doc = counters.find_one_and_update(
                    {"_id": key}, {"$max": {"seq": start}}, return_document=ReturnDocument.AFTER
                )
        return doc["seq"]

    for _ in range(3):
        try:
            with transaction.atomic():
                if Counter.objects.filter(name=key).update(seq=F("seq") + 1):
                    return Counter.objects.get(name=key).seq
                return Counter.objects.create(name=key, seq=_start_value(model)).seq
        except IntegrityError:  # another request created the counter first; try again
            continue
    raise RuntimeError(f"Could not allocate an id for {key}")
