import { useEffect, useMemo, useState } from 'react'
import {
  getPositionsWithCandidates,
  getProposalCandidates,
  getCadreScores,
  removeProposalCandidate,
  updateProposalCandidateStatus,
} from '../api.js'
import CompareModal from './CompareModal.jsx'
import { AddMembersPanel, MemberCard, PhotoViewer, STATUS_META } from './NewPositionModal.jsx'

// The three proposal_status rows, in the order the filter offers them. Their ids are what
// getPositionsWithCandidates counts per position (a position can hold candidates of all three at once) and what
// STATUS_META names on the card, so the filter, the pills and the cards agree.
const STATUS_FILTERS = [
  { id: 1, label: 'Proposed', countKey: 'proposed_status_cnt' },
  { id: 2, label: 'Shortlisted', countKey: 'shortlisted_status_cnt' },
  // The getPositionsWithCandidates count key still reads `conformed_` — it is the SQL alias, not a label.
  { id: 3, label: 'Confirmed', countKey: 'conformed_status_cnt' },
]

// What a candidate whose row predates proposal_status_id counts as — the same default the
// backend writes and the card reads back.
const DEFAULT_STATUS_ID = 1

const statusOf = (cadre) => cadre.proposal_status_id || DEFAULT_STATUS_ID

// A position can hold several Proposed/Shortlisted candidates at once, but only one of
// them should ever be the confirmed winner. updateProposalCandidateStatus has no such check — it only moves one
// row's status — so it is enforced here, before the pick is staged.
const CONFIRMED_STATUS_ID = STATUS_FILTERS.find((s) => s.label === 'Confirmed').id

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
export default function Candidates({ initialFilter } = {}) {
  // The proposal_position_id whose full-screen detail is open, or null for the list.
  const [openId, setOpenId] = useState(null)
  // Bumped after a removal so the list's counts re-read — a position whose last candidate
  // was dropped leaves getPositionsWithCandidates entirely.
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
      .then((data) => { if (!cancelled) setRows(data) })
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

  const open = rows.find((r) => r.proposal_position_id === openId)

  // A removal can drop the open position out of getPositionsWithCandidates (its last candidate went), so the
  // detail has nothing left to show — fall back to the list rather than a blank screen.
  useEffect(() => {
    if (openId && rows.length > 0 && !rows.some((r) => r.proposal_position_id === openId)) {
      setOpenId(null)
    }
  }, [rows, openId])

  if (open) {
    return (
      <PositionCandidates
        position={open}
        onBack={() => setOpenId(null)}
        onChanged={() => setReloadKey((k) => k + 1)}
      />
    )
  }

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

      <div className="leap-cand-list">
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
          filtered.map((r) => (
            <PositionCard key={r.proposal_position_id} row={r} onOpen={() => setOpenId(r.proposal_position_id)} />
          ))
        )}
      </div>
    </div>
  )
}

/* One position in the list: where it sits (election type, assembly, mandal/town), what it
   is (local body + role), how full its proposal slots are, and the per-status breakdown of
   the candidates in it. Clicking anywhere opens the detail. */
function PositionCard({ row, onOpen }) {
  const filled = row.proposed_cnt
  const total = row.max_proposals
  const pct = total > 0 ? Math.min(100, Math.round((filled / total) * 100)) : 0
  const full = total > 0 && filled >= total

  return (
    <div
      className="leap-cand-card"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
    >
      <div className="leap-cand-card-eyebrow">
        <span className="leap-cand-card-kind">
          <span className="leap-cand-card-kind-dot" />
          {row.election_type}
        </span>
        <span className="leap-cand-card-eyebrow-meta">
          {row.assembly_name}{row.mandal_town_name ? ` · ${row.mandal_town_name}` : ''}
        </span>
        <span className={`leap-cand-card-reservation ${row.reservation_type ? '' : 'open'}`}>
          {row.reservation_type || 'Unreserved'}
        </span>
      </div>

      <div className="leap-cand-card-identity">
        <h3>{row.local_body_name}</h3>
        <div className="leap-cand-card-role">{row.role_name}</div>
      </div>

      <div className="leap-cand-card-progress">
        <div className="leap-cand-card-progress-track">
          <div className={`leap-cand-card-progress-fill${full ? ' is-full' : ''}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="leap-cand-card-progress-meta">
          <span>{filled} of {total} proposal slots used</span>
          <span>{full ? 'Full' : `${total - filled} open`}</span>
        </div>
      </div>

      <div className="leap-cand-card-metrics">
        <div className={`leap-cand-card-metric${full ? ' is-full' : ''}`}>
          <div className="leap-cand-card-metric-val">{filled}<span>/{total}</span></div>
          <div className="leap-cand-card-metric-lbl">Slots Filled</div>
        </div>
        <div className="leap-cand-card-metric">
          <div className="leap-cand-card-metric-val">{row.max_positions}</div>
          <div className="leap-cand-card-metric-lbl">Seats</div>
        </div>
        <div className="leap-cand-card-metric">
          <div className="leap-cand-card-metric-val">{row.shortlisted_status_cnt}</div>
          <div className="leap-cand-card-metric-lbl">Shortlisted</div>
        </div>
      </div>

      <div className="leap-cand-card-pills">
        {STATUS_FILTERS.map((s) =>
          row[s.countKey] > 0 ? (
            <span key={s.id} className={`leap-cand-pill ${STATUS_META[s.id].cls}`}>
              {row[s.countKey]} {s.label}
            </span>
          ) : null
        )}
      </div>
    </div>
  )
}

/* The full-screen view of one position — the reference platform's profiles step: the
   position's own header, then every candidate mapped to it as the same card the wizard
   renders, with Compare across them. */
function PositionCandidates({ position, onBack, onChanged }) {
  // null while getProposalCandidates is in flight, [] once it says none — the two render differently.
  const [candidates, setCandidates] = useState(null)
  // membership_id -> the getCadreScores row behind each card's score badge and its Member Since /
  // Renewals fields.
  const [scores, setScores] = useState({})
  const [zoomed, setZoomed] = useState(null)
  const [comparing, setComparing] = useState(false)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  // proposal_candidate_id -> the status its buttons now show, before Save writes it. Only
  // ids the user actually touched are in here, so an untouched card falls through to what
  // getProposalCandidates says and Save has an exact list of what changed.
  const [pending, setPending] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')
  // Whether the cadre search panel is open. Only offered while the position has a
  // proposal slot left — assignCandidate would refuse the write otherwise.
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    let cancelled = false
    setCandidates(null)
    // A reload is the new truth about every status, so nothing may stay pending against it.
    setPending({})
    getProposalCandidates(position.proposal_position_id)
      .then((rows) => {
        if (cancelled) return
        setCandidates(rows)
        const mids = rows.map((c) => c.membership_id).filter(Boolean)
        if (mids.length === 0) return
        // Decoration on a list that already rendered: an unset or slow ratings database
        // leaves the badge and those two fields blank rather than failing the view.
        getCadreScores(mids)
          .then((data) => {
            if (!cancelled) {
              setScores(Object.fromEntries(data.candidates.map((c) => [String(c.membership_id), c])))
            }
          })
          .catch((err) => console.error(err))
      })
      .catch((err) => { if (!cancelled) { console.error(err); setCandidates([]) } })
    return () => { cancelled = true }
  }, [position.proposal_position_id, reloadKey])

  // Same write the wizard's View Members makes (removeProposalCandidate), so it asks first: there is no undo
  // on this screen. The list behind is told to re-read its counts.
  const remove = async (cadre) => {
    if (!window.confirm(`Remove ${cadre.member_name} from this position?`)) return
    setError('')
    try {
      await removeProposalCandidate(cadre.proposal_candidate_id)
      setReloadKey((k) => k + 1)
      onChanged()
    } catch (err) {
      setError(err.message)
    }
  }

  // Only cards whose buttons moved off what getProposalCandidates returned: pressing a status and pressing
  // the one already lit both leave nothing to write.
  const changed = (candidates || []).filter(
    (c) => pending[c.proposal_candidate_id] && pending[c.proposal_candidate_id] !== statusOf(c)
  )

  // One updateProposalCandidateStatus per changed card. They are independent rows — no slot is being competed for,
  // unlike assignCandidate — but they are written one at a time so a failure can name which candidate
  // it was and leave that card's buttons where the user left them.
  const saveStatuses = async () => {
    setSaving(true)
    setError('')
    setSaved('')
    const done = []
    const failed = []
    for (const c of changed) {
      try {
        await updateProposalCandidateStatus(c.proposal_candidate_id, pending[c.proposal_candidate_id])
        done.push(`${c.member_name} → ${STATUS_META[pending[c.proposal_candidate_id]].done}`)
      } catch (err) {
        failed.push(`${c.member_name}: ${err.message}`)
      }
    }
    if (failed.length) setError(failed.join(' · '))
    if (done.length) {
      setSaved(`${done.join(', ')}.`)
      // Re-reads getProposalCandidates (which clears `pending`) and tells the list to re-read its per-status
      // pill counts, which have just moved.
      setReloadKey((k) => k + 1)
      onChanged()
    }
    setSaving(false)
  }

  const open = position.max_proposals - position.proposed_cnt

  return (
    <div className="leap-cand-screen">
      <button type="button" className="leap-cand-back" onClick={onBack}>← Candidates</button>

      <div className="leap-cand-detail-head">
        <div>
          <div className="leap-cand-detail-eyebrow">
            {position.election_type} · {position.assembly_name}
            {position.mandal_town_name ? ` · ${position.mandal_town_name}` : ''}
          </div>
          <h2>{position.local_body_name}</h2>
          <div className="leap-cand-detail-role">{position.role_name}</div>
        </div>
        <div className="leap-cand-detail-stats">
          <span><b>{position.max_positions}</b>Seats</span>
          <span className="filled"><b>{position.proposed_cnt}</b>Proposed</span>
          <span className={open > 0 ? 'unfilled' : ''}><b>{open}</b>Open</span>
          <span className={`leap-cand-card-reservation ${position.reservation_type ? '' : 'open'}`}>
            {position.reservation_type || 'Unreserved'}
          </span>
        </div>
      </div>

      <div className="leap-cand-detail-section-head">
        <span className="leap-cand-detail-section-label">MAPPED CANDIDATES</span>
        {candidates?.length > 1 && (
          <button type="button" className="leap-btn-ghost" onClick={() => setComparing(true)}>
            Compare All
          </button>
        )}
        {open > 0 && (
          <button type="button" className="leap-btn-ghost" onClick={() => setAdding((a) => !a)}>
            {adding ? 'Close' : 'Add Members'}
          </button>
        )}
      </div>

      {/* The wizard's step 6, against the position already open here — getPositionsWithCandidates carries the
          proposal_constituency_id its cadre search needs. A successful assign re-reads
          getProposalCandidates for the new cards and tells the list its counts moved. */}
      {adding && open > 0 && (
        <AddMembersPanel
          key={position.proposal_position_id}
          position={position}
          proposalConstituencyId={position.proposal_constituency_id}
          constituencyId={position.assembly_constituency_id}
          reservation={position.reservation_type}
          placeName={position.local_body_name}
          onAssigned={() => { setReloadKey((k) => k + 1); onChanged() }}
        />
      )}

      {error && <div className="leap-form-error">{error}</div>}
      {saved && <div className="leap-form-success">✓ {saved}</div>}

      {candidates === null && <div className="leap-members-empty">Loading candidates…</div>}
      {candidates?.length === 0 && <div className="leap-members-empty">No candidates mapped to this position.</div>}
      {candidates?.length > 0 && (
        <>
          <div className="leap-member-grid">
            {candidates.map((c) => (
              <MemberCard
                key={c.proposal_candidate_id}
                cadre={c}
                role={position.role_name}
                rating={scores[c.membership_id]}
                onZoom={() => setZoomed(c)}
                onDelete={() => remove(c)}
                // All three, because this screen moves a status that already exists rather
                // than picking a new one. The lit button is what is saved right now until
                // another is pressed; pressing the lit one is a no-op (the wizard clears
                // the pick there, but a saved candidate always has a status).
                statuses={STATUS_FILTERS}
                status={pending[c.proposal_candidate_id] || statusOf(c)}
                onStatus={(statusId) => {
                  if (!statusId) return
                  if (
                    statusId === CONFIRMED_STATUS_ID &&
                    candidates.some(
                      (other) =>
                        other.proposal_candidate_id !== c.proposal_candidate_id &&
                        (pending[other.proposal_candidate_id] || statusOf(other)) === CONFIRMED_STATUS_ID
                    )
                  ) {
                    setError('Only one candidate can be confirmed for this position — change the current one first.')
                    return
                  }
                  setError('')
                  setPending((prev) => ({ ...prev, [c.proposal_candidate_id]: statusId }))
                }}
              />
            ))}
          </div>

          <div className="leap-cand-save-bar">
            <span className="leap-cand-save-note">
              {changed.length === 0
                ? 'Pick a status on a card to change it.'
                : `${changed.length} status change${changed.length !== 1 ? 's' : ''} not saved yet.`}
            </span>
            <button
              type="button"
              className="leap-btn-primary"
              disabled={saving || changed.length === 0}
              onClick={saveStatuses}
            >
              {saving ? 'Saving…' : 'Save Status'}
            </button>
          </div>
        </>
      )}

      {comparing && (
        <CompareModal
          candidates={candidates}
          title={position.role_name}
          onClose={() => setComparing(false)}
        />
      )}

      {zoomed && <PhotoViewer cadre={zoomed} onClose={() => setZoomed(null)} />}
    </div>
  )
}
