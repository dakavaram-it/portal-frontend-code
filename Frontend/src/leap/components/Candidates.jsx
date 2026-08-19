import { useEffect, useMemo, useState } from 'react'
import {
  getPositionsWithCandidates,
  getProposalCandidates,
} from '../api.js'
import { MemberCard, PhotoViewer, STATUS_META, loadScores } from './NewPositionModal.jsx'
import DataTable from './committee/DataTable.jsx'

// The proposal_status rows the filter offers. Their ids are what getPositionsWithCandidates counts per
// position and what STATUS_META names on the card, so the filter, the pills and the cards agree.
// Shortlisted is deliberately excluded — the workflow no longer offers it as a status.
const STATUS_FILTERS = [
  { id: 1, label: 'Proposed', countKey: 'proposed_status_cnt' },
  // The getPositionsWithCandidates count key still reads `conformed_` — it is the SQL alias, not a label.
  { id: 3, label: 'Confirmed', countKey: 'conformed_status_cnt' },
]

// A reservation reads 'BC-GENERAL', 'SC-WOMEN', … — the category in front is what the
// chip is tinted by, the same colours the member card's caste field uses.
// Split on the hyphen *or* the space: an unreserved-category seat is spelt 'GENERAL' /
// 'GENERAL WOMEN' with no hyphen, and it is still a reservation to show. Exported because
// the Dashboard's By Location table tints the same values.
export function reservationClass(reservation) {
  if (!reservation) return 'open'
  const category = reservation.split(/[-\s]/)[0].trim().toUpperCase()
  return ['BC', 'OC', 'SC', 'ST', 'GENERAL'].includes(category) ? `cat-${category}` : ''
}

// Distinct {value,label} pairs off the unfiltered row list, in first-seen order. The
// options have to come from every row rather than the filtered ones, or picking a filter
// would empty the dropdowns it was picked from.
function options(rows, valueKey, labelKey) {
  const seen = new Map()
  rows.forEach((r) => {
    if (r[valueKey] != null && !seen.has(String(r[valueKey]))) {
      seen.set(String(r[valueKey]), r[labelKey])
    }
  })
  return [...seen].map(([value, label]) => ({ value, label }))
}

function Select({ value, onChange, placeholder, items }) {
  return (
    <select className="leap-cand-filter-select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {items.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

// `initialFilter` seeds the Election Type / Assembly filters when arriving from the
// Dashboard's location view icon, so the list opens already narrowed to where that
// location's candidates would show up rather than the full unfiltered state-wide list.
// Its `proposalConstituencyId` (that location's own id) additionally skips straight to
// the position's own profiles when the location holds only one — see the load effect.
export default function Candidates({ initialFilter } = {}) {
  // The proposal_position_id whose full-screen detail is open, or null for the list.
  const [openId, setOpenId] = useState(null)
  // Bumped by the refresh button so the list re-reads.
  const [reloadKey, setReloadKey] = useState(0)

  const [electionTypeId, setElectionTypeId] = useState(initialFilter?.electionTypeId || '')
  const [assemblyId, setAssemblyId] = useState(initialFilter?.assemblyId || '')
  const [roleId, setRoleId] = useState('')
  const [statusId, setStatusId] = useState('')

  // getPositionsWithCandidates by hand rather than through useList: that hook reports a failed load as an empty
  // list, so an unreachable backend or a 404 would read as "nobody has been proposed yet".
  // This is the only screen with a single endpoint behind everything it shows, so the
  // difference is the whole screen rather than one picklist.
  const [rows, setRows] = useState([])
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoadError(null)
    getPositionsWithCandidates()
      .then((data) => {
        if (cancelled) return
        setRows(data)
        // Arriving from the Dashboard's View icon for one location: if it holds exactly
        // one position with candidates, skip the list and open its profiles directly —
        // only on this initial load, so a later reload (e.g. after removing a candidate)
        // can't yank the screen back into a detail the user has since navigated away from.
        if (reloadKey === 0 && initialFilter?.proposalConstituencyId) {
          const matches = data.filter(
            (r) => String(r.proposal_constituency_id) === initialFilter.proposalConstituencyId
          )
          if (matches.length === 1) setOpenId(matches[0].proposal_position_id)
        }
      })
      .catch((err) => {
        if (cancelled) return
        console.error(err)
        setRows([])
        setLoadError(err.message)
      })
    return () => { cancelled = true }
  }, [reloadKey])

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (electionTypeId && String(r.proposal_election_type_id) !== electionTypeId) return false
        if (assemblyId && String(r.assembly_constituency_id) !== assemblyId) return false
        if (roleId && String(r.proposal_role_id) !== roleId) return false
        if (statusId) {
          const { countKey } = STATUS_FILTERS.find((s) => String(s.id) === statusId)
          if (!r[countKey]) return false
        }
        return true
      }),
    [rows, electionTypeId, assemblyId, roleId, statusId]
  )

  // One row per position: where it sits, what it is, how full its proposal slots are, the
  // per-status breakdown, and the button into its candidates.
  const columns = useMemo(
    () => [
      {
        key: 'location',
        label: 'Location',
        // Sorts assembly-first so a constituency's local bodies stay together, which the
        // three separate columns used to do by being read left to right.
        sortValue: (r) => `${r.assembly_name} ${r.local_body_name}`,
        value: (r) => `${r.local_body_name} ${r.assembly_name} ${r.mandal_town_name || ''}`,
        csvValue: (r) =>
          `${r.local_body_name} (${r.assembly_name}${r.mandal_town_name ? ` · ${r.mandal_town_name}` : ''})`,
        render: (r) => (
          <>
            <div className="leap-cand-cell-title">{r.local_body_name}</div>
            <div className="leap-cand-cell-sub">
              {r.assembly_name}
              {r.mandal_town_name ? ` · ${r.mandal_town_name}` : ''}
            </div>
          </>
        ),
      },
      {
        key: 'role_name',
        label: 'Position',
        value: (r) => `${r.election_type} ${r.role_name}`,
        sortValue: (r) => r.role_name,
        render: (r) => (
          <>
            <span className="leap-type-chip">{r.election_type}</span>
            <div className="leap-cand-cell-title">{r.role_name}</div>
          </>
        ),
      },
      {
        key: 'reservation_type',
        label: 'Reservation',
        value: (r) => r.reservation_type || 'Unreserved',
        render: (r) => (
          <span className={`leap-res-chip ${reservationClass(r.reservation_type)}`}>
            {r.reservation_type || 'Unreserved'}
          </span>
        ),
      },
      { key: 'max_positions', label: 'Seats', numeric: true },
      {
        key: 'slots',
        label: 'Slots Filled',
        // Sorts on how full the position is, not on the printed string.
        sortValue: (r) => r.proposed_cnt,
        value: (r) => `${r.proposed_cnt} / ${r.max_proposals}`,
        render: (r) => {
          const open = r.max_proposals - r.proposed_cnt
          const pct = r.max_proposals > 0 ? Math.round((r.proposed_cnt / r.max_proposals) * 100) : 0
          return (
            <div className="leap-slot-cell">
              <div className="leap-cand-card-progress-track">
                <div
                  className={`leap-cand-card-progress-fill${open <= 0 ? ' is-full' : ''}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="leap-slot-cell-meta">
                <b>{r.proposed_cnt} / {r.max_proposals}</b>
                <span>{open > 0 ? `${open} open` : 'Full'}</span>
              </div>
            </div>
          )
        },
      },
      {
        key: 'status',
        label: 'Status',
        sortable: false,
        csvValue: (r) =>
          STATUS_FILTERS.filter((s) => r[s.countKey] > 0)
            .map((s) => `${r[s.countKey]} ${s.label}`)
            .join(' · '),
        render: (r) => {
          const pills = STATUS_FILTERS.filter((s) => r[s.countKey] > 0)
          // Every candidate on this position is Shortlisted — a status the filter no
          // longer offers, so it has no pill and the cell would otherwise be blank.
          if (pills.length === 0) return '—'
          return (
            <span className="leap-cand-card-pills">
              {pills.map((s) => (
                <span key={s.id} className={`leap-cand-pill ${STATUS_META[s.id].cls}`}>
                  {r[s.countKey]} {s.label}
                </span>
              ))}
            </span>
          )
        },
      },
      {
        key: 'action',
        label: '',
        sortable: false,
        searchable: false,
        exportable: false,
        render: (r) => (
          <button
            type="button"
            className="leap-btn-secondary"
            onClick={() => setOpenId(r.proposal_position_id)}
          >
            View Candidates
          </button>
        ),
      },
    ],
    []
  )

  const open = rows.find((r) => r.proposal_position_id === openId)

  // A removal can drop the open position out of getPositionsWithCandidates (its last candidate went), so the
  // detail has nothing left to show — fall back to the list rather than a blank screen.
  useEffect(() => {
    if (openId && rows.length > 0 && !rows.some((r) => r.proposal_position_id === openId)) {
      setOpenId(null)
    }
  }, [rows, openId])

  const hasFilter = electionTypeId || assemblyId || roleId || statusId
  const reset = () => { setElectionTypeId(''); setAssemblyId(''); setRoleId(''); setStatusId('') }

  return (
    <div className="leap-cand-screen">
      <div className="leap-cand-header">
        <h2>Candidates</h2>
        <p>Every position with candidates proposed against it.</p>
      </div>

      <div className="leap-cand-filter-bar">
        <Select
          value={electionTypeId}
          onChange={setElectionTypeId}
          placeholder="All Election Types"
          items={options(rows, 'proposal_election_type_id', 'election_type')}
        />
        <Select
          value={assemblyId}
          onChange={setAssemblyId}
          placeholder="All Assemblies"
          items={options(rows, 'assembly_constituency_id', 'assembly_name')}
        />
        <Select
          value={roleId}
          onChange={setRoleId}
          placeholder="All Roles"
          items={options(rows, 'proposal_role_id', 'role_name')}
        />
        <Select
          value={statusId}
          onChange={setStatusId}
          placeholder="All Statuses"
          items={STATUS_FILTERS.map((s) => ({ value: String(s.id), label: s.label }))}
        />
        {hasFilter && (
          <button type="button" className="leap-cand-filter-reset" onClick={reset}>× Reset</button>
        )}
        <span className="leap-cand-filter-count">
          {filtered.length} position{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* The table is not a card, so it does not go inside the card grid — dropped into
          .leap-cand-list it would take one 340px track of it. */}
      {loadError ? (
        <div className="leap-cand-empty leap-cand-error">
          <div className="leap-cand-empty-title">Could not load positions</div>
          <div className="leap-cand-empty-sub">
            The server did not answer this list, so nothing here is the state of the
            database. ({loadError})
          </div>
          <button
            type="button"
            className="leap-cand-retry"
            onClick={() => setReloadKey((k) => k + 1)}
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="leap-cand-empty">
          <div className="leap-cand-empty-title">No positions found</div>
          <div className="leap-cand-empty-sub">
            {rows.length === 0
              ? 'No candidate has been proposed for any position yet.'
              : 'Try changing the filters above.'}
          </div>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.proposal_position_id}
          searchPlaceholder="Search local body, role, assembly…"
          filename="positions-with-candidates"
          tall
        />
      )}

      {open && (
        <PositionCandidatesModal
          positions={[open]}
          title={`${open.local_body_name} · ${open.role_name}`}
          subtitle={`${open.election_type} · ${open.assembly_name}${open.mandal_town_name ? ` · ${open.mandal_town_name}` : ''}`}
          reservation={open.reservation_type}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}

/* The candidates on one or more positions, over the screen that opened it rather than in
   place of it: a title row and the same MemberCard grid the wizard renders. A Dashboard
   location can hold several roles (President + Vice-President), so `positions` is a list
   and each role gets its own heading once there is more than one. Proposing is not offered
   here — that is Assign Members' job. Nor is removing: once a candidate is saved they stay
   on the position; dropping one before it is saved is the staged list's job in Assign Members. */
export function PositionCandidatesModal({ positions, title, subtitle, reservation, onClose }) {
  // proposal_position_id -> its candidates. undefined while getProposalCandidates is in
  // flight, [] once it says none — the two render differently.
  const [candidates, setCandidates] = useState({})
  // membership_id -> the getCadreScores row behind each card's score badge and its Member Since /
  // Renewals fields.
  const [scores, setScores] = useState({})
  const [zoomed, setZoomed] = useState(null)
  const [error, setError] = useState('')

  // The ids, not the array: the caller builds `positions` inline, so the array itself is a
  // new reference on every render of the screen behind this modal.
  const positionIds = positions.map((p) => p.proposal_position_id).join(',')

  useEffect(() => {
    let cancelled = false
    setCandidates({})
    const ids = positionIds.split(',')
    Promise.all(ids.map((id) => getProposalCandidates(id)))
      .then((lists) => {
        if (cancelled) return
        setCandidates(Object.fromEntries(ids.map((id, i) => [id, lists[i]])))
        // Decoration on a list that already rendered: an unset or slow ratings database
        // leaves the badge and those two fields blank rather than failing the view. One
        // call per member, not one for all of them — see loadScores.
        loadScores(lists.flat().map((c) => c.membership_id), setScores)
      })
      .catch((err) => { if (!cancelled) { console.error(err); setError(err.message) } })
    return () => { cancelled = true }
  }, [positionIds])

  return (
    <div className="leap-modal-overlay" onClick={onClose}>
      <div className="leap-committee-modal" onClick={(e) => e.stopPropagation()}>
        <div className="leap-modal-title-row">
          <div>
            <h3>{title}</h3>
            <p>{subtitle}</p>
          </div>
          <span className={`leap-cand-card-reservation ${reservation ? '' : 'open'}`}>
            {reservation || 'Unreserved'}
          </span>
          <button type="button" className="leap-modal-close" onClick={onClose}>✕</button>
        </div>

        {error && <div className="leap-form-error">{error}</div>}

        {positions.map((p) => {
          const rows = candidates[String(p.proposal_position_id)]
          const open = p.max_proposals - p.proposed_cnt
          // Best score first, unscored last (?? -1) rather than as zeros — the same order
          // the wizard stages candidates in. Re-sorts on its own once getCadreScores answers.
          const ranked = [...(rows || [])].sort(
            (a, b) =>
              (scores[b.membership_id]?.total_score ?? -1) - (scores[a.membership_id]?.total_score ?? -1)
          )
          return (
            <div key={p.proposal_position_id}>
              <div className="leap-pop-role">
                <b>{p.role_name}</b>
                <span>
                  {p.max_positions} seat{p.max_positions === 1 ? '' : 's'} ·{' '}
                  {p.proposed_cnt} of {p.max_proposals} proposed ·{' '}
                  {open > 0 ? `${open} open` : 'full'}
                </span>
              </div>
              {rows === undefined && <div className="leap-members-empty">Loading candidates…</div>}
              {rows?.length === 0 && (
                <div className="leap-members-empty">No candidates mapped to this position.</div>
              )}
              {ranked.length > 0 && (
                <div className="leap-member-grid">
                  {ranked.map((c, i) => (
                    <div className="leap-pop-card" key={c.proposal_candidate_id}>
                      <div className="leap-pop-rank">
                        <b>#{i + 1}</b>
                        <span>
                          {scores[c.membership_id]?.total_score != null
                            ? `${Math.round(scores[c.membership_id].total_score * 10) / 10} score`
                            : 'No score'}
                        </span>
                      </div>
                      <MemberCard
                        cadre={c}
                        role={p.role_name}
                        rating={scores[c.membership_id]}
                        onZoom={() => setZoomed(c)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {zoomed && <PhotoViewer cadre={zoomed} onClose={() => setZoomed(null)} />}
      </div>
    </div>
  )
}
