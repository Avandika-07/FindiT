# FindiT extension endpoints (`/api/ext/...`)

These endpoints are **not** part of `openapi.yaml`. They power the UI. All live under
`<base path>/ext/` so they never collide with the contract. Every error uses the same
shape as the spec: `{"error": {"code": "...", "message": "...", "fields": {...}?}}`.

Auth: `Authorization: Bearer <token>`. "auth" below means a token is required (401 otherwise),
"admin" means the user must have role `ADMIN` (403 otherwise).

Shared shapes (same as the spec): `Item`, `Claim`, `Match`, `LocationRef`, `UserRef`.

```ts
type Me = {
  id: number; roll_no: string; email: string; display_name: string; full_name: string;
  role: "STUDENT" | "ADMIN"; karma: number; rejected_claims: number; is_flagged: boolean;
  returns_count: number;            // items this user found that were returned
}
type Notification = {
  id: number; kind: "MATCH" | "CLAIM_NEW" | "CLAIM_VERIFIED" | "CLAIM_REJECTED" | "RETURNED" | "SYSTEM";
  title: string; body: string; link: string | null; is_read: boolean; created_at: string;
}
type TimelineEntry = {
  id: number; from_status: string | null; to_status: string; note: string;
  actor: UserRef | null; at: string;   // ISO datetime, UTC with Z
}
```

## Auth
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/ext/auth/login` | `{ "roll_no": string, "password": string }` (roll_no may also be the admin e-mail) | `200 { token, expires_at, user: Me }`; `400` invalid credentials |
| POST | `/ext/auth/logout` | auth | `204` |
| GET | `/ext/auth/me` | auth | `200 Me` |
| GET | `/ext/auth/demo-users` | only when DEBUG, else 404 | `200 [{ roll_no, password, display_name, role, label }]` (label: "Student", "Finder", "Admin") |

## Meta
`GET /ext/meta` →
```json
{
  "app_name": "FindiT",
  "categories": [{ "name": "Phone", "icon": "smartphone" }],
  "colors": [{ "name": "Blue", "hex": "#2F5BEA" }],
  "zones": [{ "zone": "Academic", "locations": [LocationRef] }],
  "max_upload_mb": 5,
  "handover_code_length": 6,
  "item_expiry_days": 30,
  "debug": true,
  "ai_enabled": true,
  "ai_model": "qwen2.5:3b"
}
```
Category icon names are lucide-react icon names in kebab-case. `categories` lists the built-ins,
then kinds of items students added while reporting (icon `tag`, A to Z), with `Other` last.
`POST /items` accepts any category name of 2 to 30 characters: a new one is added to this list
(case-insensitive, so "power bank" reuses "Power bank").

## AI match recommendation
A local Ollama model gives a second opinion on the strongest candidate matches (top
`AI_REVIEWS_PER_ITEM`, default 3, per new item). It runs in the background, about 1–3 s per
comparison with qwen2.5:3b, and never changes the handwritten `Match.score`.

```ts
type AIReview = {
  match_id: number;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED";
  match: boolean | null;              // score >= 60 (DONE only)
  score: number | null;               // 0..100 (DONE only)
  confidence: "high" | "medium" | "low" | null;   // >=85 / 60-84 / <60
  reason: string | null;
  matching_features: string[];
  conflicting_features: string[];
  model: string | null; error: string | null; seconds: number | null; updated_at: string;
}
```

| Method | Path | Notes | Response |
|---|---|---|---|
| GET | `/ext/items/{id}/ai-reviews` | public | `200 { enabled, model, reviews: AIReview[] }` (one per match that has a review) |
| POST | `/ext/matches/{id}/ai-review` | auth (reporter of either item, or admin) | `202 AIReview` queued again; `409 ai_off` when AI is disabled |
| GET | `/ext/ai/status` | public | `200 { enabled, provider, model, reachable, model_installed, queue: { pending, running, done, failed } }` |

The admin queue entry also carries `ai_review: AIReview | null` for the pair "claimant's own
lost report ↔ this found item", when such a match exists.

## Items (extras)
| Method | Path | Notes | Response |
|---|---|---|---|
| GET | `/ext/items/{id}/timeline` | public | `200 TimelineEntry[]` oldest first (first entry is the "reported" entry, from_status null) |
| POST | `/ext/items/check-duplicates` | auth; body same as spec `ItemCreate` but nothing required except `type`, `title`, `category` | `200 { duplicates: [{ item: Item, score: number }] }` (same type, same reporter, score ≥ 80) |
| POST | `/ext/items/{id}/rematch` | auth (owner/admin) | `200 Match[]` |
| GET | `/ext/me/items` | auth | `200 Item[]` newest first |
| GET | `/ext/me/claims` | auth | `200 Claim[]` newest first (the claimant sees `handover_code` when VERIFIED) |

## Claims (extras)
| Method | Path | Notes | Response |
|---|---|---|---|
| POST | `/ext/claims/{id}/proof-photo` | auth, claimant only, multipart field `photo` | `200 Claim` (photo_similarity computed) |
| GET | `/ext/claims/{id}/timeline` | auth (claimant, finder, admin) | `200 TimelineEntry[]` |

Verify / reject / handover are spec endpoints: `POST /claims/{id}/verify|reject|handover`.
Allowed for admins and for the finder (reporter of the found item). A wrong handover code is
`400 wrong_code` (message says how many tries are left); after 5 wrong codes it is `429 locked`.

## Search (extras)
| Method | Path | Response |
|---|---|---|
| GET | `/ext/search/suggest?prefix=ear&limit=8` | `200 { suggestions: string[] }` |
| GET | `/ext/search/explain?q=...` | `200 { query, corrected_query, tokens: [{ token, step: "exact"\|"synonym"\|"prefix"\|"sounds_like"\|"typo"\|"none", matched_terms: string[], weight: number }] }` |

## Notifications
| Method | Path | Response |
|---|---|---|
| GET | `/ext/notifications` | auth → `200 { unread: number, items: Notification[] }` (latest 50) |
| POST | `/ext/notifications/read-all` | auth → `204` |
| POST | `/ext/notifications/{id}/read` | auth → `204` |

## Public stats and leaderboard
| Method | Path | Response |
|---|---|---|
| GET | `/ext/stats` | `200 { returned_this_month: number, avg_days_to_return: number \| null, open_found: number, total_returned: number }` |
| GET | `/ext/leaderboard` | `200 { entries: [{ rank, user: UserRef, karma, returns }], me: { rank: number \| null, karma, returns } \| null }` (top 20; `rank` is null until the user earns karma) |

## Admin (admin only)
| Method | Path | Response |
|---|---|---|
| GET | `/ext/admin/queue` | `200 QueueEntry[]` pending claims, oldest first |
| GET | `/ext/admin/verified` | `200 QueueEntry[]` verified claims waiting for handover |
| GET | `/ext/admin/stats` | `200 AdminStats` |
| GET | `/ext/admin/hotspots` | `200 { zones: [{ zone, locations: [{ id, name, lost_count, found_count }] }], top: [{ id, name, zone, lost_count, found_count }], by_weekday: [{ zone, lost: number[7], found: number[7] }] }` (top 8 by lost_count; by_weekday counts reports by the weekday of `event_date`, Monday first) |
| GET | `/ext/admin/flagged` | `200 Me[]` users with is_flagged |
| GET | `/ext/admin/expired` | `200 Item[]` |

```ts
type QueueEntry = {
  claim: Claim;                     // reviewer view: answer_score and photo_similarity visible
  secret_question: string | null;
  claimant: Me;                     // includes rejected_claims, is_flagged
  guidance: "STRONG" | "WEAK" | "CHECK_CAREFULLY";
  guidance_reasons: string[];       // plain English, e.g. "Secret answer is a 92% match"
  ai_review: AIReview | null;       // AI opinion on claimant's lost report vs this item
}
type AdminStats = {
  open_lost: number; open_found: number; pending_claims: number; verified_claims: number;
  returned_this_week: number; returned_this_month: number; avg_days_to_return: number | null;
  by_category: { category: string; lost: number; found: number }[];
  last_14_days: { date: string; lost: number; found: number; returned: number }[];
}
```

Guidance rule: STRONG when answer_score ≥ 80 and claimant not flagged; WEAK when answer_score < 50;
otherwise CHECK_CAREFULLY. A flagged claimant is never STRONG.
