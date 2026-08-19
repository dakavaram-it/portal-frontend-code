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

Deps are `react`, `react-dom` and `@fortawesome/fontawesome-free` (imported once in `main.jsx`; the Cadre Search and Notes screens use `fa-*` classes, nothing else does).

`main.jsx` deliberately does **not** use `<StrictMode>` — its dev-only double-invoke of effects showed up as a second, aborted request for every screen that loads on mount. Re-adding it changes only what the dev Network tab shows, but expect that noise back.

## Three backends, not one

| Base | Reached how | Used by |
|---|---|---|
| `/leapapi/*` | Vite proxy → `http://127.0.0.1:6644`, prefix rewritten to `/portal-frontend-code` | `api.js` — the whole nomination workflow |
| `https://www.mypartydashboard.com/PSA/WebService/Cadre` | called **directly** from the browser (that service answers `Access-Control-Allow-Origin: *`) | `cadreSearchApi.js`, `cadreNotesApi.js` |
| `https://www.mypartydashboard.com/PSA/WebService/Committee` and `…/WebService/CommitteeWebService` | Committee resource direct; CommitteeWebService **proxied** as `/partyAnalystApi` (its OPTIONS preflight sends no CORS headers, so a direct call is blocked before it leaves the browser) | `committeeApi.js` |

`vite.config.js` configures `/leapapi` and `/partyAnalystApi` identically for `dev` and `preview`. The `/leapapi` target is the PSA gateway (`gateway.py` in the backend repo), which mounts each project's FastAPI app under a prefix named after the project — so the prefix is swapped, not stripped, and inside the mount the portal backend still sees its own bare paths (`/login`, …). Merged Swagger for every project is at `http://localhost:6644/docs`. **The prefix is `/leapapi`, not `/api`, on purpose** — on the deployed host (`portalnew.mypartydashboard.com`) `/api` already routes to the older party dashboard service, whose routes live under `/api/v1`, so `/api/login` answers `404` from that service and never reaches this backend.

The `/leapapi` backend lives in a **separate repository** — it is not in this tree — and must be running and reachable for the nomination screens to work. **When it isn't, every picklist that still uses `useList` is silently empty** — `useList` swallows fetch errors, so a dead backend looks exactly like a state with no assemblies in it. Check the console and network tab first when the wizard renders but won't populate. The Dashboard and Candidates screens are the exceptions: they distinguish "still loading" from "loaded nothing" and surface the error. Note this is now the signature of a *dead backend specifically*: a `401` no longer lands here, because `api.js` intercepts it and sends the app back to the login screen.

Deployment: `./install.sh` **from the repo root** installs frontend deps, builds, then (re)starts `portal-frontend` (`vite preview` on 9001) under PM2 using the root `ecosystem.config.cjs`. Frontend only — the `/leapapi` backend is deployed from its own repo.

## What this is

A nomination + committee workflow for local body elections, styled as a party internal portal. React 18 + Vite SPA, plain JSX with hand-written CSS. **No router, no tests, no state library.**

The reachable flow is backend-driven end to end and holds **no application state of its own**: picklists, positions, cadre search, candidate assignment and the member lists all hit a database, keyed by ids the user picks. Nothing survives a reload except what the user re-picks.

Two top-level screens, switched by a boolean in `Frontend/src/App.jsx`:

- `Frontend/src/Login.jsx` — real login. `handleSubmit` posts to `/login`, which validates against the `user` table and calls `onLoginSuccess(user)` only on `200`; a `401` renders in `.login-error`.
- `Frontend/src/leap/Leap.jsx` — the actual app.

### Auth is a bearer token, and only a bearer token

`/login` returns a **signed JWT in its body and sets no cookie**. `api.js`'s `login()` strips the `token` field into `sessionStorage` under `lbe_token` and replays it as `Authorization: Bearer …` on every later call; the backend reads that header and nothing else. `sessionStorage`, not `localStorage`, so it dies with the tab — and the token's 8h `exp` is what actually bounds a stolen one, since **`/logout` is stateless: it cannot revoke a token server-side.** Dropping the local copy is what ends the session here. `login()` keeps the token out of React state deliberately, so no rendered prop can leak it. Any script on the page can read it; that is the accepted cost of an origin the cookie could not reach.

- `App.jsx` calls `/me` on mount to ask whether the stored token is still live — that is what makes a reload keep you logged in — and renders the `.app-splash` spinner (in `index.css`, not `Leap.css` — it has to paint before either screen's stylesheet matters) until it answers, so the login screen does not flash.
- **Both ways in go through `App.jsx`'s `signIn`**, never `setUser` directly: it clears the session picklist cache (the cached assemblies are the *previous* user's grants) and calls `prefetchSession()` so `getProposalElectionTypes` and `getUserAccessAssemblies` are already in flight by the time the Dashboard mounts.
- Logout and the 401 handler clear the cache and call `clearToken()` — logout *after* awaiting `/logout`, since that call is behind the auth guard. `clearToken` is deliberately not folded into `clearSessionCache`: `signIn` runs the cache clear on the way *in*, which would wipe the token `login()` had just stored.
- **The two PSA services take the same token** as `authToken` — one login, one token, two backends. That is why `getToken()` is exported from `api.js` rather than kept private.
- **`committeeApi.js` is the exception, and it is a security debt.** Every Committee call sends `COMMITTEE_STATIC_TOKEN`, a hardcoded JWT, because that service has no per-user token issuance wired up yet. It expires; when it does, the whole Committees Assign screen 401s until the string is replaced. Swap it for a per-session token as soon as the backend can issue one.
- **`uploadNominationFile` sends no `Authorization` header** (it builds its own `fetch` to get multipart right and skips `authHeader()`). If that endpoint is ever put behind the auth guard, it breaks — fix it there, not by working around it in the caller.

## The `leap/` module

```
leap/
  Leap.jsx            ad-hoc router
  api.js              the /leapapi client + the two loading hooks
  cadreSearchApi.js   PSA Cadre/search
  cadreNotesApi.js    PSA Cadre notes (4 endpoints)
  committeeApi.js     PSA Committee + CommitteeWebService
  casteList.js        hardcoded caste picklist (no migrated endpoint exists)
  data.js             seed dataset — dead, see below
  Leap.css            ~6000 lines, every class in the module
  components/         one file per screen
  components/committee/  the Committees Assign panels
```

`Leap.jsx` is a short router around a `view` discriminated object (`{ name, ...payload }`). Adding a screen means adding a `view.name` branch, not a route.

**Screens stay mounted once opened.** `Leap.jsx` tracks `opened` and renders each visited screen inside a `hidden` wrapper rather than unmounting it — these components hold their selections in their own state and nowhere else, so unmounting one on a sidebar click threw away the assembly, the six wizard steps or the candidate filters and re-fetched everything on the way back. The last navigation payload per screen is kept in `args` (not read off `view`), because the sidebar navigates with a bare `{ name }` and reading it off `view` would drop the payload, change the key, and remount — the very thing this fixes. `screen()` is a plain function, not a component, for the same reason.

Committees Assign is the exception to "mounted means fresh": its panels fetch their overview once on mount and its numbers can go stale from work done elsewhere, so `committeesAssignNav` is bumped on every sidebar arrival and threaded into that screen's remount keys.

Below 1025px the sidebar is an off-canvas drawer (`navOpen`, `.leap-scrim`, `.leap-nav-toggle`); Escape closes it and focus returns to the opener.

### Screens

| Component | Reached via | Notes |
|---|---|---|
| `Dashboard` | `view.name === 'dashboard'` (**initial**, and the sidebar) | One assembly's whole election, both tiers at once, from `getDashboardPositions` plus one drill-down call |
| `NewPositionModal` | `'newPosition'` — sidebar "Assign Members", or the Dashboard's Assign button | 6 steps, each revealed when the previous is filled. Takes an optional `initial` prefill for steps 1–4 |
| `Candidates` | `'candidates'` — sidebar "View Members", or the Dashboard | Every position holding candidates, state-wide, in a sortable/exportable table |
| `CadreSearchNotes` | `'cadreSearch'` — sidebar "Cadre Search" | PSA directory search; per-cadre notes behind an entitlement |
| `CommitteesAssign` | `'committeesAssign'` — sidebar, **only with the `CADRE_COMMITTEE_MANAGEMENT` entitlement** | KSS / CUBS / Main-and-Affiliated committee management against the PSA services |
| `Sidebar` | always | Two groups: LOCAL BODY ELECTIONS (collapsible, open by default) and CADRE. Footer shows `firstname lastname` falling back to `username`, and logout |
| `PositionDetail` | `'detail'` | **Unreachable** — nothing sets this view |
| `AllPositions` / `PositionCard` | `'positions'` | **Unreachable** — nothing sets this view |

Entitlements come off the login response (`user.entitlements`). `CADRE_COMMITTEE_MANAGEMENT` gates only whether the Committees Assign nav entry is inserted — every account still lands on the Dashboard. `CADRE_PROFILE_NOTES_PUBLIC_ADD` (or `user_id === 1`) gates the Add Note button.

### `Dashboard` (1350 lines)

Where a session lands. **One list endpoint for the whole screen, everything else derived client-side.**

`getDashboardPositions(constituency_id)` returns every `proposal_position` under the chosen assembly across every election type and every local body — a LEFT JOIN, unlike `getProposalPositionsWithCandidates`'s INNER, which is what makes a position nobody was proposed for countable.

- **The assembly picklist is `getUserAccessAssemblies` and it pre-fills.** `user.constituency_id` (the user's home constituency, from the `user` table — *not* the grants list) selects itself when it is one of the granted assemblies, else the first granted one. `getDashboardPositions` is unscoped by grants, so the assembly has to come off the list the server vouched for.
- **`useLoadable`, not `useList`, for the assemblies**, and a hand-rolled fetch for the positions: `rows === null` is loading, `[]` is loaded-and-empty, and they render differently (`DashboardSkeleton`, shaped like the real layout, versus an empty-state sentence). No grants at all gets its own message.

**`ELECTION_TIERS` is a hand-written tree, and that is deliberate.** Two tiers (Panchayat Raj — blue; Local Body — red), each holding bodies (Mandal Parishad, Zilla Parishad / Municipality, Municipal Corporation, Gram Panchayat), each holding post cards. It is written down rather than derived from the rows because **the tree is the *plan*** — a post nobody has configured a proposal constituency for yet still has to appear as a static "Not configured" card, or the screen would pretend half the election does not exist.

- A card claims rows by `types` (matched against `election_type`) and, when it shares a type with a sibling, by `roles` (matched against `role_name`). Both are compared through `norm()` — lowercased, non-alphanumerics stripped — so `Vice-MPP` and `Vice MPP` are one name.
- **The names must match the `proposal_election_type` rows exactly (after `norm`), and several are non-obvious**: the ZP chair cards claim `'Zilla Parishath'` (the row's own spelling — the shorthand alone matched nothing and both chair cards read "Not configured" however much data the district held); the MPP/Vice-MPP and Corporator cards claim `'MPTC'` because those rows are filed under it, and rely on their `roles` list to not swallow the MPTC members.
- **Anything the tree does not claim is still shown.** Unmatched rows are grouped by `(election_type, role_name)` into an "Other" body appended to the last tier. The tree is a guess about naming; a wrong guess must never hide live data. **If a post reads "Not configured" but the data exists, look in Other first** — that is the tell that a name changed in the database.
- Both tiers render side by side (`.leap-dash-tier-columns`, stacking below 1281px). The tier headline is `Σ proposed_cnt / Σ max_proposals` — every live candidate whatever their status, so confirming one must not make the figure drop.
- A post card reports **`Σ conformed_status_cnt / Σ max_positions`** — "seats confirmed". Different unit from the tier bar above it on purpose: the tier measures proposal slots in play, the card measures how much of the post is actually settled. (`conformed_` throughout is the SQL alias, kept when the status was renamed to Confirmed. It is not a label.)
- The first card with rows opens itself, so the screen lands with numbers on it. A refresh keeps whichever post was open.

`ElectionTypeSection` is one open post's stats and location table:

- **Two `StatCard`s, not six tiles.** TOTAL LOCATIONS carries Started / Not Started / Confirmed / View Reservations; POSITIONS carries one row per role (`conformed_status_cnt / max_positions`), Max proposals, Proposed and Nominations. Rows either filter the By Location table below (and scroll to it, via `filterTick` so the scroll runs after it renders) or open a drill-down.
- **The nomination status is two states, not three**: `Started` when any role at that location has a `started_time`, else `Not Started`. There is no Completed any more — `NOMINATION_RANK` and `STATUS_FILTERS` reflect that, plus `Reserved only`, which is not a status and is counted separately.
- **Assign vs View.** Assign hands the wizard a full `prefill` (`electionTypeId`, `assemblyId`, `locationKey` as `m:<tehsil_id>` / `t:<town_id>`, `proposalConstituencyId`, `membersAction: 'add'`). It is disabled with no open proposal slot, **and disabled for a district-level body with neither `tehsil_id` nor `town_id`** — the wizard reaches a local body only through a mandal or a town, so Zilla Parishath would dead-end in an empty step 3. View opens `PositionCandidatesModal` (imported from `Candidates.jsx`) over the roles that actually hold candidates.
- **`CandidateStatusSection`** is the Proposed/Confirmed drill-down: `getDashboardCandidatesByStatus` per election type id (the endpoint is scoped by type, a card can span several), then filtered down to the roles this card covers. It renders **in place of** the By Location table, so the section never has two things open. The `idsKey`/`rolesKey` joins exist because the parent rebuilds both arrays every render — passing the arrays would re-fire the effect forever.
- **Confirmed rows carry the nomination PDF column.** `uploadNominationFile` (multipart) accepts PDFs only, patches `nomination_file_path` in place on success rather than refetching (so the row order and scroll do not jump), and keeps per-row `uploading`/`uploadErrors` maps so one row's failure never blanks the table. `getNominationFileUrl` is fetched **fresh on every view click** — the presigned link expires in 5 minutes, and caching it would just move the failure.

### `NewPositionModal` (1164 lines — read it before changing anything here)

Six steps, top to bottom in one scrolling panel, each gated on `stepNDone`:

1. **Election type** — `getProposalElectionTypes`, as a grid of icon chips. Icons are inline SVGs keyed by `election_type` in `ELECTION_TYPE_ICONS`; unknown names fall back to `IconHouse`. A selected chip wears its tier's tone via `PANCHAYAT_RAJ_TYPES` (MPTC/ZPTC/MPP/ZP = blue, everything else red), so the wizard and the Dashboard agree about which half of the election you are in.
2. **Assembly** — `getUserAccessAssemblies`, `searchable`.
3. **Mandal / Town / District** — `getMandals` + `getTowns`, **filtered by election type**: `MANDAL_ONLY_TYPES` (ZPTC/MPTC/MPP) show mandals only, `TOWN_ONLY_TYPES` (Municipality, Corporation, Municipal Ward, Corporation Ward, GMC Ward) towns only, anything unlisted gets both merged. This is why Municipality used to offer mandals and then report itself "not configured". The two halves resolve through different endpoints, so option values stay tagged `m:<tehsil_id>` / `t:<town_id>` and are split by `locationKey.split(':')` — keep that encoding.
4. **Local body** — `getProposalConstituenciesByTehsilId` (for `m:`) or `…ByTownId` (for `t:`). Its heading is the step-1 election type name. Auto-selects when exactly one row comes back.
5. **Reservation & Members** — `getProposalPositionsOverviewByProposalConstituencyId` for the roles, seat counts **and each role's own `reservation_type`**, then a fork: View Members or Add Members. **There is no `getReservation` call any more** — the reservation is a `proposal_position` column, because two roles under one local body routinely reserve differently (a President BC-GENERAL beside a Vice-President ST-WOMEN). **A "seat" in the header strip is a `max_proposals` slot**: total is `Σ max_proposals`, filled is `Σ proposed_cnt`. `max_positions` is shown separately, per role card.
6. **Cadre search** — `AddMembersPanel`, mounted **keyed by `proposal_position_id`** so picking another role remounts it and clears the staged list. The Candidates screen no longer mounts it; the wizard is now its only caller.

Selecting anything at step *N* clears steps *N+1…6*. Arriving with a `prefill` scrolls to the role list, then to Cadre Search once a role reveals it — only for a prefilled arrival, since walking the wizard by hand already leaves you where you were.

**View Members** fans `getProposalCandidatesByProposalPositionId` over every role (`Promise.all`), renders each cadre as a `MemberCard`, and fills scores through `loadScores`. `members[id] === undefined` means the call is in flight, `[]` means it returned none; the two render differently. There is **no remove button here** — this branch is read-only.

**Add Members** shows the roles as cards (each with its own reservation badge, `max_positions`, `proposed_cnt` and open count), disabled when `max_proposals - proposed_cnt <= 0`. A lone open role auto-selects.

#### `AddMembersPanel` — search, stage, save

**Three search types** (`SEARCH_TYPES`): Membership ID, Mobile No, Name. Two paths behind them:

- Membership ID and Name go to `/cadreSearch`, which returns rows already carrying the eligibility flags.
- **Mobile No goes to the PSA directory instead** (`DIRECTORY_TYPES`). `/cadreSearch` matches a mobile exactly but state-wide, so it returned cadre in any assembly that then refused to stage; the directory takes a constituency. A directory row knows nothing about this position's reservation, so the picked cadre is **looked back up through `/cadreSearch` by `CadreId`** (falling back to `MembershipId`) before being staged — that search is still what says whether they are eligible. Do not restore the old Name fallback there: it was a `LIKE '%name%'` over every cadre in the state.
- `sanitizeSearchValue` caps membership id at 8 digits and mobile at 10, on typing and on paste. A name must be at least `MIN_NAME_LENGTH` (4), enforced in `cadreSearchApi.js` so every caller inherits it.
- One match stages straight away; several put a picker up (`matchInfo` normalizes the two response shapes, and a match's photo enlarges rather than picks when clicked — often the only way to tell two cadre of the same name apart).

**A search stages a cadre, it does not assign one.** `staged` holds the rows; `scores` holds each `getCadreScores` row keyed by `membership_id`, fetched **one membership id at a time** (`loadScores`) — the endpoint is lookup-first, and one unrated cadre running two stored procedures (~1.6s) must not hold up every badge on the screen. `stagedByScore` sorts best-first with unscored last (`?? -1`), never as zeros.

**The staged card's only status button is `Propose Candidate`.** `PROPOSAL_STATUSES` has one entry now; Shortlisted (2) and Confirmed (3) still exist in `STATUS_META` **to be read**, since saved rows carry them, but this screen writes neither. Every staged card is saved whether or not its button is lit — an untouched one goes in as `DEFAULT_STATUS_ID`.

`assignStaged` calls `assignProposalCandidate` **sequentially, in score order** — the proposal slots are exactly what the staged candidates compete for and the server re-checks the count on every write, so it has to see them one at a time. A batch can partly succeed: whoever went in is dropped from `staged` and named in the success line, the rest stay staged with the endpoint's own `{detail}` text. A success bumps `positionsKey` so the overview re-reads.

#### Shared pieces exported from this file

`MemberCard`, `PhotoViewer`, `Dropdown`, `initials`, `memberIds`, `loadScores`, `STATUS_META`, `AddMembersPanel`. Dashboard, Candidates and CadreSearchNotes all import from here rather than copying — a cadre must look identical on every screen.

`MemberCard` is the membership-analytics `cand-card`, field for field: a header (photo, name, score badge tinted by `scoreTier`, "Proposed for &lt;role&gt;", membership-id and mobile pills) over `PROFILE` and `LOCATION & MEMBERSHIP` on a six-column grid the fields `span`. **The fields this backend cannot fill are still rendered, as `—`** (Date of Birth, Occupation, Education, Parliament, Caste Community %) so the two cards read the same; Voter ID and Panchayat are the only additions. `onRemove` is what distinguishes a staged card from a saved one: with it the card loses the live dot and the status block and reads "Considered for" rather than "Proposed for" — nothing is proposed until you assign. Member Since and Renewals come from the rating row's `'YEAR'` and `'NO OF TIME'`; the badge is `total_score`.

`Dropdown` is a hand-rolled `<select>` replacement, used by steps 2/3/4, the search-type picker and the Dashboard's assembly filter. It exists because Chrome flips a long native popup *upward*; this one always drops below. `searchable` adds a filter input. Closes on outside `mousedown` and on Escape.

Candidates use the **backend cadre shape** everywhere (`member_name`, `membership_id`, `mobile_no`, `category_name`, `panchayat_name`, `mandal_town_name`, `img_url`, …) — not `data.js`'s `candidate()` shape.

### `Candidates`

**One endpoint, all the filtering in the browser.** `getProposalPositionsWithCandidates` returns every `proposal_position` with at least one active candidate — the join is inner, so a position nobody was proposed for never appears — carrying election type, assembly, mandal/town, local body, role, reservation, slot counts and the per-status breakdown (`proposed_status_cnt` / `shortlisted_status_cnt` / `conformed_status_cnt`). It takes no query parameters on purpose: the five filters (Election Type, Assembly, Role, Status, Reservation) get their options from the *unfiltered* rows, so filtering server-side would empty the dropdowns the filter was picked from. Status filters positions holding at least one candidate of it, not the cards inside; `STATUS_FILTERS` here offers Proposed and Confirmed only — a position whose candidates are all Shortlisted shows `—` in that column rather than a pill.

Rendered through the shared `DataTable` (`components/committee/DataTable.jsx`) with `hideToolbar`, because this screen owns its own search box and CSV button and hands the table rows already searched — `searchRows` and `exportCsv` are exported from there for exactly that.

Fetched by hand rather than through `useList`: this is the one screen with a single endpoint behind everything it shows, so a failure has to read as "the server did not answer" and not "nobody has been proposed yet".

**This screen is read-only now.** It does not write statuses, does not remove candidates, and does not mount `AddMembersPanel` — `updateProposalCandidateStatus` and `removeProposalCandidate` are still exported from `api.js` and are called by nothing (see Known dead). Opening a row opens `PositionCandidatesModal`, which is exported from this file and is also what the Dashboard's per-location View icon uses: `getProposalCandidatesByProposalPositionId` per position plus `loadScores`, cards ranked best-score-first with unscored last, re-sorting on their own as the scores land.

### `CadreSearchNotes` + `CadreNotesModal`

Straight against the PSA service, nothing to do with `/leapapi`. Four search types (Membership ID / Voter ID / Mobile No / Name) with per-type sanitizing, optionally scoped to an assembly picked from `getUserAccessAssemblies`. Result cards render whatever fields came back rather than a hand-picked set.

`CadreNotesModal` is the notes CRUD (`getCadreNotesByUser`, `getCategoryNotes`, `saveCadreNotesInformationDetails`, `deleteCadreNotesData`) behind the `CADRE_PROFILE_NOTES_PUBLIC_ADD` entitlement. It is a `contentEditable` + `execCommand` editor — deprecated, but the notes API stores raw HTML and this is the zero-dependency way to produce it. Attachments are base64 in the request body, capped at 5 MB. The load effect passes an `AbortSignal` so a cadre change mid-flight cancels the stale request outright.

### `CommitteesAssign` + `components/committee/`

The largest subsystem after the Dashboard (~2200 lines across nine files), and the one whose contract is least certain — **every endpoint, payload shape and magic id in `committeeApi.js` is copied from the legacy screens' own working calls (`committessBlockSection.js`, `cadreCommittee.txt`) rather than derived from a spec.** Where the migrated webservice doc and the legacy code disagree, the code won. The file's comments say which values are confirmed against a live call and which are inferred (`locationScopeId: 9`, `'unit'`/`'cluster'` location types, `committeeLevelId: null`) — **do not tidy those comments away; they are the only record of what has actually been observed.**

Structure: an assembly that self-selects the same way the Dashboard's does, then two tabs.

- **CUBS** — a radio of KSS / Booth (15) / Unit (16) / Cluster (17).
  - `KssPanel` (681 lines): five overview tiles, each opening a `KssDrilldownModal` table; Create KSS and Create KSS & Assign Members forms over booth + serial-no range (`getNextSectionSerialNo` prefills, and re-runs after a save because a new section moves the booth's next range forward); staging cadre through `useMembershipSearch` with a caste picked from the hardcoded `casteList.js` (no migrated endpoint for it exists).
  - `CubsPanel`: convenor / co-convenor coverage for the selected level, the location-by-location breakdown behind it, then one location's own committee through the shared `CommitteeSnapshotPanel`.
- **Committees** — `MainCommitteePanel`: Village-Ward / Mandal-Town-Division / Constituency levels × Main/Affiliated type, resolved down to the one `getCommitteMembersInfo` snapshot that carries both the designation list and the member list.

`CommitteeSnapshotPanel` is the shared View/Add half every "committee at one location" flow ends in — the `checkIsVacancyForDesignationNew` → `committeTdpCadreSaveRegistration` pair lives there once rather than in two drifting copies. **Mount it keyed by whatever identifies the location**; it owns its own mode and add-flow state. Booth Wise swaps in `KssDesignationSearch` (the booth-scoped search that also knows who is already on the committee) via its search-scope prop.

Known rough edge, documented in `committeeApi.js`: `checkDesignationVacancy`'s legacy response was plain text, and `post`'s `res.json().catch(() => null)` turns a parse failure into `null`, which the caller reads as "no problem". Check that first if a designation search box opens when it shouldn't.

### `Frontend/src/leap/api.js`

One thin `get`/`post` pair over `${API_BASE}/*`, one named function per endpoint, plus the two loading hooks. `post` unwraps FastAPI's `{detail: "..."}` into the thrown `Error.message`, which is what the assign error banner shows.

**`useLoadable(load, deps)` is the implementation; `useList` is a one-line wrapper over it.** `useLoadable` returns `{items, loading, error}`; `useList` returns `.items` alone — `[]` until the promise resolves **and `[]` again on failure**, logging rather than surfacing, which is why a failed picklist is indistinguishable from an empty one for every caller that still uses it. Reach for `useLoadable` when the difference matters.

**`getProposalElectionTypes` and `getUserAccessAssemblies` are cached for the session** (`cached(key, load)` memoizes the *promise*, so two components mounting in the same tick share one request; a rejection drops the entry so the next mount retries). **`clearSessionCache()` must run whenever the identity behind the session changes** — login, logout and the 401 handler all call it, because the assemblies are that user's own grants. `prefetchSession()` warms both the moment the session is known.

**The assemblies picklist is `getUserAccessAssemblies`, not `getAssemblyConstituenciesInAState`** — it is the assemblies this user is granted, resolved from the token's user id. The state-wide endpoint still exists on the backend and is no longer called from here.

**No write sends a user id to `/leapapi`.** `assignProposalCandidate` stamps `inserted_user_id` from the session, server-side — the frontend has no `user_id` to pass and must not start passing one, since a body-supplied id would let a browser forge the audit trail. (The PSA committee writes are the opposite: `userId` is a required field there, taken from `user.user_id`.)

`getCadreScores(mids)` answers `{configured: false, candidates: []}` rather than failing when the ratings database is unset on the server — a state the UI renders ("No score"), not an error. **The score half is optional; the profile half never is** — every profile field comes off the search/candidate row the caller already had.

Both `get` and `post` route a `401` through `checkUnauthorized` before throwing: it calls the handler `App.jsx` registered via `setUnauthorizedHandler`, which clears the token and returns to the login screen. **`AUTH_PATHS` (`/login`, `/me`, `/logout`) is exempt and must stay that way** — `/login` answers `401` for bad credentials and `/me` answers `401` on a normal first visit, so treating those as expiries would wipe the login form's own error banner. Only `401` triggers it: a `429` from the login throttle and a `500` from a dead backend must not log anyone out. Adding an endpoint that can legitimately `401` without meaning "session over" means adding it to `AUTH_PATHS`.

## Traps to know before editing

**"Step N" is the wizard's own numbering, not an endpoint's.** Endpoints are named, not numbered. Wizard step 3 calls `getMandalsInAConstituency` + `getTownsInAConstituency`, step 4 calls `getProposalConstituenciesByTehsilId` *or* `…ByTownId`, step 5 calls `getProposalPositionsOverviewByProposalConstituencyId` (+ `getProposalCandidatesByProposalPositionId` in the view branch), step 6 calls `cadreSearch` + `getCadreScores` + `assignProposalCandidate`. Say which you mean.

**Candidate eligibility is the assembly, then the reservation.** A cadre's `user_address.constituency_id` has to equal the proposal constituency's own assembly — but nothing below it does, so any mandal, panchayat or town inside that assembly is fine. On top of that comes the position's reservation: `caste_category_id` when set, and `gender = 'F'` when set. All of it comes from `proposal_context()` in the backend repo's `main.py`, the reservation SQL from `eligibility_flag()` there. Change eligibility there, not in this repo. A cadre with no caste category on record compares NULL and so is ineligible.

**`cadreSearch` flags both, it filters neither.** The assembly comes back as `in_assembly` (`'Y'`/`'N'`) and the reservation as `eligible` — `eligibility_flag()` returns a SELECT expression, not a WHERE clause. `stage()` checks `in_assembly` first, since "Provided ID belongs to another assembly (&lt;their assembly&gt;)" is a different fix for the user than a caste mismatch; only rows with both flags `'Y'` are staged. That is deliberate: "no cadre has that membership id" and "that cadre is barred by the reservation" are different states and the panel says different things for each. `assignProposalCandidate` re-checks both rules on write — the search filter is only what the browser was shown — and answers `409` with the reservation type, or "Cadre belongs to a different assembly constituency", in `detail`.

**Scores come from a second, optional database.** `getCadreScores` reads `report_ratings` — `cadre_performace_report` (the table's name really is spelt that way) for the per-category points and `leader_feedback` for the per-question ones. **Total Score is half of each**: `(Σ the 11 POINTS columns ÷ 2) + (Σ the feedback answer points ÷ 2)`, and it is `null` — never `0` — when a cadre has neither, so unrated does not sort as worst. It is *lookup-first*: an existing report row is served from the table, and the `cadre_performance_update` / `cadre_performance_report` procedures (seconds per id) run only for the rest — which is exactly why `loadScores` calls it one id at a time.

**`conformed_status_cnt` is a SQL alias, not a spelling mistake to fix.** It kept its old name when the status was renamed to Confirmed. Same for `proposal_consituency_id` (one `t`) in the step-4 rows, and `STATUS_META[3].cls === 'conform'`, which is a CSS class and not a label.

**`NewPositionModal` is neither new-position nor a modal.** The name, the `leap-modal-*` class prefix, and its own heading all date from when it was a creation wizard that handed a position back to `Leap.jsx`. It now proposes candidates against positions that already exist and creates nothing. Renaming it means touching the class names too, so it has been left alone — just don't read the name as a description.

**Branding is not centralized.** `Sidebar.jsx` and `Login.jsx` hardcode "Telugu Desam Party", `index.html` titles the app "Local Body Election", and `data.js`'s `PARTY_NAME` says "Praja Vikas Party" and is imported by nothing reachable. Grep for all of them.

**The stage pipeline is truncated — and entirely inside dead code.** `STAGES` has 2 entries while its consumers assume 5–7. None of them render, so none of this is a live bug; it is a landmine for anyone restoring those screens. `stagesFor(kind)` returns the same array for both kinds; seed `stage:` values go up to 5; `PositionCard` does `STAGES[position.stageIndex].full` unguarded and **throws** for any position with `stageIndex >= 2`; `summary()` and `stageCounts()` produce zeros and `NaN`s. `PositionDetail` guards and merely degrades. If you touch `STAGES`, check every one of those.

## Styling

`Frontend/src/leap/Leap.css` (~6000 lines) holds every class for the leap module; `Login.css` (~190) covers the login screen; `index.css` is the reset plus `.app-splash` (which has to paint before `Leap.css` is loaded at all). Classes are flat and prefixed `leap-`. No CSS modules, no utility framework — add styles to the existing file matching the surrounding naming. Fonts (Montserrat, Inter) load from Google Fonts in `index.html`; Font Awesome comes from the npm package via `main.jsx`.

Anything that moves — the skeleton shimmer, the progress-bar fill, the splash spinner — has a `prefers-reduced-motion: reduce` branch that stills it without removing the signal. Keep that when adding animation, and note the wizard's prefill scroll checks the same media query before choosing `smooth`.

A large share of the file styles components that no longer render (`.leap-card-*`, `.leap-stage-*`, `.leap-candidate-*`, `.leap-detail-*`, …). Grep the JSX before assuming a rule is live — and before deleting one, since the dead components still reference them.

## Known dead / inert code

Mention rather than silently remove:

- **`PositionDetail.jsx` (339 lines)** — unreachable since `createPosition` was dropped from `Leap.jsx`. Still imported. It is an older second implementation of what the wizard's steps 5–6 do.
- **`AllPositions.jsx` / `PositionCard.jsx`** — unreachable. `AllPositions`'s `onNewPosition` prop is never passed and it renders `st.nomOnly`, a field `STAGES` entries no longer have. It also reads `filter !== 'all'` while `view.filter` starts `undefined`, so its reset button would always show.
- In `Leap.jsx`: `positions`, `advanceStage`, `openPosition` and the `POSITIONS` import exist only to feed those two branches.
- **`data.js` is now entirely dead** — `PARTY_SHORT` was its last live export and `Sidebar.jsx` no longer imports it.
- **Three `api.js` exports are called by nothing**: `checkPositionAvailability`, `updateProposalCandidateStatus` and `removeProposalCandidate`. The latter two went dead when the Candidates screen became read-only; the backend endpoints still exist, so restoring status editing or removal is a UI change, not a backend one.
- Backend `getProposalPositionsByProposalConstituencyId` is unused by the frontend — the overview endpoint carries the role names and counts that make it redundant.
- `Frontend/src/circle.svg` is used only by the login screen.
