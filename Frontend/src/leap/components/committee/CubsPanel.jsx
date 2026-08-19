import { useEffect, useState } from 'react'
import {
  getCUBSConvenorCount,
  getCUBSConvenorDetails,
  getCubsBooths,
  getCubsUnits,
  getCubsClusters,
  getMainCommitteeSnapshot,
  KSS_SEARCH_LOCATION_SCOPE_BOOTH,
} from '../../committeeApi.js'
import { Dropdown } from '../NewPositionModal.jsx'
import CommitteeSnapshotPanel, { IconEye, IconPlus } from './CommitteeSnapshotPanel.jsx'
import CommitteeStatTile from './CommitteeStatTile.jsx'

const ICON_PROPS = {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
}
function IconGrid() {
  return <svg {...ICON_PROPS}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /></svg>
}
function IconUserCheck() {
  return <svg {...ICON_PROPS}><circle cx="9" cy="8" r="3.3" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 11l2 2 3.5-3.5" /></svg>
}
function IconUsers() {
  return <svg {...ICON_PROPS}><circle cx="8.5" cy="8" r="3" /><path d="M2.5 20a6 6 0 0 1 12 0" /><circle cx="17" cy="9" r="2.3" /><path d="M15 14.2A5 5 0 0 1 20.5 19" /></svg>
}

const LOCATION_LABEL = { 15: 'Booth', 16: 'Unit', 17: 'Cluster' }
const LOCATION_PICKLIST = { 15: getCubsBooths, 16: getCubsUnits, 17: getCubsClusters }
// getCommitteMembersInfo's own locationType string per level — 'booth' is confirmed
// against a live call; 'unit'/'cluster' are inferred by the same naming convention (the
// picklists right above follow it) and haven't been confirmed against the service yet.
const LOCATION_TYPE = { 15: 'booth', 16: 'unit', 17: 'cluster' }

// The Booth / Unit / Cluster radios' shared view: convenor & co-convenor coverage for
// whichever committeeLevelId (15/16/17) is selected, then the location-by-location
// breakdown behind the total, and — same View/Add pair MainCommitteePanel's Committees
// tab uses — one location's own committee, picked from that level's own picklist.
export default function CubsPanel({ constituencyId, committeeLevelId, locationName, user }) {
  const [overview, setOverview] = useState(null)
  const [error, setError] = useState('')
  const [details, setDetails] = useState(null) // null = closed, undefined = loading, array = loaded
  const [detailsError, setDetailsError] = useState('')

  const [locationId, setLocationId] = useState('')
  const [locationOptions, setLocationOptions] = useState([])
  const [locationsLoading, setLocationsLoading] = useState(true)
  const [snapshot, setSnapshot] = useState(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [snapshotError, setSnapshotError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  // Owned here rather than inside CommitteeSnapshotPanel (which normally owns it and
  // renders its own View/Add row) so the buttons can sit right beside Select Booth
  // instead of on their own row below it.
  const [mode, setMode] = useState(null)

  const pickLocation = (id) => {
    setLocationId(id)
    setMode(null)
  }

  useEffect(() => {
    let cancelled = false
    setOverview(null)
    setError('')
    setDetails(null)
    getCUBSConvenorCount(committeeLevelId, constituencyId)
      .then((data) => { if (!cancelled) setOverview(data) })
      .catch((err) => {
        if (cancelled) return
        console.error(err)
        setError(err.message)
        setOverview({})
      })
    return () => { cancelled = true }
  }, [committeeLevelId, constituencyId])

  useEffect(() => {
    setLocationId('')
    setLocationOptions([])
    setLocationsLoading(true)
    setMode(null)
    let cancelled = false
    LOCATION_PICKLIST[committeeLevelId](constituencyId)
      .then((rows) => { if (!cancelled) setLocationOptions(rows) })
      .catch((err) => { console.error(err); if (!cancelled) setLocationOptions([]) })
      .finally(() => { if (!cancelled) setLocationsLoading(false) })
    return () => { cancelled = true }
  }, [committeeLevelId, constituencyId])

  useEffect(() => {
    setSnapshot(null)
    if (!locationId) return
    let cancelled = false
    setSnapshotLoading(true)
    setSnapshotError('')
    getMainCommitteeSnapshot(LOCATION_TYPE[committeeLevelId], locationId, 'main')
      .then((r) => {
        if (cancelled) return
        // The response's own `locationName` doubles as a confirmed/locked flag here — 'N'
        // means still open, anything else means the committee is confirmed and members
        // can't be added, updated, or removed (the legacy screen's own check).
        const locked = typeof r?.locationName === 'string' && r.locationName !== 'N'
        setSnapshot({ roles: r?.result || [], members: r?.hamletsOfTownship || [], locked })
      })
      .catch((err) => {
        if (cancelled) return
        console.error(err)
        setSnapshotError(err.message)
        setSnapshot({ roles: [], members: [] })
      })
      .finally(() => { if (!cancelled) setSnapshotLoading(false) })
    return () => { cancelled = true }
  }, [locationId, committeeLevelId, reloadKey])

  const bumpSnapshot = () => setReloadKey((k) => k + 1)

  const openDetails = () => {
    setDetails(undefined)
    setDetailsError('')
    getCUBSConvenorDetails(committeeLevelId, constituencyId)
      .then((rows) => setDetails(rows || []))
      .catch((err) => {
        console.error(err)
        setDetailsError(err.message)
        setDetails([])
      })
  }

  const label = LOCATION_LABEL[committeeLevelId] || 'Location'
  const loading = !overview

  const pct = (n) => (n === undefined || n === null ? '—' : `${n}%`)

  return (
    <div>
      <div className="leap-section-header leap-committee-section-header">
        <h3>{label} Wise Committee</h3>
      </div>

      {error && <div className="leap-form-error">{error}</div>}

      {!error && (
        <div className="leap-committee-overview-card">
          <div className="leap-committee-subhead leap-committee-subhead-flush">Overview</div>
          <div className="leap-stat-row leap-committee-stat-row leap-committee-stat-row-triple">
            <CommitteeStatTile
              icon={<IconGrid />} accent="#2563eb" label={`Total ${label}s`}
              value={overview?.totalCommittee} loading={loading} sub="Tap to view convener details"
              onClick={openDetails}
            />
            <CommitteeStatTile
              icon={<IconUserCheck />} accent="#d97706" label="Convener"
              value={loading ? undefined : `${overview?.convenorAssigned ?? 0}/${overview?.convenorRequired ?? 0}`}
              loading={loading}
              sub={loading ? undefined : `${pct(overview?.convenorAssignedPercentage)} assigned`}
            />
            <CommitteeStatTile
              icon={<IconUsers />} accent="#059669" label="Co-Convener"
              value={loading ? undefined : `${overview?.coConvenorAssigned ?? 0}/${overview?.coConvenorRequired ?? 0}`}
              loading={loading}
              sub={loading ? undefined : `${pct(overview?.coConvenorAssignedPercentage)} assigned`}
            />
          </div>
        </div>
      )}

      <div className="leap-committee-panel leap-committee-members-card">
        <div className="leap-committee-members-row">
          <div className="leap-committee-field">
            <label>Select {label}</label>
            {locationsLoading ? (
              <div className="leap-skel leap-skel-input" aria-label={`Loading ${label.toLowerCase()}s`} />
            ) : (
              <Dropdown
                value={locationId}
                onChange={pickLocation}
                searchable
                placeholder={`Select ${label.toLowerCase()}…`}
                options={locationOptions}
              />
            )}
          </div>

          {locationId && (
            <div className="leap-committee-actions">
              <button type="button" className={`leap-btn-secondary accent-blue ${mode === 'view' ? 'is-active' : ''}`} onClick={() => setMode('view')}>
                <IconEye /> View
              </button>
              <button type="button" className={`leap-btn-secondary accent-green ${mode === 'add' ? 'is-active' : ''}`} onClick={() => setMode('add')}>
                <IconPlus /> Add
              </button>
            </div>
          )}
        </div>

        {locationId && (
          <CommitteeSnapshotPanel
            key={locationId}
            snapshot={snapshot}
            snapshotLoading={snapshotLoading}
            snapshotError={snapshotError}
            constituencyId={constituencyId}
            user={user}
            onReload={bumpSnapshot}
            mode={mode}
            onModeChange={setMode}
            hideActions
            kssSearch={
              // Only confirmed for Booth (committeeLevelId 15) — see committeeApi.js's
              // own note on KSS_SEARCH_LOCATION_SCOPE_BOOTH. Unit/Cluster keep the
              // generic search until that's confirmed too.
              committeeLevelId === 15
                ? { locationScopeId: KSS_SEARCH_LOCATION_SCOPE_BOOTH, locationId }
                : undefined
            }
          />
        )}
      </div>

      {details !== null && (
        <div className="leap-modal-overlay" onClick={() => setDetails(null)}>
          <div className="leap-committee-modal" onClick={(e) => e.stopPropagation()}>
            <div className="leap-modal-title-row">
              <div>
                <h3>{locationName ? `${locationName} — ` : ''}{label} wise convener &amp; co-convener details</h3>
              </div>
              <button type="button" className="leap-modal-close" onClick={() => setDetails(null)}>✕</button>
            </div>

            {detailsError && <div className="leap-form-error">{detailsError}</div>}
            {!detailsError && details === undefined && <div className="leap-skel leap-skel-table" aria-label="Loading" />}
            {!detailsError && details && details.length === 0 && <div className="leap-members-empty">No data available.</div>}
            {!detailsError && details && details.length > 0 && (
              <div className="leap-table-card">
                <table className="leap-table">
                  <thead>
                    <tr>
                      <th>{label}</th>
                      <th>Convener Name</th><th>Membership No</th><th>Mobile</th>
                      <th>Co-Convener Name</th><th>Membership No</th><th>Mobile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.map((r, i) => (
                      <tr key={i}>
                        <td>{r.locationName}</td>
                        <td>{r.convenorName ?? '—'}</td><td>{r.convenorMembershipId ?? '—'}</td><td>{r.convenorMobile ?? '—'}</td>
                        <td>{r.coConvenorName ?? '—'}</td><td>{r.coConvenorMembershipId ?? '—'}</td><td>{r.coConvenorMobile ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
