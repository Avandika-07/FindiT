# FindiT

College lost and found. Students report lost and found items, FindiT matches them
automatically, owners claim found items with proof, and every item is tracked until it is
handed back. Runs fully on one laptop with no internet: data in a local MongoDB
(`mongodb://localhost:27017/`, database `findit`), photos in `backend/media/`.

- **Backend**: Django 5 (plain function views, no DRF), local MongoDB (or SQLite), handwritten search and matching in `backend/api/core/`
- **Frontend**: React 18 + Vite + TypeScript, Tailwind + Radix (shadcn-style), TanStack Query
- **Contract**: `openapi.yaml` (base path `/api`), extras under `/api/ext/` (`backend/EXT_API.md`)

## Quick start (one command)

Needs Python 3.10+ and Node 20+.

```powershell
# Windows
.\run.ps1            # API on :8000 + app on http://localhost:5173
.\run.ps1 -Single    # builds the app and serves everything from http://127.0.0.1:8000
.\run.ps1 -Single -Lan   # same, and reachable from phones/laptops on your network (prints the URL)
```

If Windows says "running scripts is disabled", use
`powershell -ExecutionPolicy Bypass -File .\run.ps1 -Single -Lan`.

```bash
# macOS / Linux
./run.sh             # API on :8000 + app on http://localhost:5173
./run.sh --single    # builds the app and serves everything from http://127.0.0.1:8000
```

The first run creates the virtual env, installs packages, migrates and seeds demo data.

## Manual setup

### Backend

```powershell
# Windows PowerShell
cd backend
python -m venv venv
.\venv\Scripts\python -m pip install -r requirements.txt
.\venv\Scripts\python manage.py migrate
.\venv\Scripts\python manage.py seed_demo
.\venv\Scripts\python manage.py runserver 127.0.0.1:8000
```

```bash
# macOS / Linux
cd backend
python3 -m venv venv
venv/bin/pip install -r requirements.txt
venv/bin/python manage.py migrate
venv/bin/python manage.py seed_demo
venv/bin/python manage.py runserver 127.0.0.1:8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173, proxies /api and /media to :8000
```

### Single-port demo build

```bash
cd frontend && npm run build      # writes frontend/dist
cd ../backend && python manage.py runserver 127.0.0.1:8000
# Django serves the app, /api and /media from http://127.0.0.1:8000
```

## Demo accounts

| Who | Log in with | Password |
|---|---|---|
| Admin desk | `admin@findit.local` | `admin123` |
| Priya (student) | `21CS001` | `student123` |
| Arjun (student) | `21EC014` | `student123` |
| Kavya (student) | `22ME033` | `student123` |
| Rahul (finder) | `21IT042` | `finder123` |

In debug mode the login page has one-tap "Log in as" buttons.
`python manage.py seed_demo --reset` wipes items, claims and photos and seeds again.

## Demo script (about 5 minutes)

1. **Search that forgives typos.** On the home page search `blu earfone libary`. The navy boAt
   earphones come first, with the reasons "earfone sounds like earphones" and "libary sounds
   like library". Also try `calci`, `walelt`, `fone`, `specs`, and `eurpods`, which shows the
   "did you mean airpods" banner.
2. **Report and match.** Log in as Kavya and report a lost "Black backpack" (Bag, Black,
   Skybags, Auditorium, Yesterday). The match reveal shows the found Skybags backpack at 95%
   with "Why this matched".
3. **Claim with proof.** Log in as Arjun and open the found "ID card with blue lanyard".
   Claim it, answering the secret question with `21EC014`.
4. **Admin review.** Log in as the admin and open **Admin desk → Claim queue**. Arjun's claim
   shows "Strong" (100% secret answer match). Sanjay's claim shows "Weak" and he is flagged.
   Approve Arjun's claim with a note.
5. **Handover.** As Arjun, go to **My stuff → My claims** to see the handover pass (6-digit
   code + QR). As admin, go to **Admin desk → Handover**, try a wrong code (the boxes shake,
   "4 tries left"), then the right one. The item is **Returned**, Rahul gets +10 karma
   (**Leaderboard**), and the item timeline shows every step.
6. **Hotspots.** **Admin desk → Hotspots** shows where things go missing, plus a zone × weekday
   heat map of when they are lost or found.

## Tests

```bash
cd backend
venv/Scripts/python -m pytest        # Windows: .\venv\Scripts\python -m pytest
```

This runs 54 tests: unit tests for every core algorithm plus API tests for the full flow,
fraud guards, photo checks and error shapes.

Contract tests with Schemathesis: see `backend/CONTRACT_CHECKLIST.md` for the exact commands.
Run Schemathesis from the repo root so `schemathesis.toml` is picked up.

Frontend checks:

```bash
cd frontend
npm run typecheck && npm run lint && npm run build
```

## Database and photo storage

**Database.** `backend/.env` has `DATABASE_URI=mongodb://localhost:27017/` and
`MONGODB_DB=findit`, so FindiT uses the `findit` database on your local MongoDB (install
MongoDB Community Server and keep its Windows service running). `python manage.py migrate`
creates the database and collections; `python manage.py seed_demo` fills in demo data.
Leave `DATABASE_URI` blank to use a SQLite file (`backend/db.sqlite3`) instead.

The same code and migrations run on both databases. Every table uses integer ids from a
counter (`api/ids.py`), so the API contract doesn't change.

**Photos** are saved in `backend/media/` (`MEDIA_ROOT`) with random file names and served
from `/media/`. The clear photo of a found item is only given to the finder, admins and a
verified claimant; everyone else gets a blurred copy.

After switching databases, run `migrate` and `seed_demo` once, then log in again: tokens
belong to the database that issued them.

Tests run on SQLite by default. To run them against local MongoDB (a throwaway
`test_findit` database is created and dropped):

```bash
FINDIT_TEST_BACKEND=mongo python -m pytest --create-db
```

## AI match recommendation

FindiT's handwritten matcher finds and scores candidate matches instantly. On top of that,
a local AI model (Ollama, default `qwen2.5:3b`) gives a second opinion on the 3 strongest
candidates for each new report, using the prompt in `backend/api/ai_prompt.py`. It runs in
the background (about 1–3 s per pair on a laptop GPU) and appears on each match card as
"AI says: Very likely the same item (90 of 100)", with what matches and what conflicts.
The AI never changes FindiT's own score, the dial or notifications.

One-time setup: install [Ollama](https://ollama.com), then `ollama pull qwen2.5:3b`. After
that it works offline. If Ollama isn't running, the app still works and the match card shows
"AI check didn't run".

```bash
python manage.py ai_reviews               # run waiting reviews now and print the verdicts
python manage.py ai_reviews --queue-all   # also review matches that never had one
```

Settings: `AI_PROVIDER=off` turns it off; `AI_MODEL` picks another Ollama model;
`AI_REVIEWS_PER_ITEM` (default 3) limits how many candidates per report are reviewed.

## Configuration

Every variable in `backend/.env` and `frontend/.env` may be left blank. See `.env.example` in
each folder. Useful ones: `MATCH_THRESHOLD` (45), `MAX_PENDING_CLAIMS` (3),
`ITEM_EXPIRY_DAYS` (30), `FINDER_KARMA_POINTS` (10), `MAX_UPLOAD_MB` (5),
`DATABASE_URL` (SQLite by default). `HANDOVER_CODE_LENGTH` defaults to 6, and the contract's
handover pattern expects 6 digits, so change both together.

Maintenance commands:

```bash
python manage.py expire_items              # found items unclaimed for ITEM_EXPIRY_DAYS → Expired
python manage.py rebuild_index --rematch   # rebuild the search index and re-run matching
```

## How the core works (for the judges)

All in `backend/api/core/`, pure Python standard library. Every function has a plain-English
docstring and a time-complexity note.

| File | Idea |
|---|---|
| `text.py` | tokenize, light stemming, campus synonyms (calci → calculator, specs → spectacles), colour families, a phonetic "sound key" (phone and fone → `fn`) |
| `distance.py` | Damerau-Levenshtein edit distance (swaps cost 1) and the secret-answer similarity % |
| `trigram.py` | trigram index to find typo candidates quickly |
| `trie.py` | prefix tree for search-as-you-type suggestions |
| `binsearch.py` | handwritten binary search for date-range filters |
| `search_index.py` | inverted index + BM25 ranking with a 5-step fallback per word: exact → synonym → prefix → sounds like → typo, plus "did you mean" |
| `matcher.py` | lost ↔ found score out of 100: category 25, description 30, colour 10, brand 10, place 15, time 10, with reasons |
| `campus.py` | BFS over the campus map for "1 place away" |
| `image_hash.py` | dHash photo fingerprint to compare a claimant's proof photo with the found photo |

## Project layout

```
openapi.yaml               the contract (example version; swap in the official one)
schemathesis.toml          contract-test config + schemathesis_hooks.py
backend/
  config/                  settings (env defaults), urls (API + media + built app)
  api/core/                handwritten algorithms, no Django imports
  api/services/            business rules; every status change goes through status.transition()
  api/views.py             spec endpoints        api/views_ext.py   /ext/ endpoints
  api/validators.py        request validation driven by openapi.yaml
  api/management/commands  seed_demo, expire_items, rebuild_index
  api/tests/               pytest
frontend/src/
  components/tag/          ItemTag, StatusStamp, MatchDial (the "luggage tag" look)
  pages/                   one file per route
docs/BUILD_BRIEF.md        design and product brief
```
