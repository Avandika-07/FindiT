"""
Views for every operation in openapi.yaml. Each one is thin: the @operation decorator
checks auth and validates input against the spec, a service applies the rules, and a
handwritten serializer shapes the response.
"""
from datetime import date

from .http import ApiError, json_response, operation, uploaded_file
from .models import Claim, Location
from .serializers import Viewer, claim_to_dict, item_to_dict, location_to_dict, match_to_dict
from .services import claims as claim_svc
from .services import items as item_svc
from .services import matching
from .services import search as search_svc


@operation("getHealth")
def get_health(request, user, params, body):
    return json_response({"status": "ok"})


@operation("listLocations")
def list_locations(request, user, params, body):
    graph = matching.campus_graph()
    return json_response([location_to_dict(loc, graph.get(loc.id, set())) for loc in Location.objects.all()])


# ---- items ----------------------------------------------------------------------------

@operation("listItems")
def list_items(request, user, params, body):
    items, total, page, size = item_svc.list_items(params)
    viewer = Viewer(user)
    return json_response(
        {"items": [item_to_dict(i, viewer) for i in items], "total": total, "page": page, "page_size": size}
    )


@operation("createItem")
def create_item(request, user, params, body):
    item = item_svc.create_item(user, body)
    return json_response(item_to_dict(item, Viewer(user)), status=201)


@operation("getItem")
def get_item(request, user, params, body):
    return json_response(item_to_dict(item_svc.get_item(params["itemId"]), Viewer(user)))


@operation("updateItem")
def update_item(request, user, params, body):
    item = item_svc.update_item(user, item_svc.get_item(params["itemId"]), body)
    return json_response(item_to_dict(item, Viewer(user)))


@operation("deleteItem")
def delete_item(request, user, params, body):
    item_svc.delete_item(user, item_svc.get_item(params["itemId"]))
    return json_response(None, status=204)


@operation("uploadItemPhoto")
def upload_item_photo(request, user, params, body):
    item = item_svc.get_item(params["itemId"])
    item = item_svc.set_item_photo(user, item, uploaded_file(request, "photo"))
    return json_response(item_to_dict(item, Viewer(user)))


@operation("listItemMatches")
def list_item_matches(request, user, params, body):
    item = item_svc.get_item(params["itemId"])
    viewer = Viewer(user)
    return json_response([match_to_dict(m, other, viewer) for m, other in matching.matches_with_items(item)])


# ---- search ---------------------------------------------------------------------------

def _date(value):
    return date.fromisoformat(value) if value else None


@operation("searchItems")
def search_items(request, user, params, body):
    outcome = search_svc.search(
        params["q"],
        type=params.get("type"),
        category=params.get("category"),
        status=params.get("status"),
        location_id=params.get("location_id"),
        date_from=_date(params.get("date_from")),
        date_to=_date(params.get("date_to")),
    )
    hits = outcome.hits[: params.get("limit") or 20]
    by_id = {item.id: item for item in item_svc.items_by_ids([h.doc_id for h in hits])}
    viewer = Viewer(user)
    results = [
        {
            "item": item_to_dict(by_id[h.doc_id], viewer),
            "score": h.score,
            "reasons": [
                {"query_term": r.query_term, "matched_term": r.matched_term, "method": r.method} for r in h.reasons
            ],
        }
        for h in hits
        if h.doc_id in by_id
    ]
    return json_response(
        {
            "query": params["q"],
            "corrected_query": outcome.corrected_query,
            "total": len(outcome.hits),
            "results": results,
        }
    )


# ---- claims ---------------------------------------------------------------------------

@operation("listItemClaims")
def list_item_claims(request, user, params, body):
    item = item_svc.get_item(params["itemId"])
    if item.reporter_id != user.id and not user.profile.is_admin:
        raise ApiError(403, "forbidden", "Only the person who reported this item can see its claims.")
    viewer = Viewer(user)
    claims = Claim.objects.select_related("item__location", "item__reporter__profile", "claimant__profile").filter(item=item)
    return json_response([claim_to_dict(c, viewer) for c in claims])


@operation("createClaim")
def create_claim(request, user, params, body):
    claim = claim_svc.create_claim(user, item_svc.get_item(params["itemId"]), body)
    return json_response(claim_to_dict(claim_svc.get_claim(claim.id), Viewer(user)), status=201)


@operation("getClaim")
def get_claim(request, user, params, body):
    claim = claim_svc.get_claim(params["claimId"])
    claim_svc.assert_can_view(user, claim)
    return json_response(claim_to_dict(claim, Viewer(user)))


@operation("verifyClaim")
def verify_claim(request, user, params, body):
    claim = claim_svc.verify_claim(user, claim_svc.get_claim(params["claimId"]), body["note"])
    return json_response(claim_to_dict(claim_svc.get_claim(claim.id), Viewer(user)))


@operation("rejectClaim")
def reject_claim(request, user, params, body):
    claim = claim_svc.reject_claim(user, claim_svc.get_claim(params["claimId"]), body["note"])
    return json_response(claim_to_dict(claim_svc.get_claim(claim.id), Viewer(user)))


@operation("completeHandover")
def complete_handover(request, user, params, body):
    claim = claim_svc.complete_handover(user, claim_svc.get_claim(params["claimId"]), body["code"])
    return json_response(claim_to_dict(claim_svc.get_claim(claim.id), Viewer(user)))
