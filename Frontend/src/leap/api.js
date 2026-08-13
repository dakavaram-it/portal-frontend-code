import { useEffect, useState } from 'react'

// A 401 from a data call means the session lapsed underneath us, so the app has to
// stop showing a logged-in screen. The auth endpoints are exempt: `/login` answers 401 for
// bad credentials and `/me`//`logout` answer 401 when there is simply no session yet — none of
// those are an expiry, and treating a failed login as one would clear the error banner.
const AUTH_PATHS = ['/login', '/me', '/logout']

// Not `/api`: on the deployed host that prefix already belongs to the older party
// dashboard service (its routes live under /api/v1), so /api/login never reaches this
// backend and comes back 404 from that other app. This prefix is unclaimed, so it falls
// through to whatever fronts the site, into the Vite preview proxy, and on to the
// gateway, which serves it under that backend's own mount (/portal-frontend-code).
const API_BASE = '/leapapi'

let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }

const checkUnauthorized = (path, status) => {
  if (status === 401 && !AUTH_PATHS.some((p) => path.startsWith(p))) onUnauthorized()
}

// `/login` returns a signed JWT in its body and sets no cookie, so this is the session — the
// backend reads `Authorization: Bearer <token>` and nothing else. sessionStorage rather
// than localStorage: it dies with the tab, which caps how long a stolen one is worth
// anything. It IS readable by any script on the page; the token's 8h `exp` is what bounds
// that, since logging out cannot revoke one server-side.
const TOKEN_KEY = 'lbe_token'

// Must run wherever the session ends — logout and the 401 handler — or the next caller
// keeps presenting a dead token.
export const clearToken = () => sessionStorage.removeItem(TOKEN_KEY)

// The same token `/login` hands back doubles as the `authToken` the mypartydashboard.com PSA
// service (cadreSearchApi.js / cadreNotesApi.js) wants — one login, one token, two
// backends. Exported rather than kept private so those two files can read it without
// duplicating the sessionStorage key here.
export const getToken = () => sessionStorage.getItem(TOKEN_KEY)

const authHeader = () => {
  const token = sessionStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const get = async (path) => {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeader() })
  if (!res.ok) {
    checkUnauthorized(path, res.status)
    throw new Error(`${path} -> ${res.status}`)
  }
  return res.json()
}

// FastAPI reports its own failures as {detail: "..."}; surface that text so the
// UI can show the real reason (reservation mismatch, position full, duplicate).
const post = async (path, body) => {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    checkUnauthorized(path, res.status)
    throw new Error(data?.detail || `${path} -> ${res.status}`)
  }
  return data
}

// `/me` is how the app finds out whether the stored token is still a live session.
// The two picklists every screen opens with cannot change inside one session — the
// election types are configuration and the assemblies are this user's grants — but the
// Dashboard and the wizard each mounted their own useList for them, so switching screens
// re-paid the round trip and the dropdowns visibly refilled. Cache the *promise*, not the
// resolved value, so two components mounting in the same tick share one request instead
// of racing two. A rejection drops its entry, so the next mount retries rather than
// caching the failure for the rest of the session.
const sessionCache = new Map()

const cached = (key, load) => () => {
  if (!sessionCache.has(key)) {
    sessionCache.set(key, load().catch((err) => {
      sessionCache.delete(key)
      throw err
    }))
  }
  return sessionCache.get(key)
}

// Must run whenever the identity behind the session changes: the assemblies are that
// user's own grants, so handing the previous user's list to the next one would be a
// read-only but real access leak.
export const clearSessionCache = () => sessionCache.clear()

// Warm both picklists the moment the session is known, rather than waiting for a screen
// to mount and ask. The first screen then renders against a request already in flight —
// which is the difference between a dropdown that is filled when the app appears and one
// that fills a beat later. Nothing awaits this; a failure is retried by whichever
// component actually needs the list.
export const prefetchSession = () => {
  getElectionTypes().catch(() => {})
  getAssemblies().catch(() => {})
}

// The token is stripped off here rather than handed on, so `user` stays the shape every
// screen already reads and the token never lands in React state where a rendered prop
// could leak it. `/me` does not repeat it — by then the client already has one.
export const login = async (username, password) => {
  const { token, ...user } = await post('/login', { username, password })
  if (token) sessionStorage.setItem(TOKEN_KEY, token)
  return user
}
export const me = () => get('/me')
export const logout = () => post('/logout', {})
export const getElectionTypes = cached('getElectionTypes', () => get('/getProposalElectionTypes'))
// getUserAccessAssemblies, not getAssemblyConstituenciesInAState: the picklist is the
// assemblies this user is granted, which the backend resolves from the session's user_id.
// getAssemblyConstituenciesInAState (every assembly in the state) still exists on
// the backend and is no longer called from here.
export const getAssemblies = cached('getAssemblies', () => get('/getUserAccessAssemblies'))
export const getMandals = (constituencyId) =>
  get(`/getMandalsInAConstituency?constituency_id=${constituencyId}`)
export const getTowns = (constituencyId) =>
  get(`/getTownsInAConstituency?constituency_id=${constituencyId}`)
export const getProposalConstituenciesByTehsil = (constituencyId, tehsilId, electionTypeId) =>
  get(
    `/getProposalConstituenciesByTehsilId?constituency_id=${constituencyId}` +
      `&tehsil_id=${tehsilId}&proposal_election_type_id=${electionTypeId}`
  )
export const getProposalConstituenciesByTown = (constituencyId, townId, electionTypeId) =>
  get(
    `/getProposalConstituenciesByTownId?constituency_id=${constituencyId}` +
      `&town_id=${townId}&proposal_election_type_id=${electionTypeId}`
  )
export const getPositionsOverview = (proposalConstituencyId) =>
  get(`/getProposalPositionsOverviewByProposalConstituencyId?proposal_constituency_id=${proposalConstituencyId}`)
export const getReservation = (proposalConstituencyId) =>
  get(`/getProposalConstituencyReservation?proposal_constituency_id=${proposalConstituencyId}`)
export const checkPositionAvailability = (proposalPositionId) =>
  get(`/checkProposalPositionAvailability?proposal_position_id=${proposalPositionId}`)
// proposal_status_id is proposal_status's own id — 1 Proposed, 2 Shortlisted. The backend
// defaults it to Proposed, so a caller that does not care may leave it out.
export const assignCandidate = (proposalPositionId, tdpCadreId, proposalStatusId) =>
  post('/assignProposalCandidate', {
    proposal_position_id: proposalPositionId,
    tdp_cadre_id: tdpCadreId,
    ...(proposalStatusId ? { proposal_status_id: proposalStatusId } : {}),
  })
export const searchCadre = (proposalConstituencyId, searchType, searchValue) =>
  get(
    `/cadreSearch?proposal_constituency_id=${proposalConstituencyId}` +
      `&search_type=${searchType}&search_value=${encodeURIComponent(searchValue)}`
  )
// Moves an assigned candidate between Proposed / Shortlisted / Confirmed. The only write
// that edits a proposal_candidate row in place — it changes the status alone, so the slot
// it occupies and getPositionsOverview's proposed_cnt do not move.
export const updateProposalCandidateStatus = (proposalCandidateId, proposalStatusId) =>
  post('/updateProposalCandidateStatus', {
    proposal_candidate_id: proposalCandidateId,
    proposal_status_id: proposalStatusId,
  })
// Drops a candidate from a position. The backend flips is_active to 'N' rather than
// deleting, so the row leaves getProposalCandidates and getPositionsOverview's count and the slot reopens.
export const removeProposalCandidate = (proposalCandidateId) =>
  post('/removeProposalCandidate', { proposal_candidate_id: proposalCandidateId })
export const getProposalCandidates = (proposalPositionId) =>
  get(`/getProposalCandidatesByProposalPositionId?proposal_position_id=${proposalPositionId}`)

// Every position holding at least one candidate, state-wide. The Candidates screen does not
// drill down through the wizard picklists, so it has no proposal_constituency_id to key
// off — this is the whole list, and it filters client-side (the same rows feed its Role dropdown).
export const getPositionsWithCandidates = () => get('/getProposalPositionsWithCandidates')

// Every position under one assembly, across every election type and every local body it
// resolves to — the Dashboard screen's whole picture in one call. Unlike getPositionsWithCandidates this carries
// positions nobody was proposed for too (getDashboardPositions is a LEFT JOIN, not getPositionsWithCandidates's INNER), which is
// what the Dashboard's "Not Started" counts.
export const getDashboardPositions = (constituencyId) =>
  get(`/getDashboardPositionsByConstituencyId?constituency_id=${constituencyId}`)

// The candidate list behind one Dashboard stat tile (Proposed or Confirmed) — same
// (assembly, election type) scope getDashboardPositions already sums over, drilled down to the rows.
export const getDashboardCandidatesByStatus = (constituencyId, electionTypeId, statusId) =>
  get(
    `/getDashboardCandidatesByStatus?constituency_id=${constituencyId}` +
      `&proposal_election_type_id=${electionTypeId}&proposal_status_id=${statusId}`
  )

// A short-lived (5 minute) presigned link to a candidate's uploaded nomination PDF —
// leader-reports blocks all public access, so the stored file_path is not itself
// fetchable and a fresh URL has to be asked for on every view.
export const getNominationFileUrl = (proposalCandidateId) =>
  get(`/getNominationFileUrl?proposal_candidate_id=${proposalCandidateId}`)

// The Confirmed-candidate nomination upload. Multipart, not JSON like every other write
// here, so it bypasses `post` and builds its own FormData request — the browser sets the
// multipart boundary itself as long as Content-Type is left unset.
export const uploadNominationFile = async (proposalCandidateId, file) => {
  const path = '/uploadNominationFile'
  const formData = new FormData()
  formData.append('proposal_candidate_id', proposalCandidateId)
  formData.append('file', file)
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', body: formData })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    checkUnauthorized(path, res.status)
    throw new Error(data?.detail || `${path} -> ${res.status}`)
  }
  return data
}

// One candidate card and the whole compare table are the same payload, so they are the
// same call. Answers {configured: false} with no candidates when the ratings database is
// not wired up, which is a state the UI has to render rather than an error.
export const getCadreScores = (membershipIds) =>
  get(`/getCadreScores?mids=${encodeURIComponent(membershipIds.join(','))}`)

// Loads a list on mount / when deps change, reporting whether it is still in flight.
// `loading` is what lets a caller draw a skeleton instead of an empty-state message —
// without it "still fetching" and "there are none" are the same empty array, which is
// how a slow picklist came to look like an unconfigured one.
export function useLoadable(load, deps) {
  const [state, setState] = useState({ items: [], loading: !!load, error: null })
  useEffect(() => {
    let cancelled = false
    if (!load) {
      setState({ items: [], loading: false, error: null })
      return
    }
    setState((prev) => ({ ...prev, loading: true, error: null }))
    load()
      .then((data) => { if (!cancelled) setState({ items: data, loading: false, error: null }) })
      .catch((err) => {
        if (cancelled) return
        console.error(err)
        setState({ items: [], loading: false, error: err })
      })
    return () => { cancelled = true }
  }, deps)
  return state
}

// The same load, for the callers that only ever wanted the rows: [] until it resolves,
// and [] again if the request fails (error is logged, not shown).
export function useList(load, deps) {
  return useLoadable(load, deps).items
}
