// The Dashboard 2 backend (PSA-Backend-code/portal-frontend-code-2), reached through the
// `/dash2api` proxy in vite.config.js — the same gateway as /leapapi, a different project
// mounted under it.
//
// The GETs are unauthenticated — that backend serves its reads to anyone who can reach it.
// The three POSTs are not: they carry the portal's own session token, which that backend
// verifies with the same secret /login signs with, and take the acting user id from it.
// getToken() comes from api.js so there is one place the token is stored and read.
//
// Scope: every endpoint takes (userLocationLevelId, userLocationLevelValuesStr). Dashboard 2
// runs at STATE access for now — no level, no values — so the two parameters are simply
// omitted and the backend answers state-wide. The one exception is the location list, which
// scopes to the assembly the user drilled into; that is what the pair is for.

import { getToken } from './api.js'

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

// --- writes ----------------------------------------------------------------
// Every write needs a signed-in user: the backend rejects an anonymous call with 401 and
// stamps updated_user_id from the token, so the audit trail cannot be forged from here.
async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() || ''}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
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

// Proposed -> Confirmed, and back. proposalStatusId 1 un-confirms, which is how a mis-click
// is undone; the backend refuses a second Confirmed on the same location with a 409.
export function confirmCandidate(proposalCandidateId, proposalStatusId = 2) {
  return post('/confirmCandidate', {
    proposal_candidate_id: proposalCandidateId,
    proposal_status_id: proposalStatusId,
  })
}

// Confirmed -> Nomination filed, and back. This is proposal_candidate.is_nominated, which is
// what Dashboard 2's stage 3 reads — NOT the nomination PDF, which is Dashboard 1's separate
// mechanism and moves nothing here.
export function markNominated(proposalCandidateId, isNominated = 'Y') {
  return post('/markNominated', {
    proposal_candidate_id: proposalCandidateId,
    is_nominated: isNominated,
  })
}

// Drops a name off its location. A soft delete: is_active flips to 'N', so the slot reopens
// and who was proposed survives.
export function removeCandidate(proposalCandidateId) {
  return post('/removeCandidate', { proposal_candidate_id: proposalCandidateId })
}
