import { useEffect, useState } from 'react'
import { getCUBSConvenorCount, getCUBSConvenorDetails } from '../../committeeApi.js'
import CommitteeStatTile from './CommitteeStatTile.jsx'

const ICON_PROPS = {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
}
function IconGrid() {
  return <svg {...ICON_PROPS}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></svg>
}

const LOCATION_LABEL = { 15: 'Booth', 16: 'Unit', 17: 'Cluster' }

// The Booth / Unit / Cluster radios' shared view: convenor & co-convenor coverage for
// whichever committeeLevelId (15/16/17) is selected, then the location-by-location
// breakdown behind the total.
export default function CubsPanel({ constituencyId, committeeLevelId, locationName }) {
  const [overview, setOverview] = useState(null)
  const [error, setError] = useState('')
  const [details, setDetails] = useState(null) // null = closed, undefined = loading, array = loaded
  const [detailsError, setDetailsError] = useState('')

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
        <>
          <div className="leap-stat-row leap-committee-stat-row leap-committee-stat-row-narrow">
            <CommitteeStatTile
              icon={<IconGrid />} accent="#2563eb" label={`Total ${label}s`}
              value={overview?.totalCommittee} loading={loading} sub="Tap to view convener details"
              onClick={openDetails}
            />
          </div>

          <div className="leap-table-card">
            <table className="leap-table">
              <thead>
                <tr><th>Role</th><th>Required</th><th>Assigned</th><th>Assigned %</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td className="leap-table-title">Convener</td>
                  <td>{overview?.convenorRequired ?? '…'}</td>
                  <td>{overview?.convenorAssigned ?? '…'}</td>
                  <td>{loading ? '…' : pct(overview?.convenorAssignedPercentage)}</td>
                </tr>
                <tr>
                  <td className="leap-table-title">Co-Convener</td>
                  <td>{overview?.coConvenorRequired ?? '…'}</td>
                  <td>{overview?.coConvenorAssigned ?? '…'}</td>
                  <td>{loading ? '…' : pct(overview?.coConvenorAssignedPercentage)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

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
