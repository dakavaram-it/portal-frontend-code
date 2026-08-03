import { useEffect, useRef, useState } from 'react'
import {
  getElectionTypes,
  getAssemblies,
  getMandals,
  getTowns,
  getProposalConstituenciesByTehsil,
  getProposalConstituenciesByTown,
  getPositionsOverview,
  getReservation,
  getProposalCandidates,
  getCadreScores,
  searchCadre,
  assignCandidate,
  useList,
} from '../api.js'
import CompareModal, { scoreTier } from './CompareModal.jsx'

// Cadre are searched by membership id alone. It is the one field S12 matches exactly, so
// a search resolves to a single cadre to weigh up rather than to a page of near-matches —
// a name search is a substring match over the whole constituency and routinely returns
// four figures of rows. Must stay one of the backend's CADRE_SEARCH_FILTERS keys.
const SEARCH_TYPE = 'MembershipId'

// membership_id is an 8-digit number and S12 matches it exactly, so anything else in the
// box can only ever return nothing. Applied on typing and on paste.
const sanitizeSearchValue = (value) => value.replace(/\D/g, '').slice(0, 8)

function memberIds(c) {
  return [c.membership_id || `Cadre #${c.tdp_cadre_id}`, c.mobile_no].filter(Boolean).join(' · ')
}

// S13 returns img_url as '' when the cadre has no photo.
function initials(name) {
  return name
    .replace(/^[A-Z]\.\s*/, '')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

// A native <select> lets the browser choose which way its popup opens, and Chrome
// flips a long list (S2 returns every assembly in the state) upward. This renders
// the list itself so it always drops below the button.
function Dropdown({ value, onChange, options, placeholder, disabled, searchable }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocDown = (e) => {
      if (!ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [open])

  const selected = options.find((o) => o.value === value)
  const shown = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  return (
    <div className="leap-dropdown" ref={ref} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}>
      <button
        type="button"
        className={`leap-dropdown-btn ${open ? 'open' : ''}`}
        disabled={disabled}
        onClick={() => { setOpen((o) => !o); setQuery('') }}
      >
        <span className={selected ? '' : 'placeholder'}>{selected ? selected.label : placeholder}</span>
        <span className="leap-dropdown-caret">▾</span>
      </button>
      {open && (
        <div className="leap-dropdown-list">
          {searchable && (
            <input
              className="leap-dropdown-search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
            />
          )}
          {shown.length === 0 && <div className="leap-dropdown-empty">No match for “{query}”.</div>}
          {shown.map((o) => (
            <button
              type="button"
              key={o.value}
              className={`leap-dropdown-option ${o.value === value ? 'selected' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false) }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function IconHouse() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </svg>
  )
}

function IconCity() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="4" y="9" width="6" height="11" />
      <rect x="14" y="4" width="6" height="16" />
      <path d="M17 8h.01M17 11h.01M17 14h.01M17 17h.01" />
    </svg>
  )
}

function IconRoad() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M7 20L10 4h4l3 16" />
      <path d="M12 5v3M12 11v3M12 17v2" />
    </svg>
  )
}

function IconLandscape() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="7" cy="7" r="2" />
      <path d="M3 19l6-9 4 5.5 3-4L21 19z" />
    </svg>
  )
}

function IconGrid() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function IconColumns() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M3 9l9-5 9 5" />
      <path d="M5 9v11M19 9v11" />
      <path d="M8 21v-8M12 21v-8M16 21v-8" />
      <path d="M4 21h16" />
    </svg>
  )
}

function IconTower() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="7" y="9" width="10" height="12" />
      <path d="M9 9V4h6v5" />
      <circle cx="12" cy="6.5" r="1" />
      <path d="M4 21h16" />
    </svg>
  )
}

function IconFactory() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M3 21V11l4 3V11l4 3V11l4 3V8h4v13z" />
      <path d="M3 21h18" />
    </svg>
  )
}

const ELECTION_TYPE_ICONS = {
  Panchayat: IconHouse,
  Ward: IconCity,
  MPTC: IconRoad,
  ZPTC: IconLandscape,
  MPP: IconGrid,
  ZP: IconColumns,
  Municipality: IconTower,
  Corporation: IconFactory,
}

// Score tiers colour the badge the same way the compare table's does.
const TIER_COLOR = { none: '#9ca3af', high: '#059669', mid: '#d97706', low: '#dc2626' }

// A cadre proposed for a role, or — with `onRemove` — one only staged for it, which is
// the same card with a drop button and the verb the staged list depends on: nothing is
// proposed until you assign. Laid out field for field like the
// membership-analytics card it mirrors — including the fields this backend cannot fill,
// which render '—' rather than being dropped, so the two cards read the same. `span` is
// the number of the grid's six columns the field takes. Voter ID and Panchayat are the
// two fields that card has no slot for; they are the only additions.
function MemberCard({ cadre, role, rating, onZoom, onRemove, selected, onSelect }) {
  const score = rating?.total_score
  const report = rating?.performance
  const caste = [cadre.category_name, cadre.caste_name].filter(Boolean).join(' · ')
  const renewals = report?.['NO OF TIME']
  const profile = [
    { label: 'Gender', value: cadre.gender, span: 2 },
    { label: 'Age', value: cadre.age, span: 2 },
    { label: 'Date of Birth', value: null, span: 2 },
    { label: 'Caste / Sub-caste', value: caste, span: 6, cls: `caste cat-${cadre.category_name}` },
    { label: 'Occupation', value: null, span: 3 },
    { label: 'Education', value: null, span: 3 },
    { label: 'Voter ID', value: cadre.voter_id_card_no, span: 6 },
  ]
  const location = [
    { label: 'Parliament', value: null, span: 6 },
    { label: 'Assembly', value: cadre.constituency_name, span: 3 },
    { label: 'Mandal / Town', value: cadre.mandal_town_name, span: 3 },
    { label: 'Panchayat', value: cadre.panchayat_name, span: 6 },
    { label: 'Caste Community %', value: null, span: 6, cls: 'accent' },
    { label: 'Member Since', value: report?.['YEAR'], span: 3, cls: 'highlight' },
    { label: 'Renewals', value: renewals != null ? `${renewals}×` : null, span: 3, cls: 'highlight' },
  ]
  return (
    <div className={`leap-mcard${selected ? ' selected' : ''}`}>
      <div className="leap-mcard-head">
        {cadre.img_url ? (
          <button
            type="button"
            className="leap-member-photo-btn"
            title={`Enlarge ${cadre.member_name}'s photo`}
            onClick={onZoom}
          >
            <img className="leap-mcard-photo" src={cadre.img_url} alt={cadre.member_name} />
          </button>
        ) : (
          <span className="leap-mcard-photo initials">{initials(cadre.member_name)}</span>
        )}
        <div className="leap-mcard-head-info">
          <div className="leap-mcard-name-row">
            <span className="leap-mcard-name">
              {!onRemove && <i className="leap-mcard-dot" />}
              {cadre.member_name}
            </span>
            <span className="leap-mcard-name-right">
              {score !== undefined && score !== null && (
                <span className="leap-mcard-score" style={{ '--sc': TIER_COLOR[scoreTier(score)] }}>
                  <b>{Math.round(score * 10) / 10}</b>
                  <i>SCORE</i>
                </span>
              )}
              {onRemove && (
                <button
                  type="button"
                  className="leap-mcard-remove"
                  title={`Remove ${cadre.member_name}`}
                  onClick={onRemove}
                >
                  ✕
                </button>
              )}
            </span>
          </div>
          <div className="leap-mcard-considered">
            {onRemove ? 'Considered for' : 'Proposed for'} <b>{role}</b>
          </div>
          <div className="leap-mcard-pills">
            <span>{cadre.membership_id || `Cadre #${cadre.tdp_cadre_id}`}</span>
            {cadre.mobile_no && <span>{cadre.mobile_no}</span>}
          </div>
        </div>
      </div>

      {[['PROFILE', profile], ['LOCATION & MEMBERSHIP', location]].map(([section, fields]) => (
        <div className="leap-mcard-section" key={section}>
          <div className="leap-mcard-section-label">{section}</div>
          <div className="leap-mcard-grid">
            {fields.map(({ label, value, span, cls }) => (
              <div className={`leap-mcard-field span${span}`} key={label}>
                <span>{label}</span>
                <b className={cls} title={value || undefined}>{value || '—'}</b>
              </div>
            ))}
          </div>
        </div>
      ))}

      {onSelect && (
        <button
          type="button"
          className={`leap-mcard-select${selected ? ' selected' : ''}`}
          onClick={onSelect}
        >
          {selected ? '✓ Selected' : 'Select Candidate'}
        </button>
      )}
    </div>
  )
}

export default function NewPositionModal() {
  const [electionTypeId, setElectionTypeId] = useState('')
  const [assemblyId, setAssemblyId] = useState('')
  const [locationKey, setLocationKey] = useState('')
  const [proposalConstituencyId, setProposalConstituencyId] = useState('')

  const [membersAction, setMembersAction] = useState('')

  const [positionId, setPositionId] = useState('')

  // Step 6 — cadre search (S12), their scores (S17) and assign (S11). A search stages a
  // cadre rather than assigning one, so several can be weighed against each other before
  // any of them is proposed.
  const [searchValue, setSearchValue] = useState('')
  const [staged, setStaged] = useState([])
  // tdp_cadre_id of the staged cadre picked with "Select Candidate". Assign writes these
  // alone, so a search that stages someone to compare does not also propose them.
  const [selectedIds, setSelectedIds] = useState([])
  // membership_id -> the S17 row, the same shape `memberScores` holds: the card wants the
  // report behind the score as well as the score. Kept apart from `staged` so a row
  // arriving late does not have to rewrite the cadre it belongs to.
  const [scores, setScores] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [assigned, setAssigned] = useState('')
  // { candidates, title } for the comparison overlay, or null.
  const [comparing, setComparing] = useState(null)
  // Bumped after a successful assign so S7's proposed_cnt / open slots re-read.
  const [positionsKey, setPositionsKey] = useState(0)

  const electionTypes = useList(getElectionTypes, [])
  const assemblies = useList(getAssemblies, [])
  const mandals = useList(assemblyId ? () => getMandals(assemblyId) : null, [assemblyId])
  const towns = useList(assemblyId ? () => getTowns(assemblyId) : null, [assemblyId])

  // Mandals and towns share one picklist but resolve through different endpoints,
  // so the option value carries which it is: 'm:<tehsil_id>' or 't:<town_id>'.
  const [locationType, locationId] = locationKey.split(':')
  const proposalConstituencies = useList(
    locationKey
      ? () =>
          locationType === 'm'
            ? getProposalConstituenciesByTehsil(assemblyId, locationId, electionTypeId)
            : getProposalConstituenciesByTown(assemblyId, locationId, electionTypeId)
      : null,
    [assemblyId, locationKey, electionTypeId]
  )

  const positions = useList(
    proposalConstituencyId ? () => getPositionsOverview(proposalConstituencyId) : null,
    [proposalConstituencyId, positionsKey]
  )
  const reservationRows = useList(
    proposalConstituencyId ? () => getReservation(proposalConstituencyId) : null,
    [proposalConstituencyId]
  )
  const reservation = reservationRows[0]?.reservation_type || ''

  // "View Members" wants the cadre themselves, and S13 is per position — one
  // call per role, only once the user asks for the view.
  const [members, setMembers] = useState(null)
  // membership_id -> the S17 row behind the member card's score badge and its
  // Member Since / Renewals fields. One call for every member on the screen.
  const [memberScores, setMemberScores] = useState({})
  // The member whose photo is open in the lightbox.
  const [zoomed, setZoomed] = useState(null)
  useEffect(() => {
    if (membersAction !== 'view' || positions.length === 0) return
    let cancelled = false
    Promise.all(positions.map((p) => getProposalCandidates(p.proposal_position_id)))
      .then((lists) => {
        if (cancelled) return
        setMembers(Object.fromEntries(positions.map((p, i) => [p.proposal_position_id, lists[i]])))
        const mids = lists.flat().map((c) => c.membership_id).filter(Boolean)
        if (mids.length === 0) return
        // The scores decorate a list that already renders, so a ratings database that is
        // unset or slow leaves the badge and those two fields blank rather than failing
        // the whole view.
        getCadreScores(mids)
          .then((data) => {
            if (!cancelled) {
              setMemberScores(Object.fromEntries(data.candidates.map((c) => [String(c.membership_id), c])))
            }
          })
          .catch((err) => console.error(err))
      })
      .catch((err) => { if (!cancelled) { console.error(err); setMembers({}) } })
    return () => { cancelled = true }
  }, [membersAction, positions])

  // A "proposal constituency" is the body the election type contests — a panchayat,
  // a ward, a municipality. S1's names are already those words, so the step-1 choice
  // is the label.
  const electionType =
    electionTypes.find((t) => String(t.proposal_election_type_id) === electionTypeId)?.election_type || ''
  const localBodyLabel = electionType || 'Local Body'

  // A mandal usually maps to exactly one of these; don't make the user pick from a
  // list of one.
  useEffect(() => {
    if (proposalConstituencies.length === 1) {
      setProposalConstituencyId(String(proposalConstituencies[0].proposal_consituency_id))
    }
  }, [proposalConstituencies])

  const assemblyName = assemblies.find((a) => String(a.constituency_id) === assemblyId)?.constituency_name || ''
  const locationName =
    locationType === 'm'
      ? mandals.find((m) => String(m.tehsil_id) === locationId)?.tehsil_name || ''
      : towns.find((t) => String(t.town_id) === locationId)?.town_name || ''
  const proposalConstituencyName =
    proposalConstituencies.find((pc) => String(pc.proposal_consituency_id) === proposalConstituencyId)
      ?.constituency_name || ''
  const position = positions.find((p) => String(p.proposal_position_id) === positionId)

  const openSlots = (p) => p.max_proposals - p.proposed_cnt

  // A seat here is a `max_proposals` slot, summed over the roles — the same number the
  // per-role "N open" badge counts down, not `max_positions`. Two roles of three each
  // read as six seats, and each candidate proposed fills one of them.
  const totalSeats = positions.reduce((n, p) => n + p.max_proposals, 0)
  const filledSeats = positions.reduce((n, p) => n + p.proposed_cnt, 0)
  const unfilledSeats = totalSeats - filledSeats

  // Best first — the whole point of holding candidates back from assignment is to see
  // them ranked. An unscored cadre sorts last rather than as a zero.
  const stagedByScore = [...staged].sort(
    (a, b) =>
      (scores[b.membership_id]?.total_score ?? -1) - (scores[a.membership_id]?.total_score ?? -1)
  )

  const selectedByScore = stagedByScore.filter((c) => selectedIds.includes(c.tdp_cadre_id))

  const step1Done = !!electionTypeId
  const step2Done = step1Done && !!assemblyId
  const step3Done = step2Done && !!proposalConstituencyId
  const step4Done = step3Done && !!membersAction
  const step5Done = step4Done && membersAction === 'add' && !!position

  const selectElectionType = (id) => {
    setElectionTypeId(id)
    setAssemblyId('')
    setLocationKey('')
    setProposalConstituencyId('')
    setMembersAction('')
    setPositionId('')
  }

  const selectAssembly = (id) => {
    setAssemblyId(id)
    setLocationKey('')
    setProposalConstituencyId('')
    setMembersAction('')
    setPositionId('')
  }

  const selectLocation = (key) => {
    setLocationKey(key)
    setProposalConstituencyId('')
    setMembersAction('')
    setPositionId('')
  }

  const selectProposalConstituency = (id) => {
    setProposalConstituencyId(id)
    setMembersAction('')
    setPositionId('')
  }

  // Picking a different role invalidates everything staged below it — S12's pool is
  // per constituency, but a staged candidate is staged *for a position*.
  const selectPosition = (id) => {
    setPositionId(id)
    setStaged([])
    setSelectedIds([])
    setSearchValue('')
    setError('')
    setAssigned('')
  }

  // The score decides the order the staged cards are shown in, so it is fetched as each
  // cadre is staged rather than waiting for the compare view. Its absence is not an
  // error — the ratings database is optional, and the cards read "No score" without it.
  const loadScore = (membershipId) => {
    getCadreScores([membershipId])
      .then((data) =>
        setScores((prev) => ({
          ...prev,
          ...Object.fromEntries(data.candidates.map((c) => [String(c.membership_id), c])),
        }))
      )
      .catch((err) => console.error(err))
  }

  // A membership id matches at most one cadre, so a search either stages that cadre or
  // says why it could not. S12 returns matched-but-ineligible rows on purpose, which is
  // what lets "no such id" and "barred by the reservation" read as different answers.
  const runSearch = async () => {
    const mid = searchValue.trim()
    if (mid.length !== 8) {
      setError('Enter the full 8-digit Membership ID.')
      return
    }
    if (staged.some((c) => c.membership_id === mid)) {
      setError('That candidate is already staged below.')
      return
    }
    setBusy(true)
    setError('')
    setAssigned('')
    try {
      const [cadre] = await searchCadre(proposalConstituencyId, SEARCH_TYPE, mid)
      if (!cadre) {
        setError(`No cadre found for Membership ID ${mid}.`)
      } else if (cadre.eligible !== 'Y') {
        setError(`${cadre.member_name} is not eligible — this position is reserved for ${reservation}.`)
      } else {
        setStaged((prev) => [...prev, cadre])
        setSearchValue('')
        loadScore(cadre.membership_id)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // S11 takes one cadre at a time and re-checks eligibility and the slot count on each
  // write, so a batch can partly succeed — the slot count is exactly what the staged
  // candidates are competing for. Assign in score order, one at a time so the server can
  // enforce that, then report who went in and leave the rest staged with S11's own
  // {detail} text, which is the real reason a proposal was refused.
  const assignStaged = async () => {
    setBusy(true)
    setError('')
    setAssigned('')
    const done = []
    const failed = []
    for (const cadre of selectedByScore) {
      try {
        await assignCandidate(position.proposal_position_id, cadre.tdp_cadre_id)
        done.push(cadre)
      } catch (err) {
        failed.push(`${cadre.member_name}: ${err.message}`)
      }
    }
    setStaged((prev) => prev.filter((c) => !done.includes(c)))
    setSelectedIds((prev) => prev.filter((id) => !done.some((c) => c.tdp_cadre_id === id)))
    if (done.length) {
      setAssigned(`${done.map((c) => c.member_name).join(', ')} assigned to ${position.role_name}.`)
      setPositionsKey((k) => k + 1)
    }
    if (failed.length) setError(failed.join(' · '))
    setBusy(false)
  }

  return (
    <div className="leap-modal">
      <div className="leap-modal-header">
        <h2>Election Candidates Proposal</h2>
        <p>Create a new post for the local body election.</p>
      </div>

        <div className="leap-modal-step">
          <div className="leap-modal-step-header"><span className="num">1</span><b>Election Type</b><p>Select the local body election this post covers.</p></div>
          <div className="leap-chip-list leap-chip-grid">
            {electionTypes.map(({ proposal_election_type_id, election_type }) => {
              const Icon = ELECTION_TYPE_ICONS[election_type] || IconHouse
              return (
                <button
                  type="button"
                  key={proposal_election_type_id}
                  className={`leap-chip-option leap-chip-option-lg ${electionTypeId === String(proposal_election_type_id) ? 'selected' : ''}`}
                  onClick={() => selectElectionType(String(proposal_election_type_id))}
                >
                  <span className="leap-chip-icon"><Icon /></span>
                  {election_type}
                </button>
              )
            })}
          </div>
        </div>

        {step1Done && (
        <div className="leap-modal-step-row">
          <div className="leap-modal-step">
            <div className="leap-modal-step-header"><span className="num">2</span><b>Assembly</b><p>Assembly constituency this post covers.</p></div>
            <Dropdown
              value={assemblyId}
              onChange={selectAssembly}
              searchable
              placeholder="Select…"
              options={assemblies.map((a) => ({
                value: String(a.constituency_id),
                label: a.constituency_name,
              }))}
            />
          </div>

          <div className={`leap-modal-step ${step2Done ? '' : 'locked'}`}>
            <div className="leap-modal-step-header"><span className="num">3</span><b>Mandal/Town/District</b><p>Narrow down to the exact local area.</p></div>
            <Dropdown
              value={locationKey}
              onChange={selectLocation}
              disabled={!step2Done}
              placeholder={step2Done ? 'Select…' : 'Select an assembly first'}
              options={[
                ...mandals.map((m) => ({ value: `m:${m.tehsil_id}`, label: m.tehsil_name })),
                ...towns.map((t) => ({ value: `t:${t.town_id}`, label: t.town_name })),
              ]}
            />
          </div>

          <div className={`leap-modal-step ${locationKey ? '' : 'locked'}`}>
            <div className="leap-modal-step-header"><span className="num">4</span><b>{localBodyLabel}</b><p>The local body being contested.</p></div>
            <Dropdown
              value={proposalConstituencyId}
              onChange={selectProposalConstituency}
              disabled={!locationKey || proposalConstituencies.length === 0}
              placeholder={locationKey ? 'Select…' : 'Select a mandal/town first'}
              options={proposalConstituencies.map((pc) => ({
                value: String(pc.proposal_consituency_id),
                label: pc.constituency_name,
              }))}
            />
            {locationKey && proposalConstituencies.length === 0 && (
              <p className="leap-field-hint">No {localBodyLabel} is configured for this mandal/town.</p>
            )}
          </div>
        </div>
        )}

        {step3Done && (
        <div className="leap-modal-step">
          <div className="leap-modal-step-header"><span className="num">5</span><b>Reservation &amp; Members</b><p>Reservation status for this constituency.</p></div>
          <div className="leap-reservation-bar">
            <div className="leap-reservation-place">
              <b>{proposalConstituencyName}</b>
              <span>{electionType} · {locationName} · {assemblyName}</span>
            </div>
            <span className="leap-seat-counts">
              <span><b>{totalSeats}</b>Total seats</span>
              <span className="filled"><b>{filledSeats}</b>Filled</span>
              <span className={unfilledSeats > 0 ? 'unfilled' : ''}><b>{unfilledSeats}</b>Unfilled</span>
            </span>
            <span className={`leap-reservation-badge ${reservation ? '' : 'open'}`}>
              {reservation || 'Unreserved'}
            </span>
          </div>
          <div className="leap-chip-list">
            <button
              type="button"
              className={`leap-chip-option ${membersAction === 'view' ? 'selected' : ''}`}
              onClick={() => setMembersAction('view')}
            >
              View Members
            </button>
            <button
              type="button"
              className={`leap-chip-option ${membersAction === 'add' ? 'selected' : ''}`}
              onClick={() => setMembersAction('add')}
            >
              Add Members
            </button>
          </div>

          {membersAction === 'view' && (
            <div className="leap-members-view">
              {positions.map((row) => {
                const open = openSlots(row)
                // undefined while S13 is still in flight; [] once it says none.
                const rows = members?.[row.proposal_position_id]
                return (
                  <div className="leap-members-group" key={row.proposal_position_id}>
                    <div className="leap-members-group-head">
                      <b className="leap-members-role">{row.role_name}</b>
                      <span className="leap-members-count">{row.proposed_cnt} / {row.max_proposals} proposed</span>
                      <span className={`leap-members-badge ${open <= 0 ? 'full' : ''}`}>
                        {open <= 0 ? 'Full' : `${open} open`}
                      </span>
                      {rows?.length > 1 && (
                        <button
                          type="button"
                          className="leap-btn-ghost"
                          onClick={() => setComparing({ candidates: rows, title: row.role_name })}
                        >
                          Compare
                        </button>
                      )}
                    </div>
                    {rows === undefined && <div className="leap-members-empty">Loading members…</div>}
                    {rows?.length === 0 && <div className="leap-members-empty">No members proposed yet.</div>}
                    {rows?.length > 0 && (
                      <div className="leap-member-grid">
                        {rows.map((c) => (
                          <MemberCard
                            key={c.proposal_candidate_id}
                            cadre={c}
                            role={row.role_name}
                            rating={memberScores[c.membership_id]}
                            onZoom={() => setZoomed(c)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {membersAction === 'add' && (
            <>
              <label>Role</label>
              <div className="leap-position-card-list">
                {positions.map((row) => {
                  // Matches S10's rule: a position is available while it has
                  // proposal slots left, not seats.
                  const open = openSlots(row)
                  return (
                    <button
                      type="button"
                      key={row.proposal_position_id}
                      className={`leap-position-card ${positionId === String(row.proposal_position_id) ? 'selected' : ''}`}
                      disabled={open <= 0}
                      title={open <= 0 ? 'Position has reached its maximum proposals' : undefined}
                      onClick={() => selectPosition(String(row.proposal_position_id))}
                    >
                      <span className="leap-position-card-name">{row.role_name}</span>
                      <span className="leap-position-card-badges">
                        <span className="leap-position-card-total">{row.max_positions}</span>
                        <span className="leap-position-card-proposed">{row.proposed_cnt} proposed</span>
                        <span className={`leap-position-card-open ${open <= 0 ? 'zero' : ''}`}>{open} open</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
        )}

        {step5Done && (
        <div className="leap-modal-step">
          <div className="leap-modal-step-header">
            <span className="num">6</span><b>Cadre Search</b>
            <p>
              Search cadre eligible for <b>{position.role_name}</b> in {proposalConstituencyName}
              {reservation ? ` · ${reservation}` : ''} · {openSlots(position)} proposal slot
              {openSlots(position) !== 1 ? 's' : ''} left.
            </p>
          </div>

          <div className="leap-cadre-search-row">
            <input
              value={searchValue}
              onChange={(e) => setSearchValue(sanitizeSearchValue(e.target.value))}
              onKeyDown={(e) => { if (e.key === 'Enter') runSearch() }}
              placeholder="Enter an 8-digit Membership ID…"
            />
            <button
              type="button"
              className="leap-btn-primary"
              disabled={busy || !searchValue.trim()}
              onClick={runSearch}
            >
              {busy ? 'Searching…' : 'Search'}
            </button>
          </div>

          {error && <div className="leap-form-error">{error}</div>}
          {assigned && <div className="leap-form-success">✓ {assigned}</div>}

          {staged.length > 0 && (
            <div className="leap-staged">
              <div className="leap-staged-head">
                <b>{staged.length} staged · {selectedIds.length} selected</b>
                <span>Only selected candidates are assigned.</span>
                {staged.length > 1 && (
                  <button
                    type="button"
                    className="leap-btn-ghost"
                    onClick={() => setComparing({ candidates: stagedByScore, title: position.role_name })}
                  >
                    Compare
                  </button>
                )}
              </div>
              <div className="leap-staged-grid">
                {stagedByScore.map((c) => (
                  <MemberCard
                    key={c.tdp_cadre_id}
                    cadre={c}
                    role={position.role_name}
                    rating={scores[c.membership_id]}
                    onZoom={() => setZoomed(c)}
                    onRemove={() => {
                      setStaged((prev) => prev.filter((x) => x !== c))
                      setSelectedIds((prev) => prev.filter((id) => id !== c.tdp_cadre_id))
                    }}
                    selected={selectedIds.includes(c.tdp_cadre_id)}
                    onSelect={() =>
                      setSelectedIds((prev) =>
                        prev.includes(c.tdp_cadre_id)
                          ? prev.filter((id) => id !== c.tdp_cadre_id)
                          : [...prev, c.tdp_cadre_id]
                      )
                    }
                  />
                ))}
              </div>
            </div>
          )}

          <div className="leap-modal-actions-row">
            <button
              type="button"
              className="leap-btn-primary"
              disabled={busy || selectedIds.length === 0}
              onClick={assignStaged}
            >
              {busy
                ? 'Assigning…'
                : selectedIds.length > 1
                ? `Assign ${selectedIds.length} Candidates`
                : 'Assign Candidate'}
            </button>
          </div>
        </div>
        )}

        {comparing && (
          <CompareModal
            candidates={comparing.candidates}
            title={comparing.title}
            onClose={() => setComparing(null)}
          />
        )}

        {zoomed && (
        <div className="leap-modal-overlay" onClick={() => setZoomed(null)}>
          <div className="leap-photo-viewer" onClick={(e) => e.stopPropagation()}>
            <div className="leap-modal-title-row">
              <div>
                <h3>{zoomed.member_name}</h3>
                <p>{memberIds(zoomed)}</p>
              </div>
              <button type="button" className="leap-modal-close" onClick={() => setZoomed(null)}>✕</button>
            </div>
            <img className="leap-photo-viewer-img" src={zoomed.img_url} alt={zoomed.member_name} />
          </div>
        </div>
        )}
    </div>
  )
}
