# Local Body Elections Portal — Frontend

A prototype of a candidate nomination workflow for local body elections, styled as a
party internal portal.

- **`Frontend/`** — React 18 + Vite SPA. No router, no state library; the only
  runtime deps are `react` and `react-dom`.

The API (FastAPI + PyMySQL) lives in a **separate repository** and is deployed
separately. This repo contains no backend code and no database credentials.

Everything the reachable UI shows comes from that API — picklists, reservation,
positions, cadre search, cadre performance scores and the proposed candidates with their
Proposed / Shortlisted / Confirmed status — and assignments, removals and status changes
persist. The
frontend keeps no dataset of its own; only the wizard's current selections reset on
reload. The seed data in `Frontend/src/leap/data.js` is left over from before the
backend existed and no longer reaches the screen.

## Talking to the API

`Frontend/src/leap/api.js` calls `/leapapi/*`. `Frontend/vite.config.js` proxies that
prefix to `http://127.0.0.1:4000`, rewriting `/leapapi` to `/portal-frontend-code`, in
both `dev` and `preview`. The backend is served by the PSA gateway (`gateway.py`), which
mounts each project's FastAPI app under a prefix named after it — hence the rewrite
rather than a strip. **Point that `target` at wherever the gateway actually runs** — it
is the only place the API host is configured.

The prefix is `/leapapi`, not `/api`, on purpose: on the deployed host
(`portalnew.mypartydashboard.com`) `/api` is already routed to the older party dashboard
service, so `/api/S14login` answers `404` and never reaches this backend.

When the API is unreachable every picklist renders silently empty — `useList` swallows
fetch errors. Check the console and network tab first.

## Setup

Requires Node.js 18+.

```bash
cd Frontend
npm install
npm run dev
```

npm scripts, all run from `Frontend/`:

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server on `0.0.0.0:9001` |
| `npm run build` | production build to `Frontend/dist/` |
| `npm run preview` | serve `dist/` on `0.0.0.0:9001` (also proxies `/leapapi`) |

There is no test runner, linter, or formatter. Verification means `npm run build` plus
clicking through in the browser.

## Deployment

Run `./install.sh` **from the repo root**. It checks Node 18+/npm, installs and builds
the frontend, installs PM2 if missing, then (re)starts `portal-frontend` from the root
`ecosystem.config.cjs` — `vite preview` serving `Frontend/dist` on port **9001**.

`pm2 save` is run for you; `pm2 startup` (once, per server) is what makes the process
come back after a reboot.

**No reverse proxy is included.** Something in front (nginx, Caddy, an ALB) has to
terminate the public domain; point it at `127.0.0.1:9001`. If the site hangs or 504s,
check `pm2 status` / `pm2 logs`.

## Layout

```
install.sh             one-shot deploy: builds frontend, starts PM2
ecosystem.config.cjs   PM2 process definition (portal-frontend :9001)
Frontend/
  package.json         npm scripts; run them from here
  vite.config.js       dev/preview server on :9001, proxies /leapapi to the API
  src/
    App.jsx            toggles between login and the app
    Login.jsx          real login; posts to S14, validated against the `user` table
    leap/
      Leap.jsx         ad-hoc router; the view never changes from its initial one
      data.js          seed dataset, stage definitions, derived helpers (dead)
      api.js           /leapapi fetch wrappers + useList hook
      components/      NewPositionModal (the app), CompareModal, Sidebar, and
                       unreachable ones
      Leap.css         every class for the module
```

## Notes

- Login is real: `S14login` validates credentials against the `user` table and opens a
  server-side session behind an httpOnly cookie, and every endpoint except `S14`/`S15`/
  `S16` requires it. Sessions live in the backend's process memory, so a backend restart
  logs everyone out. There is **no authorization** yet — any valid account can read and
  write against any constituency.
- A cadre search **stages** a candidate, it does not propose one. Several are staged and
  ranked by their performance score, compared side by side in `CompareModal`, and only
  the **Assign** button writes — one S11 call each, in score order, so a batch can partly
  succeed when the slots run out. Each staged card is saved as **Proposed** or
  **Shortlisted**; both are rows in the same table and both consume a `max_proposals`
  slot, so the counts do not tell them apart.
- The ✕ on a member card **removes** that candidate (S18) — `is_active` goes to `'N'`,
  the slot reopens, and the row survives. Nothing here is deleted. Each staged card is saved as **Proposed** or
  **Shortlisted**; both are rows in the same table and both consume a `max_proposals`
  slot, so the counts do not tell them apart.
- The ✕ on a member card **removes** that candidate (S18) — `is_active` goes to `'N'`,
  the slot reopens, and the row survives. Nothing here is deleted.
- Scores (`S17`) come from a **second, optional** database on the ratings pipeline's own
  server. With `REPORT_RATINGS_DB_*` unset the API answers `{"configured": false}` and the
  wizard renders without scores — "No score" badges, a note in the compare modal — rather
  than erroring.
- The reachable UI is two screens, switched by the sidebar:
  `components/NewPositionModal.jsx` (the wizard: pick a local body, view or propose its
  members) and `components/Candidates.jsx` (every position holding candidates, state-wide).
  Plus `Sidebar` and the `CompareModal` overlay.
  `PositionDetail`, `AllPositions`, `PositionCard` and `Dashboard` are all unreachable,
  as is most of `data.js`. See `CLAUDE.md` for the details and for the truncated
  `STAGES` pipeline caveat.
- **Candidates is the only screen that changes a status.** It reads one endpoint (S19,
  no query parameters — all four filters run in the browser off the unfiltered rows) and
  writes S20 on **Save Status**, one call per card whose status actually moved. The
  wizard writes a status once, at assign time, and never edits one.
