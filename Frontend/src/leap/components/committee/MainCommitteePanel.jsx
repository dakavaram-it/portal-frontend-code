import { useEffect, useState } from 'react'
import {
  getMainCommitteeMandals,
  getMainCommitteeLocationsByMandal,
  getMainCommitteeLocations,
  getAffiliatedCommittees,
  checkDesignationVacancy,
  getMainCommitteeSnapshot,
  getAllCommitteeMembersInALocation,
  deleteMainCommitteeMember,
  assignMainCommitteeMember,
} from '../../committeeApi.js'
import { Dropdown, initials } from '../NewPositionModal.jsx'
import useMembershipSearch from './useMembershipSearch.js'

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16" />
      <path d="M9 7V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7" />
      <path d="M6 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5L18 7" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

const LEVELS = [
  { id: '1', label: 'Village / Ward Wise Committee' },
  { id: '2', label: 'Mandal / Town / Division Wise Committee' },
  { id: '3', label: 'Constituency Wise Committee' },
]

const COMMITTEE_TYPES = [
  { value: '1', label: 'Main Committee' },
  { value: '2', label: 'Affiliated Committee' },
  { value: '3', label: 'View All Committee Info' },
]

const STATUS_LABEL = { P: 'Proposed', F: 'Finalized' }

// The one location-scoping input getCommitteMembersInfo actually wants — see
// committeeApi.js's own note on why this is the fuzziest part of the contract. Village/
// Ward leaves it blank (the legacy code never resolves it to anything else in the live
// path), Mandal/Town/Division and Affiliated pass 'mandal', Constituency passes
// 'assembly'.
function locationTypeFor(levelId, committeeTypeId) {
  if (committeeTypeId === '2') return levelId === '3' ? 'assembly' : ''
  if (levelId === '2') return 'mandal'
  if (levelId === '3') return 'assembly'
  return ''
}

// The legacy carousel's grey/orange/green/red Total/Proposed/Finalized/Vacancy badges,
// as a wrapping card grid instead — colour repeats what the number already says (via the
// legend) rather than being the only thing carrying it.
function RoleSummaryGrid({ roles }) {
  if (roles.length === 0) return null
  return (
    <div className="leap-committee-role-section">
      <div className="leap-committee-role-legend">
        <span><i className="leap-committee-role-dot total" /> Total</span>
        <span><i className="leap-committee-role-dot proposed" /> Proposed</span>
        <span><i className="leap-committee-role-dot finalized" /> Finalized</span>
        <span><i className="leap-committee-role-dot vacancy" /> Vacancy</span>
      </div>
      <div className="leap-committee-role-grid">
        {roles.map((r) => (
          <div className="leap-committee-role-card" key={r.locationId}>
            <div className="leap-committee-role-name">{r.locationName}</div>
            <div className="leap-committee-role-badges">
              <span className="leap-committee-role-badge total">{r.totalCount ?? 0}</span>
              {r.roleType === 'P' && <span className="leap-committee-role-badge proposed">{r.proposedCount ?? 0}</span>}
              <span className="leap-committee-role-badge finalized">{r.finalizedCount ?? 0}</span>
              <span className="leap-committee-role-badge vacancy">{r.vaccancyCount ?? 0}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MemberTable({ members, onRemove, busyId }) {
  if (members.length === 0) return <div className="leap-members-empty">No members added to this committee.</div>
  return (
    <div className="leap-table-card">
      <table className="leap-table">
        <thead>
          <tr><th>Designation</th><th>Photo</th><th>Name</th><th>Enrollment No</th><th>Status</th><th>Remove</th></tr>
        </thead>
        <tbody>
          {members.map((m, i) => (
            <tr key={m.id ?? i}>
              <td>{m.value}</td>
              <td>
                {m.url ? (
                  <img src={m.url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <span className="leap-committee-staged-photo" style={{ width: 32, height: 32, fontSize: 11 }}>{initials(m.name || '?')}</span>
                )}
              </td>
              <td>{m.name}</td>
              <td>{m.type}</td>
              <td>{m.committeeMemberStatus ? (STATUS_LABEL[m.committeeMemberStatus] || m.committeeMemberStatus) : '—'}</td>
              <td>
                {onRemove && (
                  <button
                    type="button"
                    className="leap-committee-delete-btn"
                    disabled={busyId === m.id}
                    onClick={() => onRemove(m.id)}
                    title="Remove this member"
                  >
                    {busyId === m.id ? <span className="leap-committee-delete-spinner" /> : <IconTrash />}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// The Village-Ward / Mandal-Town-Division / Constituency wise Main & Affiliated
// Committee flow — the "Committees" tab in the legacy screen. Simpler than KSS in one
// way (one snapshot call carries both the designation list and the member list) and
// more involved in another (three location-picking shapes depending on which radio is
// picked).
export default function MainCommitteePanel({ constituencyId, user }) {
  const [levelId, setLevelId] = useState('1')
  const [mandalId, setMandalId] = useState('')
  const [mandalOptions, setMandalOptions] = useState([])
  const [locationId, setLocationId] = useState('')
  const [locationOptions, setLocationOptions] = useState([])
  const [committeeTypeId, setCommitteeTypeId] = useState('1')
  const [affiliatedId, setAffiliatedId] = useState('')
  const [affiliatedOptions, setAffiliatedOptions] = useState([])

  const [snapshot, setSnapshot] = useState(null) // {roles, members} | null
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [snapshotError, setSnapshotError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const [mode, setMode] = useState('view')
  const [roleId, setRoleId] = useState('')
  const [roleError, setRoleError] = useState('')
  const [roleChecking, setRoleChecking] = useState(false)

  const [deleteBusyId, setDeleteBusyId] = useState(null)
  const [assignBusy, setAssignBusy] = useState(false)
  const [assignError, setAssignError] = useState('')
  const [assignSuccess, setAssignSuccess] = useState('')

  const search = useMembershipSearch(constituencyId)

  // Resetting the whole downstream selection whenever the level radio changes — a
  // location from one level's shape means nothing under another's.
  const changeLevel = (id) => {
    setLevelId(id)
    setMandalId('')
    setLocationId('')
    setLocationOptions([])
    setCommitteeTypeId('1')
    setAffiliatedId('')
    setAffiliatedOptions([])
    setSnapshot(null)
    setMode('view')
    setRoleId('')
  }

  useEffect(() => {
    if (levelId !== '1') return
    let cancelled = false
    getMainCommitteeMandals(constituencyId)
      .then((rows) => { if (!cancelled) setMandalOptions(rows) })
      .catch((err) => console.error(err))
    return () => { cancelled = true }
  }, [levelId, constituencyId])

  useEffect(() => {
    if (levelId !== '1' || !mandalId) return
    let cancelled = false
    setLocationId('')
    getMainCommitteeLocationsByMandal(mandalId, constituencyId)
      .then((rows) => { if (!cancelled) setLocationOptions(rows) })
      .catch((err) => console.error(err))
    return () => { cancelled = true }
  }, [levelId, mandalId, constituencyId])

  useEffect(() => {
    if (levelId !== '2') return
    let cancelled = false
    getMainCommitteeLocations(constituencyId)
      .then((rows) => { if (!cancelled) setLocationOptions(rows) })
      .catch((err) => console.error(err))
    return () => { cancelled = true }
  }, [levelId, constituencyId])

  useEffect(() => {
    if (committeeTypeId !== '2') { setAffiliatedOptions([]); setAffiliatedId(''); return }
    const locationType = levelId === '3' ? 'assembly' : ''
    const locationValue = levelId === '3' ? constituencyId : locationId
    if (levelId !== '3' && !locationValue) return
    let cancelled = false
    getAffiliatedCommittees(locationType, locationValue)
      .then((rows) => { if (!cancelled) setAffiliatedOptions(rows) })
      .catch((err) => console.error(err))
    return () => { cancelled = true }
  }, [committeeTypeId, levelId, locationId, constituencyId])

  // A selection is "complete" once every field the current level/type combination needs
  // has a value — that's what triggers the one snapshot fetch both View and Add read
  // from, instead of the legacy's two separate calls for the same data.
  const locationValue = levelId === '3' ? constituencyId : locationId
  const selectionComplete =
    (levelId !== '3' ? !!locationValue : true) &&
    (committeeTypeId === '2' ? !!affiliatedId : committeeTypeId !== '0')

  useEffect(() => {
    setSnapshot(null)
    setMode('view')
    setRoleId('')
    if (!selectionComplete) return
    let cancelled = false
    setSnapshotLoading(true)
    setSnapshotError('')
    const load = committeeTypeId === '3'
      ? getAllCommitteeMembersInALocation(locationTypeFor(levelId, committeeTypeId), locationValue).then((r) => ({ roles: [], members: r?.hamletsOfTownship || [] }))
      : getMainCommitteeSnapshot(
          locationTypeFor(levelId, committeeTypeId),
          committeeTypeId === '2' ? affiliatedId : locationValue,
          committeeTypeId === '2' ? 'affiliated' : 'main',
        ).then((r) => ({ roles: r?.result || [], members: r?.hamletsOfTownship || [] }))
    load
      .then((data) => { if (!cancelled) setSnapshot(data) })
      .catch((err) => {
        if (cancelled) return
        console.error(err)
        setSnapshotError(err.message)
        setSnapshot({ roles: [], members: [] })
      })
      .finally(() => { if (!cancelled) setSnapshotLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionComplete, levelId, committeeTypeId, locationValue, affiliatedId, reloadKey])

  const bump = () => setReloadKey((k) => k + 1)

  const removeMember = async (id) => {
    setDeleteBusyId(id)
    try {
      const res = await deleteMainCommitteeMember(id)
      const status = res?.[0]?.status
      if (status && status !== 'Removed') setSnapshotError(status === 'FeedbackSent' ? 'This member already has feedback on record and cannot be removed.' : status)
      else bump()
    } catch (err) {
      setSnapshotError(err.message)
    } finally {
      setDeleteBusyId(null)
    }
  }

  const pickRole = async (id) => {
    setRoleId(id)
    setRoleError('')
    search.reset()
    if (!id) return
    setRoleChecking(true)
    try {
      const msg = await checkDesignationVacancy(id)
      if (msg && String(msg).trim()) setRoleError(String(msg).trim())
    } catch (err) {
      setRoleError(err.message)
    } finally {
      setRoleChecking(false)
    }
  }

  const assign = async () => {
    if (!roleId || roleError) return
    if (!search.result) { setAssignError('Search for a member to add.'); return }
    setAssignBusy(true)
    setAssignError('')
    try {
      await assignMainCommitteeMember(roleId, search.result.cadreId, user?.user_id)
      setAssignSuccess(`${search.result.cadreName} assigned.`)
      search.reset()
      setRoleId('')
      bump()
      setTimeout(() => setAssignSuccess(''), 2500)
    } catch (err) {
      setAssignError(err.message)
    } finally {
      setAssignBusy(false)
    }
  }

  return (
    <div>
      <div className="leap-chip-list leap-committee-chip-list" role="radiogroup" aria-label="Committee scope">
        {LEVELS.map((l) => (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={levelId === l.id}
            className={`leap-chip-option ${levelId === l.id ? 'selected' : ''}`}
            onClick={() => changeLevel(l.id)}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="leap-section-header leap-committee-section-header">
        <h3>{LEVELS.find((l) => l.id === levelId)?.label}</h3>
      </div>

      <div className="leap-committee-form-row">
        {levelId === '1' && (
          <div className="leap-committee-field">
            <label>Mandal / Municipality / Corporation</label>
            <Dropdown value={mandalId} onChange={setMandalId} searchable placeholder="Select…" options={mandalOptions} />
          </div>
        )}
        {(levelId === '1' || levelId === '2') && (
          <div className="leap-committee-field">
            <label>Location</label>
            <Dropdown
              value={locationId}
              onChange={setLocationId}
              searchable
              placeholder="Select…"
              options={locationOptions}
              disabled={levelId === '1' && !mandalId}
            />
          </div>
        )}
        <div className="leap-committee-field">
          <label>Committee Type</label>
          <Dropdown value={committeeTypeId} onChange={setCommitteeTypeId} options={COMMITTEE_TYPES} />
        </div>
        {committeeTypeId === '2' && (
          <div className="leap-committee-field">
            <label>Affiliated Committee</label>
            <Dropdown value={affiliatedId} onChange={setAffiliatedId} searchable placeholder="Select…" options={affiliatedOptions} />
          </div>
        )}
      </div>

      {!selectionComplete && (
        <div className="leap-members-empty">Complete the selection above to view or add committee members.</div>
      )}

      {selectionComplete && (
        <>
          <div className="leap-committee-actions">
            <button type="button" className={`leap-btn-secondary ${mode === 'view' ? 'accent-amber' : ''}`} onClick={() => setMode('view')}>
              View
            </button>
            {committeeTypeId !== '3' && (
              <button type="button" className={`leap-btn-secondary ${mode === 'add' ? 'accent-amber' : ''}`} onClick={() => setMode('add')}>
                Add
              </button>
            )}
          </div>

          {snapshotError && <div className="leap-form-error">{snapshotError}</div>}
          {snapshotLoading && <div className="leap-skel leap-skel-table" aria-label="Loading" />}

          {!snapshotLoading && snapshot && mode === 'view' && (
            <div className="leap-section">
              <RoleSummaryGrid roles={snapshot.roles} />
              <MemberTable members={snapshot.members} onRemove={removeMember} busyId={deleteBusyId} />
            </div>
          )}

          {!snapshotLoading && snapshot && mode === 'add' && (
            <div className="leap-committee-panel">
              <h4>Add a committee member</h4>
              <div className="leap-committee-field" style={{ maxWidth: 340, marginBottom: 14 }}>
                <label>Designation</label>
                <Dropdown
                  value={roleId}
                  onChange={pickRole}
                  placeholder="Select designation…"
                  options={snapshot.roles.map((r) => ({ value: String(r.locationId), label: r.locationName }))}
                />
              </div>

              {roleChecking && <div className="leap-field-hint">Checking vacancy…</div>}
              {roleError && <div className="leap-form-error">{roleError}</div>}

              {roleId && !roleError && !roleChecking && (
                <>
                  <div className="leap-cadre-search-row">
                    <input
                      value={search.value}
                      onChange={(e) => search.setValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') search.run() }}
                      placeholder="Membership ID (8 digits)"
                    />
                    <button type="button" className="leap-btn-secondary" disabled={search.busy} onClick={search.run}>
                      {search.busy ? 'Searching…' : 'Search'}
                    </button>
                  </div>
                  {search.error && <div className="leap-field-hint">{search.error}</div>}

                  {search.result && (
                    <div className="leap-committee-staged-card">
                      <span className="leap-committee-staged-photo">
                        {search.result.imageUrl ? <img src={search.result.imageUrl} alt="" /> : initials(search.result.cadreName || '?')}
                      </span>
                      <div className="leap-committee-staged-body">
                        <div className="leap-committee-staged-name">{search.result.cadreName}</div>
                        <div className="leap-committee-staged-meta">
                          MID {search.result.membershipId} · {search.result.age || '—'} / {search.result.gender || '—'} · {search.result.casteName || '—'}
                        </div>
                      </div>
                    </div>
                  )}

                  {search.result && (
                    <button type="button" className="leap-btn-primary" disabled={assignBusy} onClick={assign} style={{ marginTop: 10 }}>
                      {assignBusy ? 'Assigning…' : 'Select & Assign'}
                    </button>
                  )}
                </>
              )}

              {assignError && <div className="leap-form-error">{assignError}</div>}
              {assignSuccess && <div className="leap-form-success">{assignSuccess}</div>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
