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

`vite.config.js` proxies `/leapapi/*` to `http://127.0.0.1:4000`, rewriting the `/leapapi` prefix to `/portal-frontend-code`, configured identically for `dev` and `preview`. That target is the PSA gateway (`gateway.py` in the backend repo), which mounts each project's FastAPI app under a prefix named after the project — so the prefix is swapped, not stripped. Inside the mount the portal backend still sees its own bare paths (`/S14login`, …), because the gateway's `StripPrefix` removes the mount from `scope["path"]`. Merged Swagger for every project is at `http://localhost:4000/docs`. **The prefix is `/leapapi`, not `/api`, on purpose** — on the deployed host (`portalnew.mypartydashboard.com`) `/api` is already routed to the older party dashboard service, whose own routes live under `/api/v1`, so `/api/S14login` answers `404` from that service and never reaches this backend. The backend lives in a **separate repository** — it is not in this tree — and must be running and reachable at that `target` for anything to work. **When it isn't, every picklist is silently empty** — `useList` swallows fetch errors, so a dead backend looks exactly like a state with no assemblies in it. Check the console and network tab first when the wizard renders but won't populate. Note that this is now the signature of a *dead backend specifically*: a `401` no longer lands here, because `api.js` intercepts it and sends the app back to the login screen (see below), so a blank wizard means the backend is unreachable rather than the session having lapsed.

Deployment: `./install.sh` **from the repo root** installs frontend deps, builds, then (re)starts `portal-frontend` (`vite preview` on 9001) under PM2 using the root `ecosystem.config.cjs`. Frontend only — the backend is deployed from its own repo.

## What this is

A prototype of a nomination workflow for local body elections, styled as a party internal portal. React 18 + Vite SPA, plain JSX with hand-written CSS, backed by a FastAPI + PyMySQL service that lives in a **separate repository** (this repo is frontend-only). **No router, no tests, no state library.** The only frontend deps are `react` and `react-dom`.

The reachable flow is backend-driven end to end and holds **no application state of its own**: picklists, reservation, positions, cadre search, candidate assignment and the member list all hit the database, keyed by ids the user picks. Nothing survives in memory across a reload except the wizard's own selections, and nothing needs to — `proposal_position_id` is the only handle the writes use.

**The reachable app is `Sidebar` + `NewPositionModal` + `Candidates`.** `NewPositionModal` is a single scrolling screen that does everything (pick a body → view its members, or add one), takes no props, and never navigates; `Candidates` is the read-across-everything counterpart, reached from the sidebar. Everything else in `leap/` — the `positions` dataset, `PositionDetail`, `AllPositions`, `PositionCard`, `Dashboard`, and the whole `STAGES` pipeline — is unreachable. See "Known dead / inert code".

Two top-level screens, switched by a boolean in `Frontend/src/App.jsx`:
- `Frontend/src/Login.jsx` — real login. `handleSubmit` posts to `S14`, which validates the credentials against the `user` table, and calls `onLoginSuccess(user)` only on `200`; a `401` renders in `.login-error`. S14 opens a server-side session and sets an **httpOnly** cookie, so the token is never reachable from JS and there is nothing in `localStorage` to steal. `App.jsx` cannot read the cookie either — it calls `S15` on mount to ask whether a session is live, which is what makes a reload keep you logged in, and renders `null` until that answers so the login screen does not flash. `onLogout` calls `S16`, which drops the session server-side. **Every endpoint except S14 requires the session.**
- `Frontend/src/leap/Leap.jsx` — the actual app.

## The `leap/` module

`Leap.jsx` is a 48-line ad-hoc router around a `view` discriminated object (`{ name: 'newPosition' | 'positions' | 'detail', id?, filter? }`). Adding a screen means adding a `view.name` branch, not a route.

**`view` starts at `newPosition` and only the sidebar changes it**, between `newPosition` and `candidates` — `Sidebar`'s `onNavigate` is the one live `setView`. The others live inside props passed to `AllPositions` and `PositionDetail`, neither of which renders, so `detail` and `positions` stay unreachable. `Leap.jsx` still holds `positions` (seeded from `POSITIONS`) and `advanceStage` for those two branches; both are effectively dead. `createPosition` was removed when the wizard stopped producing positions — nothing constructs a local position object any more, so the `_newId` counter is gone too.

### Screens

| Component | Reached via | Notes |
|---|---|---|
| `NewPositionModal` | `view.name === 'newPosition'` (initial, and permanent) | The whole app. 6 steps, each revealed only when the previous is filled |
| `Candidates` | `view.name === 'candidates'` (sidebar) | Every position holding candidates, state-wide, filtered client-side; opens one position full-screen |
| `Sidebar` | always | Two nav buttons, `NAV` in that file, each switching `view.name`. Footer shows the logged-in user (`firstname lastname`, falling back to `username`) and a logout button that clears `App.jsx`'s `user` |
| `PositionDetail` | `view.name === 'detail'` | **Unreachable** — nothing sets this view since `createPosition` was removed |
| `AllPositions` | `view.name === 'positions'` | **Unreachable** — nothing sets this view |
| `PositionCard` | rendered by `AllPositions` | therefore also unreachable |

### `NewPositionModal` (844 lines — read it before changing anything here)

Six steps, rendered top to bottom in one scrolling panel, each gated on `stepNDone`:

1. **Election type** — S1, as a grid of icon chips. Icons are inline SVG components in this file, keyed by `election_type` name in `ELECTION_TYPE_ICONS`; an unknown name falls back to `IconHouse`. A new election type in the DB shows up with the house icon until you add one.
2. **Assembly** — S2, `searchable` (the list is every assembly in the state).
3. **Mandal/Town** — S3 + S4 merged into one picklist. The two halves resolve through different endpoints, so option values are tagged `m:<tehsil_id>` / `t:<town_id>` and split back apart by `locationKey.split(':')` — keep that encoding.
4. **Local body** — S5 (for `m:`) or S6 (for `t:`). Its heading is `localBodyLabel`, i.e. the step-1 election type name. Auto-selects when exactly one row comes back.
5. **Reservation & Members** — S9 for the reservation badge, S7 for the roles and the Total / Filled / Unfilled seat counts, then a fork: **View Members** or **Add Members**. **A "seat" here is a `max_proposals` slot, not a `max_positions` one**: total is `Σ max_proposals`, filled is `Σ proposed_cnt`, and unfilled is the difference — so two roles of three read as six seats with each candidate proposed filling one. That is the same number the per-role "N open" badges count down; `max_positions` is shown separately, as the role's "N seat(s)".
6. **Cadre search** — S12 search (membership id only), S17 score, S11 assign. Only rendered in the `add` branch, once a role is picked. It is `AddMembersPanel`, exported from this file and mounted **keyed by `proposal_position_id`** — picking another role remounts it, which is what clears the staged list, the picked statuses and the banners. The Candidates screen mounts the same component (see below), so both live paths to a proposal are one implementation.

### `CompareModal`

Side-by-side comparison of cadre, one column each, opened from the staged list in step 6 and from any View Members role holding more than one cadre. Takes cadre rows in the **backend's own shape**, reads the header's name/photo/chips straight off them and fetches only the score half, via `getCadreScores`. **The table is scores alone** — the profile fields it used to repeat as rows are on the column header and on the member card, and listing them again pushed the first weighted section off the screen. Columns are drag-reorderable (with edge auto-scroll while a drag is live, since a column past the right edge could otherwise never be dropped on the left one) and individually dismissable, both view-only; the header of the highest `total_score` column carries a ★ TOP flag, and only when someone actually has a score, since with the ratings database unwired every column is `null` and there is no winner to point at.

Its layout mirrors the membership-analytics platform's own compare table (`PositionDetailScreen.jsx` in that repo), so the two read the same way: a sticky metric column and sticky candidate headers, then `PERFORMANCE_SECTIONS` — the weighted groups (`PEDALA SEVALO 15%`, `D2D CAMPAIGN 30%`, …) whose rows name the report's own column names (`'ACH % (Booth D2D)'`, `'BOOTH 15%'`, …), which is why S17 returns the row unrenamed. **Only `pts`/`score` rows carry the best-of highlight**, and only when the maximum is unique — a tie has no winner to point at. Two things that platform shows are absent here because this backend has no endpoint for them: `MY TDP APP USAGE` and the per-candidate Documents overlay. `PREVIOUS POSITIONS` reads the report's `'2018 - 2020'` / `'2016 - 2018'` / `'2014 - 2016'` columns rather than that platform's `cadre_details.previous_role`.

Selecting anything at step *N* clears steps *N+1…6* (the `select*` handlers). Picking a different role additionally clears the search results, selection, error and success text.

**View Members** fans S13 out over every role from S7 (`Promise.all`, one call per role), then makes **one** S17 call for every membership id the whole fan-out returned, and renders each cadre as a `MemberCard` — the membership-analytics `cand-card`, field for field: a header (photo, name, score badge tinted by `scoreTier`, "Proposed for &lt;role&gt;", membership-id and mobile pills) over `PROFILE` and `LOCATION & MEMBERSHIP` on a six-column grid the fields `span`. **The fields this backend cannot fill are still rendered, as `—`** (Date of Birth, Occupation, Education, Parliament, Caste Community %) so the two cards read the same; Voter ID and Panchayat are the only two fields added, because that card has no slot for them. Colour carries meaning and matches: caste by category (BC/OC/SC/ST), Member Since and Renewals green, Caste Community % amber. Everything comes off the S13 row except **Member Since** and **Renewals**, which are the report's `'YEAR'` and `'NO OF TIME'`, and the badge, which is `total_score`. That S17 call is decoration on a list that already rendered, so its failure is logged and the badge and those two fields go blank rather than the view erroring. `img_url` is an S3 URL built by S12/S13 and is `''` when the cadre has no photo — the card falls back to `initials()`. Clicking a photo opens the `zoomed` lightbox. `members[id] === undefined` means S13 is still in flight, `[]` means it returned none; the two render differently.

Each member card carries **its status where a staged card carries the two buttons** — a read-only `.leap-mcard-status` block reading Proposed / Shortlisted / Confirmed off `STATUS_META[cadre.proposal_status_id]`, defaulting to Proposed for the rows that predate the column. It is deliberately not clickable *here*: this screen writes a status (S11) and never
changes one — changing one is the Candidates screen's job, via S20. The ✕ on the header **removes the member** — `removeMember` confirms, calls S18 and bumps `positionsKey`, which re-reads S7 *and*, because `positions` is then a new array, re-runs the effect that loads the members, so the card and the open-slot counts update from one bump. A failure renders in `membersError`, since step 6's `error` banner is not on the screen in this branch.

**`MemberCard` renders the staged cards in step 6 too**, so a cadre looks the same before and after they are proposed. `onRemove` is what tells the two apart: with it the card loses the live dot and the status block, and reads "Considered for" rather than "Proposed for" — nothing is proposed until you assign, and the staged list must not claim otherwise.

**Add Members** shows the roles as cards, disabled when `max_proposals - proposed_cnt <= 0`, then the search row.

**Search is by membership id only** (`SEARCH_TYPE = 'MembershipId'`), because it is the one field S12 matches exactly, so a search resolves to a single cadre rather than a page of near-matches — the `Name` filter is a `LIKE '%value%'` over `first_name` with no location filter and routinely returns thousands. `sanitizeSearchValue` strips the box to 8 digits on typing and on paste, and `runSearch` refuses anything shorter. S12 still returns matched-but-ineligible cadre (see the eligibility trap below), which is what lets "no such id", "already staged" and "barred by the reservation" read as three different messages rather than one blank result.

**A search stages a cadre, it does not assign one.** `staged` holds the cadre rows; `scores` holds their whole S17 row (the card wants the report behind the score, for Member Since and Renewals, not just the number), keyed by `membership_id` and fetched one MID at a time as each is staged, so a slow score never blocks the card. `stagedByScore` sorts best-first on `total_score` with unscored cadre last (`?? -1`) rather than as zeros. Each staged card is a `MemberCard` with `onRemove` — same layout as a proposed member, plus the photo lightbox and a score badge tiered by `scoreTier` (≥70 / ≥40 / below / none). **Compare** appears once two are staged.

**Each staged card ends in two blocks, `Propose Candidate` and `Shortlist Candidate`** (`PROPOSAL_STATUSES`), replacing the single "Select Candidate" toggle. They are the same pick — `selection` maps `tdp_cadre_id` to the `proposal_status_id` the button chose (1 Proposed, 2 Shortlisted; 3 Confirmed exists in the table but this screen never writes it) — so choosing one switches away from the other and clicking the lit one clears it. **The buttons say what a staged cadre is saved as, not whether they are saved** — save writes every staged card, and one nobody marked goes in as `DEFAULT_STATUS_ID` (Proposed), so a mixed list of one shortlisted and one untouched saves as one of each. The status travels to S11 as `proposal_status_id`. **Both statuses consume a `max_proposals` slot**: they are rows in the same `proposal_candidate` table, and S7's `proposed_cnt` counts every active row whatever its status. S13 now returns `proposal_status` (the `status_name`), which is the verb a proposed member's card reads back — `null` on rows written before the column existed, which render as "Proposed".

`assignStaged` then calls S11 **sequentially**, in score order — the proposal slots are exactly what the staged candidates compete for, and S11 re-checks the count on every write, so the server has to see them one at a time. A batch can therefore partly succeed: whoever went in is dropped from `staged` and named in the success line, and the rest stay staged with S11's own `{detail}` text. After any success `positionsKey` is bumped so S7 re-reads and the open-slot counts update in place.

`Dropdown` is a hand-rolled replacement for `<select>`, used by steps 2/3/4 and the search-type picker. It exists because Chrome flips a long native popup *upward*; this one always drops below. `searchable` adds a filter input (step 2 only). It closes on outside `mousedown` and on Escape.

Candidates use the **backend cadre shape** everywhere (`member_name`, `membership_id`, `mobile_no`, `category_name`, `panchayat_name`, `mandal_town_name`, `img_url`, …) — not the `data.js` `candidate()` shape (`name`, `score`, `idNo`, `phone`).

### `Candidates`

The other reachable screen, and the only one that reads across constituencies. It mirrors
the membership-analytics platform (`/cde/`): the positions list is that app's
`PositionsScreen` card list, and opening a card is its `Step2View` ("Adding Profiles") —
a header, then `MAPPED CANDIDATES` as a grid of the same `MemberCard` the wizard renders,
with Compare All over them.

**One endpoint, all the filtering in the browser.** `S19` returns every
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

The detail is `S13` + `S17`, the same pair as View Members, and the ✕ is the same `S18`
removal — dropping the last candidate takes the position out of `S19` entirely, which is
why `onChanged` bumps the list and the effect falls back to the list rather than rendering
a position that no longer exists.

**This is the one screen that *changes* a status.** Where View Members shows the read-only
`.leap-mcard-status` block, here the card carries all three statuses as buttons with the
saved one lit — `MemberCard`'s `statuses` prop, which defaults to the wizard's two and is
passed `STATUS_FILTERS` (all three) here. Nothing is written until **Save Status**: the
buttons move `pending` (only the ids the user touched), and Save writes one `S20` per card
whose status actually moved, sequentially so a failure can name the candidate. Pressing the
lit button is a no-op — the wizard clears its pick there, but a saved candidate always has
a status, so `onStatus(null)` is ignored. A reload clears `pending`, because `S13` is then
the new truth about every status. `S7`'s counts do not move on a status change (all three
are live rows in one `max_proposals` slot), but `S19`'s per-status pills do, which is what
`onChanged` refreshes.

**It also proposes.** When the open position still has a proposal slot free
(`max_proposals - proposed_cnt > 0`) the section head carries an **Add Members** toggle
that mounts the wizard's own step 6, `AddMembersPanel` — same S12 search, same staging
and compare, same sequential S11 write. S19 returns `proposal_constituency_id`, which is
the one thing the cadre search needs and the drill-down would otherwise have supplied;
reservation, role and local body name come off the same row. A successful assign bumps
the detail's `reloadKey` (S13, for the new cards) *and* calls `onChanged` (S19, for the
slot and per-status counts) — the toggle then disappears on its own once the last slot
fills, because `open` is recomputed from the refreshed row.

`MemberCard`, `AddMembersPanel`, `PhotoViewer` and `STATUS_META` are imported from
`NewPositionModal.jsx` rather than copied: a proposed member must look identical on both
screens, and so must the search that proposed them.

### `PositionDetail` (unreachable)

Branches on `stage.key === 'profiles'` (stage 0) for an "add candidates" layout and falls through to a review layout otherwise. Both render the S13 list, with `reloadKey` bumped after a successful S11 assign. It is a second, older implementation of what step 5/6 of the wizard now do — if you change assign behaviour, decide whether to update it or delete it rather than leaving the two to drift.

### `Frontend/src/leap/data.js`

Central source of both the seed dataset and the domain vocabulary. It exports:
- Config constants (`STATE_NAME`, `PARTY_NAME`, `PARTY_SHORT`, `TERM_LABEL`).
- `STAGES` / `STAGE_COLORS` — the nomination pipeline (see the stage caveat below).
- Picklists (`AP_ASSEMBLIES`, `AP_MANDAL_TOWNS`) — the live screen gets these from S2/S3/S4 instead.
- `POSITIONS` — 16 seeded positions (8 `nominated`, 8 `committee`) with procedurally generated candidates. `makeCandidate` uses `Math.random()` at module load, so scores/points differ between reloads.
- Derived helpers `stagesFor`, `stageCounts`, `summary` — pure functions over a positions array.

**Only `PARTY_SHORT` still reaches the screen**, via `Sidebar`. Everything else in this file is imported solely by unreachable components. All seed data is fictional; real Andhra Pradesh place names appear only as picklist values.

### `Frontend/src/leap/api.js`

One thin `get`/`post` pair over `${API_BASE}/*` — `API_BASE` is `/leapapi` (Vite proxies it; see above for why not `/api`) — one named function per endpoint, plus `useList(load, deps)` — the hook every picklist uses. `useList` returns `[]` until the promise resolves **and `[]` again on failure**, logging the error rather than surfacing it: a failed picklist is indistinguishable from an empty one in the UI. `post` unwraps FastAPI's `{detail: "..."}` into the thrown `Error.message`, which is what the S11 error banner shows.

**No write here sends a user id.** S11 stamps `inserted_user_id` and S20 stamps
`updated_user_id` from the session the httpOnly cookie identifies, server-side — the
frontend has no `user_id` to pass and must not start passing one, since a body-supplied id
would let a browser forge the audit trail.

`getPositionsWithCandidates()` (S19) is the Candidates screen's whole list — see that
section for why it takes no filter arguments. `updateProposalCandidateStatus()` (S20) is
the only write that edits a `proposal_candidate` row rather than creating (S11) or
deactivating (S18) one.

`getCadreScores(mids)` is the one call behind both the staged card's score badge and the whole compare table — same payload, so the same endpoint (`S17`, `?mids=` comma-separated). It answers `{configured: false, questions: [], candidates: []}` rather than failing when the ratings database is unset on the server, which is a state the UI renders ("No score", and a note in the compare modal) rather than an error. **The score half is optional; the profile half never is** — everything the compare table shows above the Performance section comes off the S12/S13 row the caller already had.

Both `get` and `post` route a `401` through `checkUnauthorized` before throwing: it calls the handler registered by `App.jsx` via `setUnauthorizedHandler`, which clears `user` and returns to the login screen. **`AUTH_PATHS` (`S14`/`S15`/`S16`) is exempt and must stay that way** — `S14` answers `401` for bad credentials and `S15` answers `401` on a normal first visit, so treating those as expiries would wipe the login form's own error banner. Only `401` triggers it: a `429` from the login throttle and a `500` from a dead backend must not log anyone out. Adding an endpoint that can legitimately `401` without meaning "session over" means adding it to `AUTH_PATHS`.

## Traps to know before editing

**The stage pipeline is truncated — and now entirely inside dead code.** `STAGES` has only 2 entries (`profiles`, `approval`) while its consumers still assume a 5–7 stage pipeline. None of them render today, so none of this is a live bug; it is a landmine for anyone restoring those screens. Concretely:
- `stagesFor(kind)` returns `STAGES.slice(0, 5)` for committees, which with 2 entries is the *same* array as for nominated — the kind distinction is currently a no-op.
- Seed `stage:` values go up to 5, so most positions have a `stageIndex` outside `STAGES`.
- `PositionCard` does `STAGES[position.stageIndex].full` unguarded — this **throws** for any position with `stageIndex >= 2`. It is only invisible because `AllPositions` is unreachable. Restoring that view without fixing this will crash the render.
- `summary()` counts `stageIndex >= 4` as finalized and `=== 6` as GO-issued, so those stats read as 0 for anything the current UI can produce.
- `stageCounts()` writes `counts[p.stageIndex] += 1` past the array end, producing `NaN` entries.
- `PositionDetail` guards with `stages[viewStage] || stages[stages.length - 1]`, so it degrades rather than crashing.

If you touch `STAGES`, check every one of the consumers above.

**"Step N" and "SN" are different numbering schemes and no longer line up.** `S1`…`S17` are backend endpoints; steps 1–6 are the wizard's visible sections. Wizard step 3 calls S3+S4, step 4 calls S5 *or* S6, step 5 calls S9+S7+S13, step 6 calls S12+S17+S11. Say which you mean.

**Only one path through the wizard reaches live data.** The database holds exactly one
`proposal_consituency` row, reachable only via **ACHANTA (`constituency_id` 181) →
Achanta mandal (`tehsil_id` 658)**. Every other assembly/mandal ends at an empty
proposal-constituency select (the UI says so rather than dead-ending silently). That
row has no `local_election_body`, so the towns half of the picklist (S4/S6) yields
nothing for it. Its two positions are `President` (`max_proposals` 3, already full —
the card is disabled and S11 would 409) and `Vice-President` (open). Reservation is
`BC-GENERAL`, so only cadre with `caste_category_id = 2` can be assigned.

**Step 1 of the wizard is live, but only Panchayat has data.** S5/S6 take
`proposal_election_type_id` from the caller. Every seeded `proposal_consituency` row is
type 8 = **Panchayat**, so picking any other type correctly yields an empty
proposal-constituency select and the "No &lt;type&gt; is configured…" hint. Row 8 was
originally `is_active = NULL, order_no = NULL` — S1 hid the one type the data used;
it has since been activated. If step 1 ever shows no Panchayat option again, check
those two columns first.

**Candidate eligibility is the reservation alone — location is not part of it.** A cadre's
`user_address` no longer has to match the proposal constituency's chain (assembly → mandal
→ panchayat/town), so cadre from anywhere may be proposed. What is checked is the
constituency's `constituency_reservation`: `caste_category_id` when set, and `gender = 'F'`
when set. Both come from `proposal_context()` in the backend repo's `main.py`, the SQL from
`eligibility_flag()` there. Change eligibility there, not in either endpoint, and not in
this repo. A cadre with no caste category on record compares NULL and so is ineligible.

**`S12` flags eligibility, it does not filter.** `eligibility_flag()` returns a SELECT
expression (`… AS eligible`, `'Y'`/`'N'`), not a WHERE clause, so S12 returns every cadre
the search matched. That is deliberate: "no cadre has that membership id" and "that cadre
is barred by the reservation" are different states and `runSearch` says different things
for each — the second names the reservation. Only `eligible === 'Y'` rows can be staged.
`S11` re-checks the same rules on write and answers `409` with the reservation type in
`detail`, which is what the error banner shows.

**Scores come from a second, optional database.** `S17getCadreScores` reads
`report_ratings` — `cadre_performace_report` (the table's name really is spelt that way)
for the per-category points and `leader_feedback` for the per-question ones, with the
question labels coming from `members_track.question` on the same server. **Total Score is
half of each**: `(Σ the 11 POINTS columns ÷ 2) + (Σ the feedback answer points ÷ 2)`,
matching the membership-analytics platform, and it is `null` — never `0` — when a cadre has
neither, so unrated does not sort as worst. S17 is *lookup-first*: a membership id whose
report row already exists is served from the table, and the `cadre_performance_update` /
`cadre_performance_report` procedures (seconds per id) run only for the rest.
`REPORT_RATINGS_DB_HOST`/`USER`/`PASSWORD` are all optional — with any of them unset
`RATINGS_DB` stays `None` and S17 answers `{"configured": false}`, so the wizard renders
without scores instead of erroring. `Backend/test_score.py` covers the arithmetic and the
membership-id key matching (the report stores it as varchar, `leader_feedback` as an INT).

Some seeded `proposal_candidate` rows would fail the reservation check now. `S13` still
returns them — it reports what *is* assigned, and filtering it would desync the list from
`S7`'s `proposed_cnt`.

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

`Frontend/src/leap/Leap.css` (~2400 lines) holds every class for the leap module; `Login.css` (~180) covers the login screen; `index.css` is a 17-line reset. Classes are flat and prefixed `leap-`. No CSS modules, no utility framework — add styles to the existing file matching the surrounding naming. Fonts (Montserrat, Inter) load from Google Fonts in `index.html`.

A large share of the file styles components that no longer render (`.leap-card-*`, `.leap-stage-*`, `.leap-candidate-*`, `.leap-cadre-search-modal`, `.leap-detail-*`, …). Grep the JSX before assuming a rule is live — and before deleting one, since the dead components still reference them.

## Known dead / inert code

Still a third of the `leap/` module — 630 of its ~1900 JSX lines. Mention rather
than silently remove:

- **`PositionDetail.jsx` (339 lines) became unreachable** when `createPosition` was dropped
  from `Leap.jsx`. It is still imported and still the only other caller of `searchCadre` /
  `assignCandidate` / `getProposalCandidates`.
- `AllPositions` and `PositionCard` are unreachable (see table above). `AllPositions`'s
  `onNewPosition` prop is never passed, and it renders `st.nomOnly`, a field `STAGES`
  entries no longer have.
- `Frontend/src/leap/components/Dashboard.jsx` (167 lines) is not imported anywhere.
- In `Leap.jsx`: the `positions` state, `advanceStage`, `openPosition` and the `POSITIONS`
  import exist only to feed the two unreachable branches.
- `data.js` is dead except `PARTY_SHORT`: `STAGES`, `STAGE_COLORS`, `stagesFor`,
  `stageCounts`, `summary`, `POSITIONS`, `TERM_LABEL`, `STATE_NAME`, `PARTY_NAME`,
  `AP_ASSEMBLIES`, `AP_MANDAL_TOWNS` are all imported only by unreachable components,
  as are the seeded candidates' fields (`score`, `idNo`, `casteCommunityPct`, `appPoints`, …).
- `PositionDetail` imports `STAGES` without using it (pre-dates the backend wiring).
- `checkPositionAvailability` (S10) is exported from `api.js` and called by nothing.
- `Frontend/src/circle.svg` is used only by the login screen.
- Backend `S8` and `S10` are unused by the frontend; `S7` already carries the role
  names and the counts that make both redundant.
