# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All npm commands run from `Frontend/`, not the repo root.

```bash
npm install          # install deps
npm run dev          # Vite dev server on 0.0.0.0:9001
npm run build        # production build to Frontend/dist/
npm run preview      # serve the built output on 0.0.0.0:9001
```

There is no test runner, linter, or formatter configured — do not assume `npm test` or `npm run lint` exist. Verification means building (`npm run build`) and clicking through in the browser.

`vite.config.js` proxies `/leapapi/*` to `http://127.0.0.1:6644`, rewriting the `/leapapi` prefix to `/portal-frontend-code`, configured identically for `dev` and `preview`. That target is the PSA gateway (`gateway.py` in the backend repo), which mounts each project's FastAPI app under a prefix named after the project — so the prefix is swapped, not stripped. Inside the mount the portal backend still sees its own bare paths (`/login`, …), because the gateway's `StripPrefix` removes the mount from `scope["path"]`. Merged Swagger for every project is at `http://localhost:6644/docs`. **The prefix is `/leapapi`, not `/api`, on purpose** — on the deployed host (`portalnew.mypartydashboard.com`) `/api` is already routed to the older party dashboard service, whose own routes live under `/api/v1`, so `/api/login` answers `404` from that service and never reaches this backend. The backend lives in a **separate repository** — it is not in this tree — and must be running and reachable at that `target` for anything to work. **When it isn't, every picklist is silently empty** — `useList` swallows fetch errors, so a dead backend looks exactly like a state with no assemblies in it. Check the console and network tab first when the wizard renders but won't populate. (The Dashboard is the exception: it uses `useLoadable`, so it distinguishes "still loading" from "loaded nothing", and reads getDashboardPositions by hand so a failure shows the error rather than an empty screen.) Note that this is now the signature of a *dead backend specifically*: a `401` no longer lands here, because `api.js` intercepts it and sends the app back to the login screen (see below), so a blank wizard means the backend is unreachable rather than the session having lapsed.

Deployment: `./install.sh` **from the repo root** installs frontend deps, builds, then (re)starts `portal-frontend` (`vite preview` on 9001) under PM2 using the root `ecosystem.config.cjs`. Frontend only — the backend is deployed from its own repo.

## What this is

A prototype of a nomination workflow for local body elections, styled as a party internal portal. React 18 + Vite SPA, plain JSX with hand-written CSS, backed by a FastAPI + PyMySQL service that lives in a **separate repository** (this repo is frontend-only). **No router, no tests, no state library.** The only frontend deps are `react` and `react-dom`.

The reachable flow is backend-driven end to end and holds **no application state of its own**: picklists, reservation, positions, cadre search, candidate assignment and the member list all hit the database, keyed by ids the user picks. Nothing survives in memory across a reload except the wizard's own selections, and nothing needs to — `proposal_position_id` is the only handle the writes use.

**The reachable app is `Sidebar` + `Dashboard` + `NewPositionModal` + `Candidates`.** `Dashboard` is where a session lands — one assembly's whole picture, read-only, and the jumping-off point into the other two. `NewPositionModal` is a single scrolling screen that does everything (pick a body → view its members, or add one) and never navigates on its own; `Candidates` is the read-across-everything counterpart. Everything else in `leap/` — the `positions` dataset, `PositionDetail`, `AllPositions`, `PositionCard`, and the whole `STAGES` pipeline — is unreachable. See "Known dead / inert code".

Two top-level screens, switched by a boolean in `Frontend/src/App.jsx`:
- `Frontend/src/Login.jsx` — real login. `handleSubmit` posts to `login`, which validates the credentials against the `user` table, and calls `onLoginSuccess(user)` only on `200`; a `401` renders in `.login-error`. `/login` opens a server-side session and sends its token **two ways**: an **httpOnly** `lbe_session` cookie, and a `token` field in the response body that `api.js`'s `login()` strips off into `sessionStorage` and replays as `Authorization: Bearer …` on every later call. The backend's `session_token()` accepts either, preferring the header. The cookie is still the safer half — an XSS cannot read it — so it stays the browser's primary path, and the `sessionStorage` copy is the fallback that also works from an origin the cookie cannot reach; `sessionStorage`, not `localStorage`, so it dies with the tab. `login()` keeps the token out of React state deliberately, so no rendered prop can leak it. `App.jsx` cannot read the cookie either — it calls `me` on mount to ask whether a session is live, which is what makes a reload keep you logged in, and renders the `.app-splash` spinner (in `index.css`, not `Leap.css` — it has to paint before either screen's stylesheet matters) until that answers, so the login screen does not flash and a slow answer does not read as a white broken page. `onLogout` calls `logout`, which drops the session server-side. **Every endpoint except login requires the session.**
- **Both ways in go through `App.jsx`'s `signIn`**, never `setUser` directly: it clears the session picklist cache (the cached assemblies are the *previous* user's grants) and calls `prefetchSession()` so getElectionTypes and getAssemblies are already in flight by the time the Dashboard mounts. Logout and the 401 handler clear the cache too, and both also call `clearToken()` — logout *after* awaiting `/logout`, since that call has to present the token to know which session to drop. `clearToken` is deliberately not folded into `clearSessionCache`: `signIn` runs the cache clear on the way *in*, which would wipe the token `login()` had just stored.
- `Frontend/src/leap/Leap.jsx` — the actual app.

## The `leap/` module

`Leap.jsx` is a short ad-hoc router around a `view` discriminated object (`{ name: 'dashboard' | 'newPosition' | 'candidates' | 'positions' | 'detail', id?, filter?, prefill? }`). Adding a screen means adding a `view.name` branch, not a route.

**`view` starts at `dashboard`** — the sidebar's first entry, and the only screen that says where a constituency stands without being asked a question first. Two things change it: `Sidebar`'s `onNavigate` (a bare `{ name }`), and the Dashboard's own per-location view icon, which hands over a full view object — `candidates` with a filter when that location already holds candidates, or `newPosition` with a `prefill` that jumps the wizard straight to that location's Add Members search when it does not. `detail` and `positions` are still unreachable: their setters live inside props passed to `AllPositions` and `PositionDetail`, neither of which renders. `Leap.jsx` still holds `positions` (seeded from `POSITIONS`) and `advanceStage` for those two branches; both are effectively dead. `createPosition` was removed when the wizard stopped producing positions — nothing constructs a local position object any more, so the `_newId` counter is gone too.

### Screens

| Component | Reached via | Notes |
|---|---|---|
| `Dashboard` | `view.name === 'dashboard'` (**initial**, and the sidebar) | One assembly's positions across every election type, from getDashboardPositions alone. Read-only; navigates into the other two |
| `NewPositionModal` | `view.name === 'newPosition'` (sidebar, or the Dashboard's prefill) | 6 steps, each revealed only when the previous is filled. Takes an optional `initial` that pre-fills steps 1–4 |
| `Candidates` | `view.name === 'candidates'` (sidebar, or the Dashboard's filter) | Every position holding candidates, state-wide, filtered client-side; opens one position full-screen |
| `Sidebar` | always | Three nav buttons with inline SVG icons, `NAV` in that file, each switching `view.name` and carrying `aria-current`. Footer shows the logged-in user (`firstname lastname`, falling back to `username`) and a logout button that clears `App.jsx`'s `user` |
| `PositionDetail` | `view.name === 'detail'` | **Unreachable** — nothing sets this view since `createPosition` was removed |
| `AllPositions` | `view.name === 'positions'` | **Unreachable** — nothing sets this view |
| `PositionCard` | rendered by `AllPositions` | therefore also unreachable |

### `NewPositionModal` (844 lines — read it before changing anything here)

Six steps, rendered top to bottom in one scrolling panel, each gated on `stepNDone`:

1. **Election type** — getElectionTypes, as a grid of icon chips. Icons are inline SVG components in this file, keyed by `election_type` name in `ELECTION_TYPE_ICONS`; an unknown name falls back to `IconHouse`. A new election type in the DB shows up with the house icon until you add one.
2. **Assembly** — getAssemblyConstituenciesInAState, `searchable` (the list is every assembly in the state).
3. **Mandal/Town** — getMandals + getTowns merged into one picklist. The two halves resolve through different endpoints, so option values are tagged `m:<tehsil_id>` / `t:<town_id>` and split back apart by `locationKey.split(':')` — keep that encoding.
4. **Local body** — getProposalConstituenciesByTehsil (for `m:`) or getProposalConstituenciesByTown (for `t:`). Its heading is `localBodyLabel`, i.e. the step-1 election type name. Auto-selects when exactly one row comes back.
5. **Reservation & Members** — getReservation for the reservation badge, getPositionsOverview for the roles and the Total / Filled / Unfilled seat counts, then a fork: **View Members** or **Add Members**. **A "seat" here is a `max_proposals` slot, not a `max_positions` one**: total is `Σ max_proposals`, filled is `Σ proposed_cnt`, and unfilled is the difference — so two roles of three read as six seats with each candidate proposed filling one. That is the same number the per-role "N open" badges count down; `max_positions` is shown separately, as the role's "N seat(s)".
6. **Cadre search** — searchCadre search (membership id only), getCadreScores score, assignCandidate assign. Only rendered in the `add` branch, once a role is picked. It is `AddMembersPanel`, exported from this file and mounted **keyed by `proposal_position_id`** — picking another role remounts it, which is what clears the staged list, the picked statuses and the banners. The Candidates screen mounts the same component (see below), so both live paths to a proposal are one implementation.

### `CompareModal`

Side-by-side comparison of cadre, one column each, opened from the staged list in step 6 and from any View Members role holding more than one cadre. Takes cadre rows in the **backend's own shape**, reads the header's name/photo/chips straight off them and fetches only the score half, via `getCadreScores`. **The table is scores alone** — the profile fields it used to repeat as rows are on the column header and on the member card, and listing them again pushed the first weighted section off the screen. Columns are drag-reorderable (with edge auto-scroll while a drag is live, since a column past the right edge could otherwise never be dropped on the left one) and individually dismissable, both view-only; the header of the highest `total_score` column carries a ★ TOP flag, and only when someone actually has a score, since with the ratings database unwired every column is `null` and there is no winner to point at.

Its layout mirrors the membership-analytics platform's own compare table (`PositionDetailScreen.jsx` in that repo), so the two read the same way: a sticky metric column and sticky candidate headers, then `PERFORMANCE_SECTIONS` — the weighted groups (`PEDALA SEVALO 15%`, `D2D CAMPAIGN 30%`, …) whose rows name the report's own column names (`'ACH % (Booth D2D)'`, `'BOOTH 15%'`, …), which is why getCadreScores returns the row unrenamed. **Only `pts`/`score` rows carry the best-of highlight**, and only when the maximum is unique — a tie has no winner to point at. Two things that platform shows are absent here because this backend has no endpoint for them: `MY TDP APP USAGE` and the per-candidate Documents overlay. `PREVIOUS POSITIONS` reads the report's `'2018 - 2020'` / `'2016 - 2018'` / `'2014 - 2016'` columns rather than that platform's `cadre_details.previous_role`.

Selecting anything at step *N* clears steps *N+1…6* (the `select*` handlers). Picking a different role additionally clears the search results, selection, error and success text.

**View Members** fans getProposalCandidates out over every role from getPositionsOverview (`Promise.all`, one call per role), then makes **one** getCadreScores call for every membership id the whole fan-out returned, and renders each cadre as a `MemberCard` — the membership-analytics `cand-card`, field for field: a header (photo, name, score badge tinted by `scoreTier`, "Proposed for &lt;role&gt;", membership-id and mobile pills) over `PROFILE` and `LOCATION & MEMBERSHIP` on a six-column grid the fields `span`. **The fields this backend cannot fill are still rendered, as `—`** (Date of Birth, Occupation, Education, Parliament, Caste Community %) so the two cards read the same; Voter ID and Panchayat are the only two fields added, because that card has no slot for them. Colour carries meaning and matches: caste by category (BC/OC/SC/ST), Member Since and Renewals green, Caste Community % amber. Everything comes off the getProposalCandidates row except **Member Since** and **Renewals**, which are the report's `'YEAR'` and `'NO OF TIME'`, and the badge, which is `total_score`. That getCadreScores call is decoration on a list that already rendered, so its failure is logged and the badge and those two fields go blank rather than the view erroring. `img_url` is an S3 URL built by searchCadre/getProposalCandidates and is `''` when the cadre has no photo — the card falls back to `initials()`. Clicking a photo opens the `zoomed` lightbox. `members[id] === undefined` means getProposalCandidates is still in flight, `[]` means it returned none; the two render differently.

Each member card carries **its status where a staged card carries the two buttons** — a read-only `.leap-mcard-status` block reading Proposed / Shortlisted / Confirmed off `STATUS_META[cadre.proposal_status_id]`, defaulting to Proposed for the rows that predate the column. It is deliberately not clickable *here*: this screen writes a status (assignCandidate) and never
changes one — changing one is the Candidates screen's job, via updateProposalCandidateStatus. The ✕ on the header **removes the member** — `removeMember` confirms, calls removeProposalCandidate and bumps `positionsKey`, which re-reads getPositionsOverview *and*, because `positions` is then a new array, re-runs the effect that loads the members, so the card and the open-slot counts update from one bump. A failure renders in `membersError`, since step 6's `error` banner is not on the screen in this branch.

**`MemberCard` renders the staged cards in step 6 too**, so a cadre looks the same before and after they are proposed. `onRemove` is what tells the two apart: with it the card loses the live dot and the status block, and reads "Considered for" rather than "Proposed for" — nothing is proposed until you assign, and the staged list must not claim otherwise.

**Add Members** shows the roles as cards, disabled when `max_proposals - proposed_cnt <= 0`, then the search row.

**Search is by membership id only** (`SEARCH_TYPE = 'MembershipId'`), because it is the one field searchCadre matches exactly, so a search resolves to a single cadre rather than a page of near-matches — the `Name` filter is a `LIKE '%value%'` over `first_name` with no location filter and routinely returns thousands. `sanitizeSearchValue` strips the box to 8 digits on typing and on paste, and `runSearch` refuses anything shorter. searchCadre still returns matched-but-ineligible cadre (see the eligibility trap below), which is what lets "no such id", "already staged" and "barred by the reservation" read as three different messages rather than one blank result.

**A search stages a cadre, it does not assign one.** `staged` holds the cadre rows; `scores` holds their whole getCadreScores row (the card wants the report behind the score, for Member Since and Renewals, not just the number), keyed by `membership_id` and fetched one MID at a time as each is staged, so a slow score never blocks the card. `stagedByScore` sorts best-first on `total_score` with unscored cadre last (`?? -1`) rather than as zeros. Each staged card is a `MemberCard` with `onRemove` — same layout as a proposed member, plus the photo lightbox and a score badge tiered by `scoreTier` (≥70 / ≥40 / below / none). **Compare** appears once two are staged.

**Each staged card ends in two blocks, `Propose Candidate` and `Shortlist Candidate`** (`PROPOSAL_STATUSES`), replacing the single "Select Candidate" toggle. They are the same pick — `selection` maps `tdp_cadre_id` to the `proposal_status_id` the button chose (1 Proposed, 2 Shortlisted; 3 Confirmed exists in the table but this screen never writes it) — so choosing one switches away from the other and clicking the lit one clears it. **The buttons say what a staged cadre is saved as, not whether they are saved** — save writes every staged card, and one nobody marked goes in as `DEFAULT_STATUS_ID` (Proposed), so a mixed list of one shortlisted and one untouched saves as one of each. The status travels to assignCandidate as `proposal_status_id`. **Both statuses consume a `max_proposals` slot**: they are rows in the same `proposal_candidate` table, and getPositionsOverview's `proposed_cnt` counts every active row whatever its status. getProposalCandidates now returns `proposal_status` (the `status_name`), which is the verb a proposed member's card reads back — `null` on rows written before the column existed, which render as "Proposed".

`assignStaged` then calls assignCandidate **sequentially**, in score order — the proposal slots are exactly what the staged candidates compete for, and assignCandidate re-checks the count on every write, so the server has to see them one at a time. A batch can therefore partly succeed: whoever went in is dropped from `staged` and named in the success line, and the rest stay staged with assignCandidate's own `{detail}` text. After any success `positionsKey` is bumped so getPositionsOverview re-reads and the open-slot counts update in place.

`Dropdown` is a hand-rolled replacement for `<select>`, used by steps 2/3/4 and the search-type picker. It exists because Chrome flips a long native popup *upward*; this one always drops below. `searchable` adds a filter input (step 2 only). It closes on outside `mousedown` and on Escape.

Candidates use the **backend cadre shape** everywhere (`member_name`, `membership_id`, `mobile_no`, `category_name`, `panchayat_name`, `mandal_town_name`, `img_url`, …) — not the `data.js` `candidate()` shape (`name`, `score`, `idNo`, `phone`).

### `Dashboard`

Where a session lands. **One endpoint, one assembly, everything client-side after that.**
`getDashboardPositions` returns every `proposal_position` under the chosen assembly across every election
type and every local body — a LEFT JOIN, unlike getPositionsWithCandidates's INNER, which is what makes a position
nobody was proposed for countable as "Not Started". Grouping, the six stat tiles, the
per-location rollup, search, the status chips and the column sort are all derived from that
one array; nothing re-queries.

- **The assembly picklist is getAssemblies and it pre-fills.** `user.constituency_id` (the user's own
  home constituency, from the `user` table — *not* the same thing as getAssemblies's grants list)
  selects itself when it is one of the granted assemblies, so the screen has numbers on it
  without anyone touching the dropdown. getDashboardPositions cannot be fired before getAssemblies answers: getDashboardPositions is
  unscoped by access grants, so the assembly has to come off the list the server vouched for.
- **`useLoadable`, not `useList`, for the assemblies**, and a hand-rolled fetch for getDashboardPositions —
  `rows === null` is loading, `[]` is loaded-and-empty, and they render differently
  (`DashboardSkeleton`, shaped like the real layout so nothing jumps, versus an empty-state
  sentence). No grants at all gets its own message, because an empty dropdown otherwise
  reads as a broken screen.
- **A "slot" is a `max_proposals` slot**, the same unit as the wizard's step 5. The headline
  bar and the FILLED column are `Σ proposed_cnt ÷ Σ max_proposals` — every live candidate
  whatever their status — while the PROPOSED and CONFIRMED tiles are the per-status columns.
  The two do not add up to each other on purpose.
- **`StatTile`'s `of` prop is what splits the six tiles in two.** Only three have a real
  denominator — proposed and confirmed against the proposal slots, not-started against the
  roles — and those render `value / of` over a meter in the tile's own accent colour
  (`ProgressBar`'s `color`, which overrides the status tones: inside a tile the bar measures
  that tile's metric, not a nomination status). The other three are totals with nothing to
  reach and keep the plain count and a `sub` line. Do not give them a target to make the row
  look uniform — it would read as progress toward something that does not exist.
- Per-location **Nomination** is rolled up, not stored: `Not Started` while every role there
  is untouched, `Completed` once every role has used its proposal slots, `In Progress`
  between. `NOMINATION_RANK` is what sorting that column uses, so it sorts by pipeline order
  rather than alphabetically. The progress bar's tone follows the same status, and the
  percentage is always spelled out beside it — colour reinforces the number, never carries it.
- **The view icon is not a link to one place.** A location that already holds candidates goes
  to `Candidates` filtered to it; one that does not goes to the wizard with a `prefill`
  (getDashboardPositions carries `tehsil_id`/`town_id`, exactly the inputs getProposalConstituenciesByTehsil/getProposalConstituenciesByTown want), so the click is never a
  dead end. The whole row is clickable too — the button `stopPropagation`s so it fires once.
- The refresh button bumps a `reloadKey`; getDashboardPositions is the only call it re-runs. The open election
  type survives it, because the effect only re-opens the first group when the current one is
  no longer in the rebuilt list.

### `Candidates`

The other reachable screen that reads across constituencies. It mirrors
the membership-analytics platform (`/cde/`): the positions list is that app's
`PositionsScreen` card list, and opening a card is its `Step2View` ("Adding Profiles") —
a header, then `MAPPED CANDIDATES` as a grid of the same `MemberCard` the wizard renders,
with Compare All over them.

**One endpoint, all the filtering in the browser.** `getPositionsWithCandidates` returns every
`proposal_position` with at least one active candidate — the join to `proposal_candidate`
is inner, so a position nobody was proposed for never appears — carrying its election
type, assembly, mandal/town, local body, role, reservation, slot counts and a
**per-status breakdown** (`proposed_status_cnt` / `shortlisted_status_cnt` /
`conformed_status_cnt` — the SQL aliases kept their old spelling when the status was
renamed to Confirmed — a `COALESCE` to Proposed for the rows written before the column).
It takes no query parameters on purpose: the four filters (Election Type, Assembly, Role,
Status) get their options from the *unfiltered* rows, so filtering server-side would empty
the dropdowns the filter was picked from. Status filters positions that hold at least one
candidate of it, not the cards inside.

The detail is `getProposalCandidates` + `getCadreScores`, the same pair as View Members, and the ✕ is the same `removeProposalCandidate`
removal — dropping the last candidate takes the position out of `getPositionsWithCandidates` entirely, which is
why `onChanged` bumps the list and the effect falls back to the list rather than rendering
a position that no longer exists.

**This is the one screen that *changes* a status.** Where View Members shows the read-only
`.leap-mcard-status` block, here the card carries all three statuses as buttons with the
saved one lit — `MemberCard`'s `statuses` prop, which defaults to the wizard's two and is
passed `STATUS_FILTERS` (all three) here. Nothing is written until **Save Status**: the
buttons move `pending` (only the ids the user touched), and Save writes one `updateProposalCandidateStatus` per card
whose status actually moved, sequentially so a failure can name the candidate. Pressing the
lit button is a no-op — the wizard clears its pick there, but a saved candidate always has
a status, so `onStatus(null)` is ignored. A reload clears `pending`, because `getProposalCandidates` is then
the new truth about every status. `getPositionsOverview`'s counts do not move on a status change (all three
are live rows in one `max_proposals` slot), but `getPositionsWithCandidates`'s per-status pills do, which is what
`onChanged` refreshes.

**It also proposes.** When the open position still has a proposal slot free
(`max_proposals - proposed_cnt > 0`) the section head carries an **Add Members** toggle
that mounts the wizard's own step 6, `AddMembersPanel` — same searchCadre search, same staging
and compare, same sequential assignCandidate write. getPositionsWithCandidates returns `proposal_constituency_id`, which is
the one thing the cadre search needs and the drill-down would otherwise have supplied;
reservation, role and local body name come off the same row. A successful assign bumps
the detail's `reloadKey` (getProposalCandidates, for the new cards) *and* calls `onChanged` (getPositionsWithCandidates, for the
slot and per-status counts) — the toggle then disappears on its own once the last slot
fills, because `open` is recomputed from the refreshed row.

`MemberCard`, `AddMembersPanel`, `PhotoViewer` and `STATUS_META` are imported from
`NewPositionModal.jsx` rather than copied: a proposed member must look identical on both
screens, and so must the search that proposed them.

### `PositionDetail` (unreachable)

Branches on `stage.key === 'profiles'` (stage 0) for an "add candidates" layout and falls through to a review layout otherwise. Both render the getProposalCandidates list, with `reloadKey` bumped after a successful assignCandidate assign. It is a second, older implementation of what step 5/6 of the wizard now do — if you change assign behaviour, decide whether to update it or delete it rather than leaving the two to drift.

### `Frontend/src/leap/data.js`

Central source of both the seed dataset and the domain vocabulary. It exports:
- Config constants (`STATE_NAME`, `PARTY_NAME`, `PARTY_SHORT`, `TERM_LABEL`).
- `STAGES` / `STAGE_COLORS` — the nomination pipeline (see the stage caveat below).
- Picklists (`AP_ASSEMBLIES`, `AP_MANDAL_TOWNS`) — the live screen gets these from getAssemblyConstituenciesInAState/getMandals/getTowns instead.
- `POSITIONS` — 16 seeded positions (8 `nominated`, 8 `committee`) with procedurally generated candidates. `makeCandidate` uses `Math.random()` at module load, so scores/points differ between reloads.
- Derived helpers `stagesFor`, `stageCounts`, `summary` — pure functions over a positions array.

**Only `PARTY_SHORT` still reaches the screen**, via `Sidebar`. Everything else in this file is imported solely by unreachable components. All seed data is fictional; real Andhra Pradesh place names appear only as picklist values.

### `Frontend/src/leap/api.js`

One thin `get`/`post` pair over `${API_BASE}/*` — `API_BASE` is `/leapapi` (Vite proxies it; see above for why not `/api`) — one named function per endpoint, plus the two loading hooks. `post` unwraps FastAPI's `{detail: "..."}` into the thrown `Error.message`, which is what the assignCandidate error banner shows.

**`useLoadable(load, deps)` is the implementation; `useList` is a one-line wrapper over it.**
`useLoadable` returns `{items, loading, error}`; `useList` returns `.items` alone — `[]`
until the promise resolves **and `[]` again on failure**, logging the error rather than
surfacing it, which is why a failed picklist is indistinguishable from an empty one for
every caller that still uses it. Reach for `useLoadable` when the difference matters (the
Dashboard's assembly dropdown does).

**getElectionTypes and getAssemblies are cached for the session** (`cached(key, load)` — it memoizes the *promise*,
so two components mounting in the same tick share one request rather than racing two; a
rejection drops the entry so the next mount retries). Neither can change while one user is
signed in, and the wizard and the Dashboard both open with them, so without this every
screen switch re-paid the round trip and the dropdowns visibly refilled. **`clearSessionCache()`
must run whenever the identity behind the session changes** — login, logout, and the 401
handler all call it, because the assemblies are that user's own grants. `prefetchSession()`
warms both the moment the session is known, so the first screen renders against a request
already in flight rather than starting one.

**No write here sends a user id.** assignCandidate stamps `inserted_user_id` and updateProposalCandidateStatus stamps
`updated_user_id` from the session the httpOnly cookie identifies, server-side — the
frontend has no `user_id` to pass and must not start passing one, since a body-supplied id
would let a browser forge the audit trail.

`getPositionsWithCandidates()` (getPositionsWithCandidates) is the Candidates screen's whole list — see that
section for why it takes no filter arguments. `updateProposalCandidateStatus()` (updateProposalCandidateStatus) is
the only write that edits a `proposal_candidate` row rather than creating (assignCandidate) or
deactivating (removeProposalCandidate) one.

`getCadreScores(mids)` is the one call behind both the staged card's score badge and the whole compare table — same payload, so the same endpoint (`getCadreScores`, `?mids=` comma-separated). It answers `{configured: false, questions: [], candidates: []}` rather than failing when the ratings database is unset on the server, which is a state the UI renders ("No score", and a note in the compare modal) rather than an error. **The score half is optional; the profile half never is** — everything the compare table shows above the Performance section comes off the searchCadre/getProposalCandidates row the caller already had.

Both `get` and `post` route a `401` through `checkUnauthorized` before throwing: it calls the handler registered by `App.jsx` via `setUnauthorizedHandler`, which clears `user` and returns to the login screen. **`AUTH_PATHS` (`login`/`me`/`logout`) is exempt and must stay that way** — `login` answers `401` for bad credentials and `me` answers `401` on a normal first visit, so treating those as expiries would wipe the login form's own error banner. Only `401` triggers it: a `429` from the login throttle and a `500` from a dead backend must not log anyone out. Adding an endpoint that can legitimately `401` without meaning "session over" means adding it to `AUTH_PATHS`.

## Traps to know before editing

**The stage pipeline is truncated — and now entirely inside dead code.** `STAGES` has only 2 entries (`profiles`, `approval`) while its consumers still assume a 5–7 stage pipeline. None of them render today, so none of this is a live bug; it is a landmine for anyone restoring those screens. Concretely:
- `stagesFor(kind)` returns `STAGES.slice(0, 5)` for committees, which with 2 entries is the *same* array as for nominated — the kind distinction is currently a no-op.
- Seed `stage:` values go up to 5, so most positions have a `stageIndex` outside `STAGES`.
- `PositionCard` does `STAGES[position.stageIndex].full` unguarded — this **throws** for any position with `stageIndex >= 2`. It is only invisible because `AllPositions` is unreachable. Restoring that view without fixing this will crash the render.
- `summary()` counts `stageIndex >= 4` as finalized and `=== 6` as GO-issued, so those stats read as 0 for anything the current UI can produce.
- `stageCounts()` writes `counts[p.stageIndex] += 1` past the array end, producing `NaN` entries.
- `PositionDetail` guards with `stages[viewStage] || stages[stages.length - 1]`, so it degrades rather than crashing.

If you touch `STAGES`, check every one of the consumers above.

**"Step N" is the wizard's own numbering, not an endpoint's.** Endpoints are named, not numbered (the old `S1`…`S17` scheme is gone); steps 1–6 are the wizard's visible sections. Wizard step 3 calls getMandals+getTowns, step 4 calls getProposalConstituenciesByTehsil *or* getProposalConstituenciesByTown, step 5 calls getReservation+getPositionsOverview+getProposalCandidates, step 6 calls searchCadre+getCadreScores+assignCandidate. Say which you mean.

**Only one path through the wizard reaches live data.** The database holds exactly one
`proposal_consituency` row, reachable only via **ACHANTA (`constituency_id` 181) →
Achanta mandal (`tehsil_id` 658)**. Every other assembly/mandal ends at an empty
proposal-constituency select (the UI says so rather than dead-ending silently). That
row has no `local_election_body`, so the towns half of the picklist (getTowns/getProposalConstituenciesByTown) yields
nothing for it. Its two positions are `President` (`max_proposals` 3, already full —
the card is disabled and assignCandidate would 409) and `Vice-President` (open). Reservation is
`BC-GENERAL`, so only cadre with `caste_category_id = 2` can be assigned.

**Step 1 of the wizard is live, but only Panchayat has data.** getProposalConstituenciesByTehsil/getProposalConstituenciesByTown take
`proposal_election_type_id` from the caller. Every seeded `proposal_consituency` row is
type 8 = **Panchayat**, so picking any other type correctly yields an empty
proposal-constituency select and the "No &lt;type&gt; is configured…" hint. Row 8 was
originally `is_active = NULL, order_no = NULL` — getElectionTypes hid the one type the data used;
it has since been activated. If step 1 ever shows no Panchayat option again, check
those two columns first.

**Candidate eligibility is the assembly, then the reservation.** A cadre's
`user_address.constituency_id` has to equal the proposal constituency's own assembly — but
nothing below it does, so any mandal, panchayat or town inside that assembly is fine. On
top of that comes the constituency's `constituency_reservation`: `caste_category_id` when
set, and `gender = 'F'` when set. All of it comes from `proposal_context()` in the backend
repo's `main.py` (which returns `assembly_constituency_id` beside the reservation), the
reservation SQL from `eligibility_flag()` there. Change eligibility there, not in either
endpoint, and not in this repo. A cadre with no caste category on record compares NULL and
so is ineligible.

**`searchCadre` flags both, it filters neither.** The assembly comes back as its own
`in_assembly` (`'Y'`/`'N'`) column and the reservation as `eligible` — `eligibility_flag()`
returns a SELECT expression (`… AS eligible`), not a WHERE clause — so searchCadre returns
every cadre the search matched. `stage()` checks `in_assembly` first, since "Provided ID
belongs to another assembly (&lt;their assembly&gt;)" is a different fix for the user than a
caste-category mismatch; only rows with both flags `'Y'` are staged. That is deliberate: "no cadre has that membership id" and "that cadre
is barred by the reservation" are different states and `runSearch` says different things
for each — the second names the reservation. Only `eligible === 'Y'` rows can be staged.
`assignCandidate` re-checks both rules on write — the search filter is only what the browser
was shown — and answers `409` with the reservation type, or "Cadre belongs to a different
assembly constituency", in `detail`, which is what the error banner shows.

**Scores come from a second, optional database.** `getCadreScores` reads
`report_ratings` — `cadre_performace_report` (the table's name really is spelt that way)
for the per-category points and `leader_feedback` for the per-question ones, with the
question labels coming from `members_track.question` on the same server. **Total Score is
half of each**: `(Σ the 11 POINTS columns ÷ 2) + (Σ the feedback answer points ÷ 2)`,
matching the membership-analytics platform, and it is `null` — never `0` — when a cadre has
neither, so unrated does not sort as worst. getCadreScores is *lookup-first*: a membership id whose
report row already exists is served from the table, and the `cadre_performance_update` /
`cadre_performance_report` procedures (seconds per id) run only for the rest.
`REPORT_RATINGS_DB_HOST`/`USER`/`PASSWORD` are all optional — with any of them unset
`RATINGS_DB` stays `None` and getCadreScores answers `{"configured": false}`, so the wizard renders
without scores instead of erroring. `Backend/test_score.py` covers the arithmetic and the
membership-id key matching (the report stores it as varchar, `leader_feedback` as an INT).

Some seeded `proposal_candidate` rows would fail the reservation check now. `getProposalCandidates` still
returns them — it reports what *is* assigned, and filtering it would desync the list from
`getPositionsOverview`'s `proposed_cnt`.

**A "proposal constituency" is the local body being contested** — for this data a
*panchayat* (`VALLURU`, `constituency_id` 58153, `election_scope_id` 33), one level below
the mandal. Positions and reservation hang off it, not off the mandal, which is why
step 4 exists at all. Its heading is the step-1 election type name
(`localBodyLabel`), and it auto-selects when the mandal resolves to exactly one body.

**`NewPositionModal` is neither new-position nor a modal.** The name, the `leap-modal-*`
class prefix, and its own heading ("Create a new post for the local body election") all
date from when it was a creation wizard that handed a position back to `Leap.jsx`. It now
proposes candidates against positions that already exist in the database and creates
nothing. Renaming it means touching the class names too, so it has been left alone —
just don't read the name as a description.

**Branding is not actually centralized.** The CLAUDE-visible intent is that `data.js` drives naming, but `Sidebar.jsx` and `Login.jsx` hardcode "Telugu Desam Party" and `index.html` hardcodes a TDP title, while `PARTY_NAME` in `data.js` says "Praja Vikas Party". Changing one does not change the others — grep for both strings.

**`AllPositions` reads `filter !== 'all'`** but `view.filter` starts `undefined`, so the "← All Positions" reset button would always show.

## Styling

`Frontend/src/leap/Leap.css` (~2600 lines) holds every class for the leap module; `Login.css` (~180) covers the login screen; `index.css` is the reset plus `.app-splash` (which has to paint before `Leap.css` is loaded at all). Classes are flat and prefixed `leap-`. No CSS modules, no utility framework — add styles to the existing file matching the surrounding naming. Fonts (Montserrat, Inter) load from Google Fonts in `index.html`.

Anything that moves — the skeleton shimmer, the progress-bar fill, the splash spinner — has
a `prefers-reduced-motion: reduce` branch that stills it without removing the signal. Keep
that when adding animation. `.leap-stat-row` is a deliberate `repeat(3, …)` rather than
`auto-fit`: there are six tiles, and auto-fit strands the sixth on a row of its own at wide
widths; the column count drops at 1100px and 680px instead.

A large share of the file styles components that no longer render (`.leap-card-*`, `.leap-stage-*`, `.leap-candidate-*`, `.leap-cadre-search-modal`, `.leap-detail-*`, …). Grep the JSX before assuming a rule is live — and before deleting one, since the dead components still reference them.

## Known dead / inert code

Still around a quarter of the `leap/` module. Mention rather than silently remove
(`Dashboard.jsx` used to be on this list and no longer is — it is the landing screen):

- **`PositionDetail.jsx` (339 lines) became unreachable** when `createPosition` was dropped
  from `Leap.jsx`. It is still imported and still the only other caller of `searchCadre` /
  `assignCandidate` / `getProposalCandidates`.
- `AllPositions` and `PositionCard` are unreachable (see table above). `AllPositions`'s
  `onNewPosition` prop is never passed, and it renders `st.nomOnly`, a field `STAGES`
  entries no longer have.
- In `Leap.jsx`: the `positions` state, `advanceStage`, `openPosition` and the `POSITIONS`
  import exist only to feed the two unreachable branches.
- `data.js` is dead except `PARTY_SHORT`: `STAGES`, `STAGE_COLORS`, `stagesFor`,
  `stageCounts`, `summary`, `POSITIONS`, `TERM_LABEL`, `STATE_NAME`, `PARTY_NAME`,
  `AP_ASSEMBLIES`, `AP_MANDAL_TOWNS` are all imported only by unreachable components,
  as are the seeded candidates' fields (`score`, `idNo`, `casteCommunityPct`, `appPoints`, …).
- `PositionDetail` imports `STAGES` without using it (pre-dates the backend wiring).
- `checkPositionAvailability` (checkPositionAvailability) is exported from `api.js` and called by nothing.
- `Frontend/src/circle.svg` is used only by the login screen.
- Backend `getProposalPositionsByProposalConstituencyId` and `checkPositionAvailability` are unused by the frontend; `getPositionsOverview` already carries the role
  names and the counts that make both redundant.
