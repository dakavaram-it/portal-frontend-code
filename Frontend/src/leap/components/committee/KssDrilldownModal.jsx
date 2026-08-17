import { useEffect, useMemo, useState } from 'react'
import {
  getBoothWiseKssFillCount,
  getKSSSectionDetails,
  getKSSAssignedMembers,
  getCompleteKssOverview,
  deleteKssSection,
  deleteCommitteeMember,
  saveKssSection,
} from '../../committeeApi.js'
import DataTable from './DataTable.jsx'

const pctSort = (key) => (r) => parseFloat(r[key]) || 0

const TITLES = {
  booths: 'Booth-wise KSS fill count',
  sections: 'KSS sections created',
  members: 'KSS members assigned',
  complete: 'KSS complete overview',
}

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

// The four tables behind the overview tiles and the "Click To KSS Complete Overview"
// link — one modal, switched on `kind`, since all four are read-mostly tables over the
// same constituency and none of them are big enough on their own to earn a separate file.
export default function KssDrilldownModal({ kind, constituencyId, locationName, user, onClose, onChanged }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  // Row-scoped busy/error state for delete and inline-create actions, keyed by whatever
  // id that row's button acts on.
  const [busyId, setBusyId] = useState(null)
  const [rowError, setRowError] = useState({})

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError('')
    const load =
      kind === 'booths' ? getBoothWiseKssFillCount :
      kind === 'sections' ? getKSSSectionDetails :
      kind === 'members' ? getKSSAssignedMembers :
      getCompleteKssOverview
    load(constituencyId)
      .then((data) => { if (!cancelled) setRows(data || []) })
      .catch((err) => {
        if (cancelled) return
        console.error(err)
        setError(err.message)
        setRows([])
      })
    return () => { cancelled = true }
  }, [kind, constituencyId, reloadKey])

  const refresh = () => {
    setReloadKey((k) => k + 1)
    onChanged?.()
  }

  // Memoized so DataTable's `rows` prop keeps the same reference across renders that
  // don't touch `rows` itself (e.g. a delete button's busy state changing) — otherwise a
  // fresh array every render would look like new data and reset its page back to 1.
  const memberRows = useMemo(
    () => (rows || []).filter((r) => r.kssMembershipId !== undefined),
    [rows]
  )

  const removeSection = async (sectionId) => {
    setBusyId(sectionId)
    setRowError((prev) => ({ ...prev, [sectionId]: '' }))
    try {
      await deleteKssSection(sectionId)
      refresh()
    } catch (err) {
      setRowError((prev) => ({ ...prev, [sectionId]: err.message }))
    } finally {
      setBusyId(null)
    }
  }

  const removeMember = async (committeeMemberId) => {
    setBusyId(committeeMemberId)
    setRowError((prev) => ({ ...prev, [committeeMemberId]: '' }))
    try {
      await deleteCommitteeMember(committeeMemberId, user?.user_id)
      refresh()
    } catch (err) {
      setRowError((prev) => ({ ...prev, [committeeMemberId]: err.message }))
    } finally {
      setBusyId(null)
    }
  }

  const createPendingSection = async (boothId, fromSerialNo, toSerialNo, key) => {
    setBusyId(key)
    setRowError((prev) => ({ ...prev, [key]: '' }))
    try {
      await saveKssSection({ boothId, fromSerialNo, toSerialNo, kssCadres: [] })
      refresh()
    } catch (err) {
      setRowError((prev) => ({ ...prev, [key]: err.message }))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="leap-modal-overlay" onClick={onClose}>
      <div className="leap-committee-modal" onClick={(e) => e.stopPropagation()}>
        <div className="leap-modal-title-row">
          <div>
            <h3>{TITLES[kind]}</h3>
            {locationName && <p>{locationName} Constituency</p>}
          </div>
          <button type="button" className="leap-modal-close" onClick={onClose}>✕</button>
        </div>

        {error && <div className="leap-form-error">{error}</div>}
        {!error && rows === null && (
          <div className="leap-loading-block" role="status" aria-live="polite">
            <span className="leap-spinner" aria-hidden="true" />
            <span>Loading…</span>
          </div>
        )}

        {!error && rows && rows.length === 0 && (
          <div className="leap-members-empty">No data available.</div>
        )}

        {!error && rows && rows.length > 0 && kind === 'booths' && (
          <DataTable
            filename="kss-booth-wise-fill-count"
            searchPlaceholder="Search booths…"
            rowKey={(r) => r.partNo}
            rows={rows}
            columns={[
              { key: 'partNo', label: 'Booth' },
              { key: 'totalKss', label: 'Total KSS', numeric: true },
              { key: 'filledKss', label: 'Filled', numeric: true },
              { key: 'filledKssPerc', label: 'Filled %', numeric: true, sortValue: pctSort('filledKssPerc') },
              { key: 'noMemberKssCnt', label: 'Pending', numeric: true },
              { key: 'noMemberKssPerc', label: 'Pending %', numeric: true, sortValue: pctSort('noMemberKssPerc') },
              { key: 'singleKssCnt', label: 'Single', numeric: true },
              { key: 'singleKssPerc', label: 'Single %', numeric: true, sortValue: pctSort('singleKssPerc') },
              { key: 'doubleKssCnt', label: 'Double', numeric: true },
              { key: 'doubleKssPerc', label: 'Double %', numeric: true, sortValue: pctSort('doubleKssPerc') },
            ]}
          />
        )}

        {!error && rows && rows.length > 0 && kind === 'sections' && (
          <DataTable
            filename="kss-sections-created"
            searchPlaceholder="Search sections…"
            rowKey={(r) => r.sectionId}
            rows={rows}
            columns={[
              { key: 'boothName', label: 'Booth' },
              { key: 'sectionName', label: 'Section' },
              { key: 'fromSerialNo', label: 'From', numeric: true },
              { key: 'toSerialNo', label: 'To', numeric: true },
              {
                key: 'remove', label: 'Remove', sortable: false, searchable: false, exportable: false,
                render: (r) => (
                  <>
                    <button
                      type="button"
                      className="leap-committee-delete-btn"
                      disabled={busyId === r.sectionId}
                      onClick={() => removeSection(r.sectionId)}
                      title="Delete this section"
                    >
                      {busyId === r.sectionId ? <span className="leap-committee-delete-spinner" /> : <IconTrash />}
                    </button>
                    {rowError[r.sectionId] && <div className="leap-field-hint">{rowError[r.sectionId]}</div>}
                  </>
                ),
              },
            ]}
          />
        )}

        {!error && rows && rows.length > 0 && kind === 'members' && (
          <DataTable
            filename="kss-members-assigned"
            searchPlaceholder="Search members…"
            rowKey={(r) => r.committeeMemberId}
            rows={memberRows}
            columns={[
              { key: 'boothName', label: 'Booth' },
              { key: 'sectionName', label: 'Section' },
              { key: 'kssName', label: 'Name', value: (r) => r.kssName ?? '—' },
              { key: 'kssMembershipId', label: 'Membership No', value: (r) => r.kssMembershipId ?? '—' },
              { key: 'kssGender', label: 'Gender', value: (r) => r.kssGender ?? '—' },
              { key: 'kssAge', label: 'Age', numeric: true, value: (r) => r.kssAge ?? '—' },
              { key: 'kssMobileNo', label: 'Mobile', value: (r) => r.kssMobileNo ?? '—' },
              {
                key: 'remove', label: 'Remove', sortable: false, searchable: false, exportable: false,
                render: (r) => (
                  <>
                    <button
                      type="button"
                      className="leap-committee-delete-btn"
                      disabled={busyId === r.committeeMemberId}
                      onClick={() => removeMember(r.committeeMemberId)}
                      title="Remove this member"
                    >
                      {busyId === r.committeeMemberId ? <span className="leap-committee-delete-spinner" /> : <IconTrash />}
                    </button>
                    {rowError[r.committeeMemberId] && <div className="leap-field-hint">{rowError[r.committeeMemberId]}</div>}
                  </>
                ),
              },
            ]}
          />
        )}

        {!error && rows && rows.length > 0 && kind === 'complete' && (
          <div className="leap-table-card">
            <table className="leap-table">
              <thead>
                <tr>
                  <th>Booth</th><th>Max Serial No</th><th>From</th><th>To</th>
                  <th>Section</th><th>First Member</th><th>Second Member</th>
                </tr>
              </thead>
              <tbody>
                {rows.flatMap((booth) =>
                  (booth.sections || []).map((s, si) => {
                    const key = `${booth.boothId}_${s.fromSerialNo}_${s.toSerialNo}`
                    const pending = s.sectionName === 'Pending'
                    return (
                      <tr key={key}>
                        <td>{booth.partNo}</td>
                        <td>{booth.maxSerialNo}</td>
                        <td>{s.fromSerialNo}</td>
                        <td>{s.toSerialNo}</td>
                        <td>
                          {pending ? (
                            <>
                              <button
                                type="button"
                                className="leap-committee-link-btn"
                                disabled={busyId === key}
                                onClick={() => createPendingSection(booth.boothId, s.fromSerialNo, s.toSerialNo, key)}
                              >
                                {busyId === key ? 'Creating…' : 'Create'}
                              </button>
                              {rowError[key] && <div className="leap-field-hint">{rowError[key]}</div>}
                            </>
                          ) : s.sectionName}
                        </td>
                        <td>{s.firstMemberName || '—'}</td>
                        <td>{s.secondMemberName || '—'}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
