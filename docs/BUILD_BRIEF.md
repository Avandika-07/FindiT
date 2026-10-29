# FindiT build brief (condensed from the master prompt)

The contract is `openapi.yaml` (repo root) + `backend/EXT_API.md`. Where this brief and the yaml
disagree, the yaml wins.

## Hard rules
- No DRF, no Django Admin features, no OpenAPI code generators. Plain Django function views + `JsonResponse`.
- Search, matching, fuzzy text, phonetic keys, ranking and photo similarity are handwritten in pure
  Python (stdlib only: `re`, `math`, `collections`, `secrets`, `random`, `datetime`, `dataclasses`, `typing`).
  Forbidden: rapidfuzz, fuzzywuzzy, thefuzz, jellyfish, whoosh, `bisect`, Elasticsearch, Postgres FTS,
  NumPy, ML models, embeddings, AI APIs. Pillow only to open/validate/resize/blur/grayscale images.
- Offline at demo time: no CDN links. Fonts from `@fontsource`, icons from `lucide-react`.
- Every env var has a safe default; blank `.env` must work.

## Frontend stack (`/frontend`)
React 18 + Vite + TypeScript strict; Tailwind + shadcn/ui (Radix); Framer Motion; lucide-react;
React Router v6; TanStack Query v5; react-hook-form + zod; sonner; react-dropzone; Recharts;
qrcode.react; date-fns; clsx + tailwind-merge (`cn()`).
Fonts: `@fontsource/bricolage-grotesque` (display, 600–800) and `@fontsource-variable/figtree` (body).

Frontend env (`frontend/.env`, all may be blank): `VITE_APP_NAME` (FindiT), `VITE_API_BASE_URL` (`/api`),
`VITE_MEDIA_BASE_URL` (`/media`), `VITE_MAX_UPLOAD_MB` (5). Vite proxies `/api` and `/media` to
`http://127.0.0.1:8000`.

Structure:
```
frontend/src/
  main.tsx, App.tsx, router.tsx
  styles/globals.css           design tokens
  lib/                         api client, hand-written types from the yaml, cn(), formatters
  hooks/                       useAuth, useItems, useSearch, useClaims, useNotifications
  components/ui/               shadcn components
  components/tag/              ItemTag, TagSkeleton, StatusStamp, MatchDial
  components/layout/           AppShell, TopBar, BottomNav, PageHeader
  components/report/           wizard steps
  components/search/           SearchBar, FilterPanel, ResultsGrid, DidYouMean
  components/item/             PhotoViewer, Timeline, MatchBreakdown
  components/claim/            ClaimSheet, HandoverCode, OtpInput
  components/admin/            ClaimQueue, EvidenceMeter, HotspotGrid, StatsCards
  pages/                       one file per route
```

## UI and UX (top priority after contract correctness)

### Design direction: "the luggage tag"
Every item is shown as a **tag**, like a paper luggage tag tied to a bag: something attached to an
object so it can find its way home.
- `ItemTag`: softly rounded body (radius 20px), a small punched hole near the left edge (a circle
  cut-out showing the page background), a coloured strip down the left side: **raspberry for Lost,
  teal for Found**. A tiny string line from the hole is optional, on hover only.
- `StatusStamp`: slightly rotated (-4°), outlined, rounded label like an ink stamp ("Open", "Matched",
  "Claim pending", "Returned", "Expired", "Closed"). "Returned" is a filled teal stamp with a check icon.
- `MatchDial`: circular progress ring in sunflower yellow with the number in the middle.
- Spend boldness only on the tag, the stamp, and the dial. Everything else (navigation, forms,
  tables, admin) is quiet, spacious, disciplined.

### Tokens (CSS variables, mapped into Tailwind/shadcn theme)
Light: `--ink #18213F`, `--ink-soft #4A5372`, `--paper #F7F8FC`, `--surface #FFFFFF`, `--line #E3E6F0`,
`--cobalt #2F5BEA` (primary, links, focus ring), `--lost #D23A6B` (text variant `#B02A57`),
`--found #0F9D8A` (text variant `#0B7A6B`), `--signal #F5B700` (match dial, highlights only),
`--danger #C92A2A`.
Dark: `--paper #0F1428`, `--surface #182040`, `--line #2A3358`, `--ink #EEF1FA`, `--ink-soft #A9B0CC`,
`--cobalt #6E8DFF`, `--lost #F0628F`, `--found #2CC4AE`, `--signal #FFCC33`.
Theme toggle (system / light / dark) remembered in localStorage. WCAG AA contrast everywhere; use the
darker lost/found text variants for text on light backgrounds.

### Typography
Bricolage Grotesque (600–800) for page titles, tag titles, big numbers, and the wordmark "FindiT"
(the final capital T is part of the brand). Figtree (400–600) for everything else.
Scale 13/15/16/18/22/28/36/48 px. Body 16px, line-height 1.55, max ~70ch.
Sentence case everywhere. **No all-caps labels, no tracked-out eyebrow text above headings, no "→"
appended to buttons, no middle-dot joined meta strings.** Write meta as separate, labelled pieces.

### Layout
8px grid, generous whitespace, max width 1200px, reading width 720px.
Desktop: top nav with logo, search, "Report" button, notifications bell, avatar menu.
Mobile (designed first, 375px): bottom tab bar with Home, Search, centred **Report** button, My stuff,
Profile. Safe-area insets. Tap targets ≥ 44px.
Radius hierarchy: tags 20px, panels 16px, inputs/buttons 12px, chips fully rounded.
Shadows: tags get one soft, slightly tinted shadow; everything else flat with borders.
No decorative gradient washes.

### Motion (Framer Motion)
One signature moment: the **match reveal** after submitting a report. Tags drop in one after another,
sorted by score, while each dial fills from 0 to its score.
Elsewhere motion only answers actions: sheets sliding up, the stamp "thunking" in on status change,
toasts, OTP boxes shaking on a wrong code. No fade-in-on-scroll. Respect `prefers-reduced-motion`.

### Pages and flows
**Home `/`**: Bricolage headline "Lost something on campus? Let's get it back." + one supporting line.
Large search field with trie suggestions as you type; category chips with icons. Two big equal action
tiles: "I lost something" (raspberry accent) and "I found something" (teal accent), each with one
line on what happens next. "Recently found" horizontally scrollable row of tags. "How FindiT works"
three-step sequence: Report, Get matched, Collect with your code. Small stats strip: items returned
this month, average days to return.

**Report wizard `/report/lost`, `/report/found`**: step indicator; progress kept when going back.
1. What is it? Category as large icon tiles, then title, description, colour swatches (round,
   labelled), optional brand. Live tag preview (right on desktop, bottom on mobile).
2. Where and when? Location chips grouped by zone, with search. Date chips "Today", "Yesterday",
   "Pick a date".
3. Photo. Drag-and-drop or tap, preview, replace, size/type checked before upload. Optional for lost,
   strongly encouraged for found.
4. Secret check (found only). "Only the real owner will know this. We never show the answer."
   Example questions as tappable suggestions.
5. Review. The final tag exactly as others see it. Duplicate warning if a very similar report of
   yours exists.
After submit → **match reveal**: "We found 3 possible matches", tags ranked by score, each with an
expandable "Why this matched" breakdown (horizontal bars for category, description, colour, brand,
place, time, with reasons like "Found 1 place away", "2 days apart"). No matches: "No matches yet.
We'll notify you the moment something similar is reported."

**Search `/search`**: search bar, results count via aria-live. Filters: type (Lost/Found segmented),
category, location, date range, status. Desktop left filter panel; mobile "Filters" button opening a
bottom sheet with active-filter count badge and "Clear all". Responsive grid of tags; matched words
highlighted. Did-you-mean banner: "No results for 'airpds'. Showing results for 'airpods'." with a
link to search the original instead. Each result has a small "why" line, e.g. "earfone sounds like
earphone".

**Item detail `/items/:id`**: photo viewer (blurred for found items when not allowed, note "Photo is
blurred to protect the owner"). Title, stamp, labelled facts: category, colour, brand, place, date,
reported by (first name). Vertical courier-style timeline from status history. "Possible matches"
with dials and breakdowns. Primary action "Claim this item" (found items, not your own), sticky at the
bottom on mobile. Own items: "Mark as closed" and a list of claims on it (finder can approve/reject).

**Claim sheet**: bottom sheet on mobile, dialog on desktop. Secret question, answer field, proof
description, optional photo. Consequence text: "An admin will review your claim. Wrong answers are
recorded." Success state explains the next step.

**My stuff `/me`**: tabs "My reports", "My claims", "Notifications". Rows show stamp and latest
timeline step. Verified claims show the **handover pass**: 6-digit code in large Bricolage digits, a
QR code, pickup location, "Show this at the desk".

**Admin desk `/admin`** (admins only): overview cards (open lost, open found, pending claims, returned
this week). **Claim queue**: item tag and claimant side by side, **evidence meters** (secret answer
match %, photo similarity %, past rejections), guidance "Strong" / "Weak" / "Check carefully".
Approve or reject with a required note. **Handover**: large OTP input (6 boxes, auto-advance, paste).
**Hotspots**: locations grouped by zone as tiles shaded by lost-report count + Recharts bar chart of
top 8 locations. Flagged users list and expired items list.

**Leaderboard `/leaderboard`**: top finders by karma, current user's rank highlighted.
**Login `/login`**: roll number and password; in debug, "Log in as" buttons for demo users.
**404 / error**: tag style ("This tag has no item attached") with a button back home.

### States (every screen)
Loading: skeletons shaped like tags and rows, never a lone spinner. Empty: an invitation to act with
the matching button. Error: what happened + how to fix + retry; field errors inline; never apologise,
never vague. Success: toasts use the button's verb ("Report item" → "Item reported").

### Copy
Plain, friendly, specific. "Your claims", not "Claim entities". Buttons say exactly what happens:
"Report item", "Claim this item", "Approve claim", "Confirm handover". Same action, same word.

### Accessibility floor
Keyboard navigable, visible cobalt focus rings, labels on every input, alt text, aria-live for search
results and toasts, Radix dialogs/sheets with focus trapping. Responsive at 375/768/1024/1440 with no
horizontal scroll. Lighthouse a11y ≥ 95. No console errors or warnings.
