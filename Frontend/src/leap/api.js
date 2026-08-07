import { useEffect, useState } from 'react'

// A 401 from a data call means the session lapsed underneath us, so the app has to
// stop showing a logged-in screen. The auth endpoints are exempt: S14 answers 401 for
// bad credentials and S15/S16 answer 401 when there is simply no session yet — none of
// those are an expiry, and treating a failed login as one would clear the error banner.
const AUTH_PATHS = ['/S14login', '/S15me', '/S16logout']

// Not `/api`: on the deployed host that prefix already belongs to the older party
// dashboard service (its routes live under /api/v1), so /api/S14login never reaches this
// backend and comes back 404 from that other app. This prefix is unclaimed, so it falls
// through to whatever fronts the site, into the Vite preview proxy, and on to the
// gateway, which serves it under that backend's own mount (/portal-frontend-code).
const API_BASE = '/leapapi'

let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }

const checkUnauthorized = (path, status) => {
  if (status === 401 && !AUTH_PATHS.some((p) => path.startsWith(p))) onUnauthorized()
}

const get = async (path) => {
  const res = await fetch(`${API_BASE}${path}`)
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    checkUnauthorized(path, res.status)
    throw new Error(data?.detail || `${path} -> ${res.status}`)
  }
  return data
}

// The session is an httpOnly cookie, so it is never readable here; fetch attaches it
// on its own (these are same-origin through the Vite proxy). S15 is how the app finds
// out whether one is still live.
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

export const login = (username, password) => post('/S14login', { username, password })
export const me = () => get('/S15me')
export const logout = () => post('/S16logout', {})
export const getElectionTypes = cached('S1', () => get('/S1getProposalElectionTypes'))
// S21, not S2: the picklist is the assemblies this user is granted, which the backend
// resolves from the session's user_id. S2 (every assembly in the state) still exists on
// the backend and is no longer called from here.
export const getAssemblies = cached('S21', () => get('/S21getUserAccessAssemblies'))
export const getMandals = (constituencyId) =>
  get(`/S3getMandalsInAConstituency?constituency_id=${constituencyId}`)
export const getTowns = (constituencyId) =>
  get(`/S4getTownsInAConstituency?constituency_id=${constituencyId}`)
export const getProposalConstituenciesByTehsil = (constituencyId, tehsilId, electionTypeId) =>
  get(
    `/S5getProposalConstituenciesByTehsilId?constituency_id=${constituencyId}` +
      `&tehsil_id=${tehsilId}&proposal_election_type_id=${electionTypeId}`
  )
export const getProposalConstituenciesByTown = (constituencyId, townId, electionTypeId) =>
  get(
    `/S6getProposalConstituenciesByTownId?constituency_id=${constituencyId}` +
      `&town_id=${townId}&proposal_election_type_id=${electionTypeId}`
  )
export const getPositionsOverview = (proposalConstituencyId) =>
  get(`/S7getProposalPositionsOverviewByProposalConstituencyId?proposal_constituency_id=${proposalConstituencyId}`)
export const getReservation = (proposalConstituencyId) =>
  get(`/S9getProposalConstituencyReservation?proposal_constituency_id=${proposalConstituencyId}`)
export const checkPositionAvailability = (proposalPositionId) =>
  get(`/S10checkProposalPositionAvailability?proposal_position_id=${proposalPositionId}`)
// proposal_status_id is proposal_status's own id — 1 Proposed, 2 Shortlisted. The backend
// defaults it to Proposed, so a caller that does not care may leave it out.
export const assignCandidate = (proposalPositionId, tdpCadreId, proposalStatusId) =>
  post('/S11assignProposalCandidate', {
    proposal_position_id: proposalPositionId,
    tdp_cadre_id: tdpCadreId,
    ...(proposalStatusId ? { proposal_status_id: proposalStatusId } : {}),
  })
export const searchCadre = (proposalConstituencyId, searchType, searchValue) =>
  get(
    `/S12cadreSearch?proposal_constituency_id=${proposalConstituencyId}` +
      `&search_type=${searchType}&search_value=${encodeURIComponent(searchValue)}`
  )
// Moves an assigned candidate between Proposed / Shortlisted / Confirmed. The only write
// that edits a proposal_candidate row in place — it changes the status alone, so the slot
// it occupies and S7's proposed_cnt do not move.
export const updateProposalCandidateStatus = (proposalCandidateId, proposalStatusId) =>
  post('/S20updateProposalCandidateStatus', {
    proposal_candidate_id: proposalCandidateId,
    proposal_status_id: proposalStatusId,
  })
// Drops a candidate from a position. The backend flips is_active to 'N' rather than
// deleting, so the row leaves S13 and S7's count and the slot reopens.
export const removeProposalCandidate = (proposalCandidateId) =>
  post('/S18removeProposalCandidate', { proposal_candidate_id: proposalCandidateId })
export const getProposalCandidates = (proposalPositionId) =>
  get(`/S13getProposalCandidatesByProposalPositionId?proposal_position_id=${proposalPositionId}`)

// Every position holding at least one candidate, state-wide. The Candidates screen does not
// drill down S1..S6, so it has no proposal_constituency_id to key off — this is the whole
// list, and it filters client-side (the same rows feed its Role dropdown).
export const getPositionsWithCandidates = () => get('/S19getProposalPositionsWithCandidates')

// Every position under one assembly, across every election type and every local body it
// resolves to — the Dashboard screen's whole picture in one call. Unlike S19 this carries
// positions nobody was proposed for too (S22 is a LEFT JOIN, not S19's INNER), which is
// what the Dashboard's "Not Started" counts.
export const getDashboardPositions = (constituencyId) =>
  get(`/S22getDashboardPositionsByConstituencyId?constituency_id=${constituencyId}`)

// One candidate card and the whole compare table are the same payload, so they are the
// same call. Answers {configured: false} with no candidates when the ratings database is
// not wired up, which is a state the UI has to render rather than an error.
export const getCadreScores = (membershipIds) =>
  get(`/S17getCadreScores?mids=${encodeURIComponent(membershipIds.join(','))}`)

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
