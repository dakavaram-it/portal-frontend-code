import { useState } from 'react'
import { checkDesignationVacancy, assignMainCommitteeMember, deleteMainCommitteeMember } from '../../committeeApi.js'
import { Dropdown, initials } from '../NewPositionModal.jsx'
import { cadreImageUrl } from '../../cadreSearchApi.js'
import useMembershipSearch from './useMembershipSearch.js'
import KssDesignationSearch from './KssDesignationSearch.jsx'

export function IconTrash() {
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

export function IconEye() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

const STATUS_LABEL = { P: 'Proposed', F: 'Finalized' }

export function MemberTable({ members, onRemove, busyId }) {
  if (members.length === 0) return <div className="leap-members-empty">No members added to this committee.</div>
  return (
    <div className="leap-table-card leap-committee-member-table">
      <table className="leap-table">
        <thead>
          <tr>
            <th>Designation</th><th>Photo</th><th>Name</th><th>Enrollment No</th><th>Status</th>
            {onRemove && <th>Remove</th>}
          </tr>
        </thead>
        <tbody>
          {members.map((m, i) => (
            <tr key={m.id ?? i}>
              <td>{m.value}</td>
              <td>
                {m.url ? (
                  <img className="leap-committee-member-photo" src={m.url} alt="" />
                ) : (
                  <span className="leap-committee-staged-photo leap-committee-member-photo">{initials(m.name || '?')}</span>
                )}
              </td>
              <td>{m.name}</td>
              <td>{m.type}</td>
              <td>{m.committeeMemberStatus ? (STATUS_LABEL[m.committeeMemberStatus] || m.committeeMemberStatus) : '—'}</td>
              {onRemove && (
                <td>
                  <button
                    type="button"
                    className="leap-committee-delete-btn"
                    disabled={busyId === m.id}
                    onClick={() => onRemove(m.id, m.name)}
                    title="Remove this member"
                  >
                    {busyId === m.id ? <span className="leap-committee-delete-spinner" /> : <IconTrash />}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// The View/Add pair every "committee at one location" screen shares — Village/Ward,
// Mandal/Town, Constituency (MainCommitteePanel) and Booth/Unit/Cluster (CubsPanel) all
// resolve their own location down to one getCommitteMembersInfo snapshot and then hit the
// same checkIsVacancyForDesignationNew/committeTdpCadreSaveRegistration pair to fill a
// designation — this is that shared second half, so the write flow (and any future fix to
// it) lives in one place rather than two copies drifting apart.
//
// Mount this keyed by whatever identifies the current location (e.g. `key={boothId}`) —
// it owns its own view/add mode and add-flow state, and a location change should reset
// that state the same way a fresh remount does, not carry an old designation pick over to
// a new location.
export default function CommitteeSnapshotPanel({
  snapshot, snapshotLoading, snapshotError, constituencyId, user, onReload, showAdd = true,
  // Uncontrolled by default (own state, own View/Add row, as MainCommitteePanel uses it).
  // A caller that wants the buttons to live somewhere else in its own layout (CubsPanel
  // puts them next to its location picker) passes `mode`/`onModeChange` to run this off
  // externally-owned state instead, and `hideActions` so this component doesn't render a
  // second row of the same two buttons.
  mode: modeProp, onModeChange, hideActions = false,
  // Booth Wise Committee's own Add search (KssDesignationSearch, scoped to one booth) in
  // place of the generic membership-id-only search below — pass `{ locationScopeId,
  // locationId }` to switch to it. Unset for MainCommitteePanel's Village/Mandal/
  // Constituency flow, which keeps the generic search.
  kssSearch,
}) {
  // Neither, until the user actually clicks View or Add — the snapshot loads as soon as
  // its location resolves, but showing it uninvited the moment a booth/mandal/etc. is
  // picked reads as the page deciding for you rather than answering what you asked.
  const [modeState, setModeState] = useState(null)
  const mode = modeProp !== undefined ? modeProp : modeState
  const setMode = onModeChange || setModeState
  const [roleId, setRoleId] = useState('')
  const [roleError, setRoleError] = useState('')
  const [roleChecking, setRoleChecking] = useState(false)
  const [deleteBusyId, setDeleteBusyId] = useState(null)
  // The cadreId currently being assigned, not a plain boolean — KssDesignationSearch can
  // show several members at once and only the one just clicked should show "Assigning…".
  const [assignBusyId, setAssignBusyId] = useState(null)
  const [assignError, setAssignError] = useState('')
  const [assignSuccess, setAssignSuccess] = useState('')
  const search = useMembershipSearch(constituencyId)

  const removeMember = async (id, name) => {
    if (!window.confirm(`Remove ${name || 'this member'} from the committee?`)) return
    setDeleteBusyId(id)
    try {
      const res = await deleteMainCommitteeMember(id, user?.user_id)
      const status = res?.[0]?.status
      if (status && status !== 'Removed') setAssignError(status === 'FeedbackSent' ? 'This member already has feedback on record and cannot be removed.' : status)
      else onReload()
    } catch (err) {
      setAssignError(err.message)
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

  const assignCadre = async (cadreId, memberLabel) => {
    if (!roleId || roleError) return
    setAssignBusyId(cadreId)
    setAssignError('')
    try {
      await assignMainCommitteeMember(roleId, cadreId, user?.user_id)
      setAssignSuccess(`${memberLabel} assigned.`)
      search.reset()
      setRoleId('')
      onReload()
      // Straight to View so the new member shows up in the list they just changed,
      // instead of leaving them staring at the same search/add screen.
      setMode('view')
      setTimeout(() => setAssignSuccess(''), 2500)
    } catch (err) {
      setAssignError(err.message)
    } finally {
      setAssignBusyId(null)
    }
  }

  const assign = () => {
    if (!search.result) { setAssignError('Search for a member to add.'); return }
    assignCadre(search.result.cadreId, search.result.cadreName)
  }

  return (
    <>
      {!hideActions && (
        <div className="leap-committee-actions leap-committee-actions-center">
          <button type="button" className={`leap-btn-secondary accent-blue ${mode === 'view' ? 'is-active' : ''}`} onClick={() => setMode('view')}>
            <IconEye /> View
          </button>
          {showAdd && (
            <button type="button" className={`leap-btn-secondary accent-green ${mode === 'add' ? 'is-active' : ''}`} onClick={() => setMode('add')}>
              <IconPlus /> Add
            </button>
          )}
        </div>
      )}

      <div className="leap-committee-snapshot-content">
        {!mode && !snapshotLoading && (
          <p className="leap-committee-mode-hint">
            Choose <strong>View</strong> to see who's currently on this committee, or <strong>Add</strong> to fill a vacant designation.
          </p>
        )}

        {snapshotError && <div className="leap-form-error">{snapshotError}</div>}
        {snapshotLoading && <div className="leap-skel leap-skel-table" aria-label="Loading" />}

        {!snapshotLoading && snapshot && mode === 'view' && (
          <div className="leap-section">
            <div className="leap-committee-subhead">Members</div>
            {snapshot.locked && (
              <p className="leap-committee-locked-note">
                This Committee Is Confirmed — members cannot be added, updated, or removed.
              </p>
            )}
            <MemberTable members={snapshot.members} onRemove={snapshot.locked ? null : removeMember} busyId={deleteBusyId} />
          </div>
        )}

        {!snapshotLoading && snapshot && mode === 'add' && (
          <div className="leap-committee-panel">
            <h4>Add a committee member</h4>
            <div className="leap-committee-field leap-committee-designation-field">
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
              kssSearch ? (
                <KssDesignationSearch
                  locationScopeId={kssSearch.locationScopeId}
                  locationId={kssSearch.locationId}
                  busyCadreId={assignBusyId}
                  onSelect={(m) => assignCadre(m.cadreId, m.memberName)}
                />
              ) : (
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
                        {search.result.imageUrl ? <img src={cadreImageUrl(search.result.imageUrl)} alt="" /> : initials(search.result.cadreName || '?')}
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
                    <button type="button" className="leap-btn-primary leap-committee-assign-btn" disabled={assignBusyId === search.result.cadreId} onClick={assign}>
                      {assignBusyId === search.result.cadreId ? 'Assigning…' : 'Select & Assign'}
                    </button>
                  )}
                </>
              )
            )}
          </div>
        )}

        {/* Outside the add-mode block on purpose — a successful assign switches mode to
            'view' so the new member shows up in the list, and the confirmation needs to
            still render after that switch rather than disappearing with the add form. */}
        {assignError && <div className="leap-form-error">{assignError}</div>}
        {assignSuccess && <div className="leap-form-success">{assignSuccess}</div>}
      </div>
    </>
  )
}
