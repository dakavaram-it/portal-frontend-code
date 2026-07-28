# Local Body Elections Portal

A prototype of a candidate nomination workflow for local body elections, styled as a
party internal portal.

- **`Frontend/`** — React 18 + Vite SPA. No router, no state library; the only
  runtime deps are `react` and `react-dom`.
- **`Backend/`** — FastAPI + PyMySQL API backing the whole nomination flow: picklists,
  proposal constituencies, reservation, positions, cadre search, and candidate
  assignment.

Everything the reachable UI shows comes from the database — picklists, reservation,
positions, cadre search and the proposed candidates — and assignments persist. The
frontend keeps no dataset of its own; only the wizard's current selections reset on
reload. The seed data in `Frontend/src/leap/data.js` is left over from before the
backend existed and no longer reaches the screen.

## Setup

Requires Node.js 18+ and Python 3.12+. Run these from the project root.

```bash
cd Frontend && npm install && cd ..

cd Backend
python -m venv .venv
```

Activate the venv, then install the Python deps:

```bash
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # macOS / Linux

pip install -r requirements.txt
```

Copy `.env.example` to `.env` in the **project root** and fill in your MySQL
connection details. `Backend/main.py` reads it at startup and exits with a message
naming the missing key if it is absent.

## Running

Two terminals. Both processes are needed — Vite proxies `/api/*` to the backend and
returns `500` for every `/api/*` call when the backend is down.

```bash
# terminal 1 — backend on :8001, with the venv activated
cd Backend
python -m uvicorn main:app --port 8001 --reload

# terminal 2 — frontend on 0.0.0.0:9001
cd Frontend
npm run dev
```

The backend command uses whichever Python is first on your PATH, so activate the venv
in that terminal first — or call the venv interpreter directly:
`./.venv/Scripts/python.exe -m uvicorn ...` (`./.venv/bin/python` on macOS/Linux).

API docs: <http://127.0.0.1:8001/docs>

npm scripts, all run from `Frontend/`:

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server on `0.0.0.0:9001` |
| `npm run build` | production build to `Frontend/dist/` |
| `npm run preview` | serve `dist/` on `0.0.0.0:9001` (also proxies `/api`) |

There is no test runner, linter, or formatter. Verification means `npm run build` plus
clicking through in the browser.

## Deployment

Run `./install.sh` **from the repo root**. It checks Node 18+/npm/Python 3.9+, installs
and builds the frontend, creates `Backend/.venv` and installs `requirements.txt`, installs
PM2 if missing, then (re)starts both processes from the root `ecosystem.config.cjs`:

- `portal-frontend` — `vite preview` serving `Frontend/dist` on port **9001**
- `portal-backend` — uvicorn on port **8001**, credentials from the root `.env`

It aborts if the root `.env` is missing. `pm2 save` is run for you; `pm2 startup` (once,
per server) is what makes the processes come back after a reboot.

**No reverse proxy is included.** Something in front (nginx, Caddy, an ALB) has to
terminate the public domain. The frontend's `vite preview` already proxies `/api` to
`127.0.0.1:8001`, so pointing the proxy at `127.0.0.1:9001` alone is enough; set
`COOKIE_SECURE=true` in `.env` once TLS terminates in front of it. If the site hangs or
504s, check `pm2 status` / `pm2 logs` and the server's outbound IP against the DB security
group before assuming an app bug.

The older frontend-only `Frontend/install.sh` and `Frontend/ecosystem.config.cjs` are
superseded — they declare the same `portal-frontend` process name, so don't run both.

## Layout

```
install.sh             one-shot deploy: builds frontend, sets up backend venv, starts PM2
ecosystem.config.cjs   PM2 process definitions (portal-frontend :9001, portal-backend :8001)
Frontend/
  package.json         npm scripts; run them from here
  vite.config.js       dev/preview server on :9001, proxies /api to :8001
  install.sh           superseded by the root install.sh
  src/
    App.jsx            toggles between login and the app
    Login.jsx          real login; posts to S14, validated against the `user` table
    leap/
      Leap.jsx         ad-hoc router; the view never changes from its initial one
      data.js          seed dataset, stage definitions, derived helpers (dead)
      api.js           /api fetch wrappers + useList hook
      components/      NewPositionModal (the app), Sidebar, and unreachable ones
      Leap.css         every class for the module
Backend/
  main.py              S1–S13, see Backend/README.md
.env                   DB credentials, read by Backend/main.py
```

## Notes

- Login is real: `S14login` validates credentials against the `user` table and opens a
  server-side session behind an httpOnly cookie, and every endpoint except `S14`/`S15`/
  `S16` requires it. Sessions live in process memory, so a backend restart logs everyone
  out. There is **no authorization** yet — any valid account can read and write against
  any constituency, and accounts with `is_enabled = 'N'` can still sign in.
- `.env` is committed to this repository, so anyone with read access has the database
  credentials.
- The reachable UI is one screen: `components/NewPositionModal.jsx` (plus `Sidebar`).
  `PositionDetail`, `AllPositions`, `PositionCard` and `Dashboard` are all unreachable,
  as is most of `data.js`. See `CLAUDE.md` for the details and for the truncated
  `STAGES` pipeline caveat.
