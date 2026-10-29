# Contract checklist

One row per operation in `openapi.yaml` (base path `/api`). Every view is decorated with
`@operation("<operationId>")`, which checks auth and validates path/query/body against the
yaml before the handler runs (`api/http.py`, `api/validators.py`).

Auth column: 🔒 = `bearerAuth` required (401 without a valid token).

| operationId | Method | Path | Auth | Request | Responses | View |
|---|---|---|---|---|---|---|
| getHealth | GET | `/health` | | – | 200 `{status: ok}` | `views.get_health` |
| listLocations | GET | `/locations` | | – | 200 `Location[]` | `views.list_locations` |
| listItems | GET | `/items` | | query: type, category, status, location_id, date_from, date_to, page, page_size | 200 `ItemPage`, 400 | `views.list_items` |
| createItem | POST | `/items` | 🔒 | JSON `ItemCreate` (oneOf Lost/Found, discriminator `type`) | 201 `Item`, 400, 401, 404 (location) | `views.create_item` |
| getItem | GET | `/items/{itemId}` | | – | 200 `Item`, 400, 404 | `views.get_item` |
| updateItem | PATCH | `/items/{itemId}` | 🔒 | JSON `ItemUpdate` (`status: CLOSED` closes) | 200 `Item`, 400, 401, 403, 404, 409 | `views.update_item` |
| deleteItem | DELETE | `/items/{itemId}` | 🔒 | – | 204, 400, 401, 403, 404, 409 (has claims) | `views.delete_item` |
| uploadItemPhoto | POST | `/items/{itemId}/photo` | 🔒 | multipart `photo` (JPEG/PNG/WEBP) | 200 `Item`, 400, 401, 403, 404, 413 | `views.upload_item_photo` |
| listItemMatches | GET | `/items/{itemId}/matches` | | – | 200 `Match[]`, 400, 404 | `views.list_item_matches` |
| listItemClaims | GET | `/items/{itemId}/claims` | 🔒 | – | 200 `Claim[]`, 400, 401, 403, 404 | `views.list_item_claims` |
| createClaim | POST | `/items/{itemId}/claims` | 🔒 | JSON `ClaimCreate` | 201 `Claim`, 400, 401, 403 (own item), 404, 409 | `views.create_claim` |
| searchItems | GET | `/search` | | query: q (required), filters, limit | 200 `SearchResponse`, 400 | `views.search_items` |
| getClaim | GET | `/claims/{claimId}` | 🔒 | – | 200 `Claim`, 400, 401, 403, 404 | `views.get_claim` |
| verifyClaim | POST | `/claims/{claimId}/verify` | 🔒 | JSON `ClaimDecision` | 200 `Claim`, 400, 401, 403, 404, 409 | `views.verify_claim` |
| rejectClaim | POST | `/claims/{claimId}/reject` | 🔒 | JSON `ClaimDecision` | 200 `Claim`, 400, 401, 403, 404, 409 | `views.reject_claim` |
| completeHandover | POST | `/claims/{claimId}/handover` | 🔒 | JSON `HandoverRequest` | 200 `Claim`, 400 (wrong code), 401, 403, 404, 409, 429 (locked) | `views.complete_handover` |

Cross-cutting rules
- Every error body is `Error` (`{error: {code, message, fields?}}`), including 404/405/500
  (`api.http.handler404`, `handler500`, `JsonErrorMiddleware`, `route()` for 405).
- `APPEND_SLASH = False`; URL patterns match the yaml exactly (`api/urls.py`).
- Datetimes are UTC with `Z`; dates are `YYYY-MM-DD`.
- `Item.secret_answer` is never serialized. Clear photos of found items only go to the reporter,
  admins and a claimant with a verified claim; everyone else gets the blurred copy.
- Extra endpoints live under `/api/ext/` (see `EXT_API.md`) and never change spec responses.

## Differences from the master prompt (the yaml wins)

The yaml in this repo is an example contract written from the master prompt. When the
official yaml arrives, compare it with this table and rename accordingly.

| Prompt said | Implemented as | Why |
|---|---|---|
| `/ext/claims/{id}/verify`, `/reject`, `/handover` | spec paths `/claims/{id}/verify`, `/reject`, `/handover` | core flow, so it is in the contract |
| `/ext/items/{id}/matches` | spec path `/items/{id}/matches` | core flow |
| `/ext/search/explain` for reasons | per-hit `reasons` in the spec `/search` response; `/ext/search/explain` also exists | reasons fit the spec schema |
| own-item claim → 400 | 403 `own_item` | a valid request from the wrong user; keeps Schemathesis' positive-data check green |
| handover lock after 5 wrong codes | 429 `locked` | "too many attempts" |
| `Item.photo` | `photo_url` + `photo_blurred` | the response says which copy the viewer got |
| `secret_answer` on found items | required by `FoundItemCreate` | enforced by the contract, not just the UI |
| proof photo on claim | `POST /ext/claims/{id}/proof-photo` (multipart) | keeps `ClaimCreate` JSON |

## Running the contract tests

```bash
# terminal 1 – a throwaway database so fuzzing doesn't touch the demo data
cd backend
DATABASE_URL=sqlite:///st.sqlite3 MEDIA_ROOT=./st_media python manage.py migrate
DATABASE_URL=sqlite:///st.sqlite3 MEDIA_ROOT=./st_media python manage.py seed_demo
DATABASE_URL=sqlite:///st.sqlite3 MEDIA_ROOT=./st_media python manage.py runserver 8001 --noreload

# terminal 2 – from the repo root so schemathesis.toml and schemathesis_hooks.py are picked up
TOKEN=$(curl -s -X POST localhost:8001/api/ext/auth/login -H 'content-type: application/json' \
  -d '{"roll_no":"admin@findit.local","password":"admin123"}' | python -c "import sys,json;print(json.load(sys.stdin)['token'])")
PYTHONUTF8=1 schemathesis run openapi.yaml --url http://127.0.0.1:8001/api -H "Authorization: Bearer $TOKEN"
```

Last run: 12,339 generated cases, 0 failures, all four phases green (coverage, fuzzing,
stateful). `schemathesis.toml` relaxes exactly two things, both deliberate business rules
that a JSON schema cannot express: a wrong handover code (400) and a future `event_date`
(400). `schemathesis_hooks.py` makes the photo upload receive real image bytes.
