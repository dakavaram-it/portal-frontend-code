# Backend

FastAPI + PyMySQL read-only API. Reads DB credentials from the project-root `.env`
(copy `.env.example` to `.env` and fill it in — startup fails with a message naming
the missing key otherwise).

One-time setup:

```bash
cd Backend
python -m venv .venv

.venv\Scripts\activate        # Windows
source .venv/bin/activate     # macOS / Linux

pip install -r requirements.txt
```

The frontend proxies `/api/*` here, so **both** processes must be running — start
them in two terminals from the project root:

```bash
cd Backend  && python -m uvicorn main:app --port 8001 --reload   # backend on :8001
cd Frontend && npm run dev                                       # frontend on :9001
```

The backend command needs the venv activated in that terminal, since it invokes plain
`python`.

If the backend is down, the Vite proxy returns `500` for every `/api/*` call.

Docs at http://127.0.0.1:8001/docs

| Endpoint | Description | Params |
|---|---|---|
| `GET /S1getProposalElectionTypes` | Proposal election types | — |
| `GET /S2getAssemblyConstituenciesInAState` | Assembly constituencies (election_type_id=2, state_id=1) | — |
| `GET /S3getMandalsInAConstituency` | Mandals in a constituency | `constituency_id` (required) |
| `GET /S4getTownsInAConstituency` | Towns in a constituency | `constituency_id` (required) |
| `GET /S5getProposalConstituenciesByTehsilId` | Proposal constituencies in a mandal (enrollment_id=1) | `constituency_id`, `tehsil_id`, `proposal_election_type_id` (required) |
| `GET /S6getProposalConstituenciesByTownId` | Proposal constituencies in a town (enrollment_id=1) | `constituency_id`, `town_id`, `proposal_election_type_id` (required) |
| `GET /S7getProposalPositionsOverviewByProposalConstituencyId` | Positions with max_positions/max_proposals and proposed count | `proposal_constituency_id` (required) |
| `GET /S8getProposalPositionsByProposalConstituencyId` | Positions with role names | `proposal_constituency_id` (required) |
| `GET /S9getProposalConstituencyReservation` | Reservation for a proposal constituency | `proposal_constituency_id` (required) |
| `GET /S10checkProposalPositionAvailability` | `Available` / `Not Available` for a position | `proposal_position_id` (required) |
| `POST /S11assignProposalCandidate` | Proposes a cadre for a position after reservation + availability checks; returns the new `proposal_candidate_id` | JSON body: `proposal_position_id`, `tdp_cadre_id` |
| `GET /S12cadreSearch` | Cadre **eligible for a proposal** by membership id, mobile or name | `proposal_constituency_id`, `search_type` (`MembershipId`\|`MobileNo`\|`Name`), `search_value` |
| `GET /S13getProposalCandidatesByProposalPositionId` | Cadre currently proposed for a position (`is_active = 'Y'`), same fields as S12 | `proposal_position_id` (required) |
| `POST /S14login` | Validates credentials against the `user` table, opens a session and sets the cookie; returns the user's identity fields, `401`, or `429` when throttled | JSON body: `username`, `password` |
| `GET /S15me` | The logged-in user for the current session cookie, or `401` | — |
| `POST /S16logout` | Drops the session server-side and clears the cookie | — |

`S11` is the only write endpoint. It rejects with `404` for an unknown position or cadre,
and `409` when the cadre is not registered in the proposal constituency, when their caste
category or gender does not match its reservation, when the position has reached
`max_proposals`, or when the cadre is already proposed for that position. The inserted row
is `is_active = 'Y'`, `enrollment_id = 1`.

**Eligibility is defined once**, in `proposal_context()` + `eligibility_filter()`, and used
by both `S12` (to build the searchable pool) and `S11` (to enforce it on write). A cadre is
eligible when their `user_address` matches the proposal constituency's own address —
same assembly, mandal, and panchayat (or local election body, for towns) — *and* they
satisfy the reservation. `S12` filtering alone would not be enough: `S11` is the boundary,
since a client can post any `tdp_cadre_id`.

For the seeded VALLURU proposal that narrows the pool from 89,892 cadre (assembly-wide)
to 1,354 (panchayat + BC).

`S8` and `S10` are unused by the frontend: `S7` already returns the role names `S8`
gives, and its `max_proposals`/`proposed_cnt` pair is the same predicate `S10`
evaluates. Both remain for API consumers.

`S14` checks the password the way the Java portal that owns the `user` table wrote it:

```
digest   = md5(md5(username) + md5(password))     lowercase hex, concatenated
Hash_Key = hex(PBKDF2-HMAC-SHA1(digest, salt, 1000 iterations, 64 bytes))
```

`Salt_Key` is hex over the **ASCII** salt that side used — for `itgrids` it decodes to
`[B@3da6a354`, a Java `byte[].toString()` — so it must be un-hexed before it is fed to
PBKDF2, not treated as raw salt bytes. `username` is indexed but **not unique**, so
`S14` hashes against every row carrying the name and lets the hash pick the account.
It returns the same `401` for an unknown user and a bad password, and takes the same
time for both — an unknown username burns one throwaway PBKDF2 against `DUMMY_SALT_KEY`,
because skipping the loop entirely would have left the `user` table enumerable by
timing. It never returns `Hash_Key` / `Salt_Key`.

`username` is not unique, so every row carrying the name is hashed until one matches.
Those rows come from the Java portal and some are unusable — a `Salt_Key` that is not
valid even-length hex, or a `Hash_Key` that arrives as bytes — so each row's comparison
is wrapped in a `try/except` that skips it. Without that, one malformed row raises out
of the loop and `500`s a login that a later row would have accepted.

It deliberately does **not** check `is_enabled`. 75,128 of the 76,782 rows are `'N'`, so
gating on it would reject almost every account; this is a known, accepted gap rather
than an oversight. Every deactivated account can therefore still sign in and gets full
read access to cadre data plus `S11` writes. Revisit once it is known whether those rows
are genuinely disabled accounts or import leftovers.

There is also **no authorization**. The session carries `user_type`, `state_id`,
`district_id` and `constituency_id`, and no endpoint reads any of them, so any valid
account can search cadre and assign candidates in any constituency. Also accepted for
now.

**Every endpoint except `S14` and the docs requires a session** (`guard_response`
middleware, `PUBLIC_PATHS` is the exemption list). The cadre endpoints serve personal
data and `S11` writes, so an open port was the same as an open database. Unauthenticated
callers get `401 {"detail": "Not authenticated"}`.

The same middleware stamps **`Cache-Control: no-store` on every response**. These payloads
are personal data or the login identity and are never cacheable per-user: without it the
browser may hold them on disk past logout and serve them to whoever signs in next on that
machine. It is also what guarantees a fresh login re-reads every endpoint from the network
rather than the HTTP cache.

The session token is a `secrets.token_urlsafe(32)` in an **httpOnly** cookie
(`SameSite=lax`, `Path=/`, 8-hour expiry) — never `localStorage`, so page scripts cannot
read it. A fresh token is issued on every login, so a pre-set cookie cannot be fixated,
and `S16` deletes it server-side rather than only clearing the browser copy. Set
`COOKIE_SECURE=true` in `.env` wherever there is TLS; it is off by default because dev
and the PM2 deployment both serve plain HTTP.

**That plain HTTP is the one real credential exposure left.** `S14`'s request body carries
the password, and every later request carries the session cookie, so on an untrusted
network both are readable in transit. Note that seeing the payload in your own DevTools
Network tab is *not* that leak — it is the browser showing you the request you just made,
and no server change can or should hide it. Do not try to fix it by hashing the password
in the browser: the hash simply becomes the credential, replayable by anyone who captures
it, and it would break compatibility with the Java portal that writes `Hash_Key`. The fix
is TLS in front of both processes, then `COOKIE_SECURE=true`.

Sessions live in a **process dictionary**, so a backend restart logs everyone out — with
`--reload` that is every code edit. That is the trade for needing no schema change; move
`SESSIONS` to a table to outlive restarts or to run more than one worker.

Failed logins are throttled to 10 per username per 15 minutes. The key is the **username,
not the client IP**: `dev` and `preview` both proxy `/api` through Vite, so every request
arrives from `127.0.0.1` and an IP bucket would throttle the entire app at once. The cost
is that a known username can be locked out for the window, including for its real owner.

Caveats found while wiring the UI:

- `S5`/`S6` take `proposal_election_type_id` from the caller (they used to hardcode `8`).
  Row 8 is **Panchayat**, and it originally had `is_active` and `order_no` both `NULL`,
  so `S1` hid the only type the seeded data uses. It has since been activated
  (`is_active='Y'`, `order_no=8`), so step 1 of the wizard now filters for real.
  All seeded data is `proposal_election_type_id = 8`, so every other type legitimately
  returns an empty list.
- A `Name` search is `LIKE '%value%'` across the constituency and can return
  thousands of rows (~4s for a common substring); the UI renders only the first 50.
