// The Dashboard 2 backend (PSA-Backend-code/portal-frontend-code-2), reached through the
// `/dash2api` proxy in vite.config.js — the same gateway as /leapapi, a different project
// mounted under it.
//
// Deliberately NOT api.js: that client attaches the session bearer token and routes a 401
// back to the login screen. This backend has no authentication at all, so sending the token
// would be noise and its 401 handling would be dead code.
//
// Scope: every endpoint takes (userLocationLevelId, userLocationLevelValuesStr). Dashboard 2
// runs at STATE access for now — no level, no values — so the two parameters are simply
// omitted and the backend answers state-wide. The one exception is the location list, which
// scopes to the assembly the user drilled into; that is what the pair is for.

const BASE = '/dash2api/api/dashboard2'

async function get(path, params) {
  const qs = new URLSearchParams()
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    qs.append(k, v)
  })
  const query = qs.toString()
  const res = await fetch(`${BASE}${path}${query ? `?${query}` : ''}`)
  if (!res.ok) {
    // FastAPI puts the reason in {detail}; fall back to the status when it does not.
    let detail = ''
    try {
      detail = (await res.json()).detail || ''
    } catch {
      detail = ''
    }
    throw new Error(detail || `${path} failed (${res.status})`)
  }
  return res.json()
}

// A post is identified by the proposal_role_id(s) its card on the tree claims, never by
// the election type: role 5 (Corporator) appears under Municipal Ward, Corporation Ward and
// a stray MPTC constituency, and the tree draws all three as one Corporator card.
// See ./electionTree.js.
function positionParams(position) {
  return { proposalRoleId: (position.roleIds || []).join(',') }
}

// The whole main table plus the six header bars, in one call, state-wide.
export function getPositionSummary() {
  return get('/positionSummary')
}

// One post split by parliament and again by assembly. Both halves sum back to that post's
// row in the summary.
export function getGeoBreakdown(position) {
  return get('/geoBreakdown', positionParams(position))
}

// One post split by the reservations actually configured on its positions.
export function getReservationSummary(position) {
  return get('/reservationSummary', positionParams(position))
}

// One post's locations inside one assembly, with the names proposed on each.
// userLocationLevelId 5 is Assembly; omitting the pair would return the whole state, which
// at 12,451 MPTC locations is not a list anyone can read.
export function getLocations(position, assemblyId, { limit = 200, offset = 0 } = {}) {
  return get('/locations', {
    ...positionParams(position),
    userLocationLevelId: assemblyId ? 5 : undefined,
    userLocationLevelValuesStr: assemblyId || undefined,
    limit,
    offset,
  })
}
