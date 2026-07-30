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

**The entire reachable app is `Sidebar` + `NewPositionModal`.** `NewPositionModal` is a single scrolling screen that does everything (pick a body → view its members, or add one), takes no props, and never navigates. Everything else in `leap/` — the `positions` dataset, `PositionDetail`, `AllPositions`, `PositionCard`, `Dashboard`, and the whole `STAGES` pipeline — is unreachable. See "Known dead / inert code".

Two top-level screens, switched by a boolean in `Frontend/src/App.jsx`:
- `Frontend/src/Login.jsx` — real login. `handleSubmit` posts to `S14`, which validates the credentials against the `user` table, and calls `onLoginSuccess(user)` only on `200`; a `401` renders in `.login-error`. S14 opens a server-side session and sets an **httpOnly** cookie, so the token is never reachable from JS and there is nothing in `localStorage` to steal. `App.jsx` cannot read the cookie either — it calls `S15` on mount to ask whether a session is live, which is what makes a reload keep you logged in, and renders `null` until that answers so the login screen does not flash. `onLogout` calls `S16`, which drops the session server-side. **Every endpoint except S14 requires the session.**
- `Frontend/src/leap/Leap.jsx` — the actual app.

## The `leap/` module

`Leap.jsx` is a 48-line ad-hoc router around a `view` discriminated object (`{ name: 'newPosition' | 'positions' | 'detail', id?, filter? }`). Adding a screen means adding a `view.name` branch, not a route.

**`view` starts at `newPosition` and nothing ever changes it.** The only `setView` calls live inside props passed to `AllPositions` and `PositionDetail`, neither of which renders. `Leap.jsx` still holds `positions` (seeded from `POSITIONS`) and `advanceStage` for those two branches; both are effectively dead. `createPosition` was removed when the wizard stopped producing positions — nothing constructs a local position object any more, so the `_newId` counter is gone too.

### Screens

| Component | Reached via | Notes |
|---|---|---|
| `NewPositionModal` | `view.name === 'newPosition'` (initial, and permanent) | The whole app. 6 steps, each revealed only when the previous is filled |
| `Sidebar` | always | The single nav button has no handler. Footer shows the logged-in user (`firstname lastname`, falling back to `username`) and a logout button that clears `App.jsx`'s `user` |
| `PositionDetail` | `view.name === 'detail'` | **Unreachable** — nothing sets this view since `createPosition` was removed |
| `AllPositions` | `view.name === 'positions'` | **Unreachable** — nothing sets this view |
| `PositionCard` | rendered by `AllPositions` | therefore also unreachable |

### `NewPositionModal` (694 lines — read it before changing anything here)

Six steps, rendered top to bottom in one scrolling panel, each gated on `stepNDone`:

1. **Election type** — S1, as a grid of icon chips. Icons are inline SVG components in this file, keyed by `election_type` name in `ELECTION_TYPE_ICONS`; an unknown name falls back to `IconHouse`. A new election type in the DB shows up with the house icon until you add one.
2. **Assembly** — S2, `searchable` (the list is every assembly in the state).
3. **Mandal/Town** — S3 + S4 merged into one picklist. The two halves resolve through different endpoints, so option values are tagged `m:<tehsil_id>` / `t:<town_id>` and split back apart by `locationKey.split(':')` — keep that encoding.
4. **Local body** — S5 (for `m:`) or S6 (for `t:`). Its heading is `localBodyLabel`, i.e. the step-1 election type name. Auto-selects when exactly one row comes back.
5. **Reservation & Members** — S9 for the reservation badge, S7 for the roles, then a fork: **View Members** or **Add Members**.
6. **Cadre search** — S12 search, S11 assign. Only rendered in the `add` branch, once a role is picked.

Selecting anything at step *N* clears steps *N+1…6* (the `select*` handlers). Picking a different role additionally clears the search results, selection, error and success text.

**View Members** fans S13 out over every role from S7 (`Promise.all`, one call per role) and renders each cadre as a card: photo, name, relative, membership id, plus the fields in `MEMBER_FIELDS`. `img_url` is an S3 URL built by S12/S13 and is `''` when the cadre has no photo — the card falls back to `initials()`. Clicking a photo opens the `zoomed` lightbox. `members[id] === undefined` means S13 is still in flight, `[]` means it returned none; the two render differently.

**Add Members** shows the roles as cards, disabled when `max_proposals - proposed_cnt <= 0`, then the search row. Results are capped at `MAX_RESULTS` (50) with a "refine your search" hint — a `Name` search is a substring match over the whole constituency and routinely returns thousands. After a successful assign, `positionsKey` is bumped so S7 re-reads and the open-slot counts update in place.

`Dropdown` is a hand-rolled replacement for `<select>`, used by steps 2/3/4 and the search-type picker. It exists because Chrome flips a long native popup *upward*; this one always drops below. `searchable` adds a filter input (step 2 only). It closes on outside `mousedown` and on Escape.

Candidates use the **backend cadre shape** everywhere (`member_name`, `membership_id`, `mobile_no`, `category_name`, `panchayat_name`, `mandal_town_name`, `img_url`, …) — not the `data.js` `candidate()` shape (`name`, `score`, `idNo`, `phone`).

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

**"Step N" and "SN" are different numbering schemes and no longer line up.** `S1`…`S13` are backend endpoints; steps 1–6 are the wizard's visible sections. Wizard step 3 calls S3+S4, step 4 calls S5 *or* S6, step 5 calls S9+S7+S13, step 6 calls S12+S11. Say which you mean.

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

**Candidate eligibility is location + reservation, enforced in two places.** A cadre may
be proposed only if their `user_address` matches the proposal constituency's own address
(assembly + mandal + panchayat, or local election body for towns) *and* satisfies its
reservation. `S12` applies it to the search pool, `S11` re-checks it on write — both via
the shared `proposal_context()` / `eligibility_filter()` in the backend repo's `main.py`.
Change eligibility there, not in either endpoint, and not in this repo.

Some seeded `proposal_candidate` rows pre-date the rule and would fail it now (rows 1/6/7
are KUPPAM cadre on a VALLURU position). `S13` still returns them — it reports what *is*
assigned, and filtering it would desync the list from `S7`'s `proposed_cnt`.

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

`Frontend/src/leap/Leap.css` (~1820 lines) holds every class for the leap module; `Login.css` (~180) covers the login screen; `index.css` is a 17-line reset. Classes are flat and prefixed `leap-`. No CSS modules, no utility framework — add styles to the existing file matching the surrounding naming. Fonts (Montserrat, Inter) load from Google Fonts in `index.html`.

A large share of the file styles components that no longer render (`.leap-card-*`, `.leap-stage-*`, `.leap-candidate-*`, `.leap-cadre-search-modal`, `.leap-detail-*`, …). Grep the JSX before assuming a rule is live — and before deleting one, since the dead components still reference them.

## Known dead / inert code

This is now most of the `leap/` module — 630 of its ~1400 JSX lines. Mention rather
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
