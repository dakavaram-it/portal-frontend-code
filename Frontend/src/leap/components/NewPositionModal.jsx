import { useEffect, useRef, useState } from 'react'
import {
  getElectionTypes,
  getAssemblies,
  getMandals,
  getTowns,
  getProposalConstituenciesByTehsil,
  getProposalConstituenciesByTown,
  getPositionsOverview,
  getProposalCandidates,
  getCadreScores,
  searchCadre,
  assignCandidate,
  useList,
} from '../api.js'
import { MIN_NAME_LENGTH, cadreImageUrl, searchCadre as searchCadreDirectory } from '../cadreSearchApi.js'

// How a cadre is found. `value` must stay one of the backend's CADRE_SEARCH_FILTERS keys,
// which are also the PSA directory service's keys (see cadreSearchApi.js).
const SEARCH_TYPES = [
  { value: 'MembershipId', label: 'Membership ID', placeholder: 'Enter an 8-digit Membership ID…' },
  { value: 'MobileNo', label: 'Mobile No', placeholder: 'Enter a 10-digit mobile number…' },
  { value: 'CadreName', label: 'Name', placeholder: 'Enter a cadre name…' },
]

// A mobile number is matched exactly but state-wide by searchCadre, so it returns cadre in any
// assembly, which then refuse to stage as "belongs to another assembly". The directory
// service does take a constituency, so it goes through it and the cadre picked out of its
// results is resolved back through searchCadre by cadre id — searchCadre is still what says
// whether they are eligible.
// A name no longer does: searchCadre's own name search is now scoped to the position's
// assemblies and the current enrollment year, so it answers with rows that already carry
// the eligibility flags and needs no second lookup.
const DIRECTORY_TYPES = ['MobileNo']

// membership_id is an 8-digit number and a mobile number a 10-digit one, both matched
// exactly, so anything else in the box can only ever return nothing. A name is left alone.
// Applied on typing and on paste.
const sanitizeSearchValue = (type, value) => {
  if (type === 'MembershipId') return value.replace(/\D/g, '').slice(0, 8)
  if (type === 'MobileNo') return value.replace(/\D/g, '').slice(0, 10)
  return value
}

// The two search paths answer in different shapes — searchCadre's cadre row and the directory
// service's — and the picker shows the same handful of fields off either. `zoom` is the
// cadre shape PhotoViewer reads, so a match can be enlarged before it is picked; the
// directory's imageUrl is a path relative to the photo bucket, not a URL.
const matchInfo = (row) =>
  row.tdp_cadre_id
    ? {
        id: row.tdp_cadre_id,
        name: row.member_name,
        photo: row.img_url,
        meta: [row.membership_id, row.mobile_no, row.category_name, row.mandal_town_name]
          .filter(Boolean)
          .join(' · '),
        ineligible: row.eligible === 'N',
        zoom: row,
      }
    : {
        id: row.cadreId,
        name: row.cadreName,
        photo: cadreImageUrl(row.imageUrl),
        meta: [row.membershipId, row.mobile, row.casteName, row.constituencyName, row.mandalTown]
          .filter(Boolean)
          .join(' · '),
        ineligible: false,
        zoom: {
          tdp_cadre_id: row.cadreId,
          member_name: row.cadreName,
          membership_id: row.membershipId,
          mobile_no: row.mobile,
          img_url: cadreImageUrl(row.imageUrl),
        },
      }

// A match's photo, enlarged rather than picked when it is clicked — it is often the only
// way to tell two cadre of the same name apart, so it has to be readable before the row is
// committed to. The directory's photo paths do not all resolve, so a failed load falls back
// to initials the same way a cadre with no photo does.
function MatchAvatar({ match, onZoom }) {
  const [failed, setFailed] = useState(false)
  if (!match.photo || failed) {
    return <span className="leap-candidate-avatar">{initials(match.name || '?')}</span>
  }
  return (
    <img
      className="leap-candidate-avatar"
      src={match.photo}
      alt={match.name}
      title="Click to enlarge"
      onError={() => setFailed(true)}
      onClick={(e) => { e.stopPropagation(); onZoom() }}
    />
  )
}

export function memberIds(c) {
  return [c.membership_id || `Cadre #${c.tdp_cadre_id}`, c.mobile_no].filter(Boolean).join(' · ')
}

// getProposalCandidates returns img_url as '' when the cadre has no photo.
export function initials(name) {
  return name
    .replace(/^[A-Z]\.\s*/, '')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

// A native <select> lets the browser choose which way its popup opens, and Chrome
// flips a long list (getAssemblyConstituenciesInAState returns every assembly in the state) upward. This renders
// the list itself so it always drops below the button.
export function Dropdown({ value, onChange, options, placeholder, disabled, searchable }) {
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

// The Dashboard's two tier cards colour blue (Panchayat Raj) and red (Local Body); a
// selected election type carries the tone of the tier it belongs to, so the two screens
// agree about which half of the election you are in. Anything unlisted reads as local body.
const PANCHAYAT_RAJ_TYPES = new Set(['MPTC', 'ZPTC', 'MPP', 'ZP'])

// A cadre with no ratings row scores null rather than 0, so 'none' is its own tier —
// unrated must not read as the worst candidate on the list.
function scoreTier(score) {
  if (score === null || score === undefined) return 'none'
  if (score >= 70) return 'high'
  if (score >= 40) return 'mid'
  return 'low'
}

const TIER_COLOR = { none: '#9ca3af', high: '#059669', mid: '#d97706', low: '#dc2626' }

// proposal_status, by id. `done` is the verb a card reads back — the same word for a
// staged cadre whose button is on and for a saved member's status block, so the two say
// the same thing. Confirmed is here to be *read*: this screen never writes it. `cls` is a
// CSS class, not a label — it stayed `conform` when the status was renamed.
export const STATUS_META = {
  1: { done: 'Proposed', cls: 'propose' },
  2: { done: 'Shortlisted', cls: 'shortlist' },
  3: { done: 'Confirmed', cls: 'conform' },
}

// What the staged card's button writes.
const PROPOSAL_STATUSES = [
  { id: 1, label: 'Propose Candidate' },
]

// What a staged cadre nobody marked is saved as.
const DEFAULT_STATUS_ID = PROPOSAL_STATUSES[0].id

// A cadre proposed for a role, or — with `onRemove` — one only staged for it, which is
// the same card with a drop button and the verb the staged list depends on: nothing is
// proposed until you assign. Laid out field for field like the
// membership-analytics card it mirrors — including the fields this backend cannot fill,
// which render '—' rather than being dropped, so the two cards read the same. `span` is
// the number of the grid's six columns the field takes. Voter ID and Panchayat are the
// two fields that card has no slot for; they are the only additions.
// `statuses` is which buttons `onStatus` offers. It defaults to the one this wizard
// writes; the Candidates screen passes its own set, because there it is an existing status
// being moved rather than a new one being chosen.
export function MemberCard({ cadre, role, rating, onZoom, onRemove, status, onStatus, statuses = PROPOSAL_STATUSES }) {
  // Not every img_url resolves — a path can outlive the photo it points at, and a broken
  // image reads worse than no photo, so a failed load falls back to initials.
  const [photoFailed, setPhotoFailed] = useState(false)
  // A staged card takes its status from the buttons; a saved one from getProposalCandidates. Rows written
  // before the column have neither id nor name and are proposals.
  const picked = STATUS_META[status]
  const saved = STATUS_META[cadre.proposal_status_id] || STATUS_META[DEFAULT_STATUS_ID]
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
    <div className={`leap-mcard${picked ? ` selected ${picked.cls}` : ''}`}>
      <div className="leap-mcard-head">
        {cadre.img_url && !photoFailed ? (
          <button
            type="button"
            className="leap-member-photo-btn"
            title={`Enlarge ${cadre.member_name}'s photo`}
            onClick={onZoom}
          >
            <img
              className="leap-mcard-photo"
              src={cadre.img_url}
              alt={cadre.member_name}
              onError={() => setPhotoFailed(true)}
            />
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
            {onRemove ? 'Considered for' : `${saved.done} for`} <b>{role}</b>
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

      {onStatus ? (
        <div className="leap-mcard-actions">
          {statuses.map((s) => (
            <button
              type="button"
              key={s.id}
              className={`leap-mcard-action ${STATUS_META[s.id].cls}${status === s.id ? ' selected' : ''}`}
              onClick={() => onStatus(status === s.id ? null : s.id)}
            >
              {status === s.id ? `✓ ${STATUS_META[s.id].done}` : s.label}
            </button>
          ))}
        </div>
      ) : (
        // Where the staged card's buttons are, a saved member carries what was written
        // instead — Proposed, Shortlisted or Confirmed. Read-only: nothing here changes
        // a saved row's status.
        !onRemove && <div className={`leap-mcard-status ${saved.cls}`}>{saved.done}</div>
      )}
    </div>
  )
}

// Fill a membership_id -> getCadreScores row map, one call per id rather than one call for
// all of them. getCadreScores is lookup-first: a cadre already in the ratings report answers in
// milliseconds, but one who is not makes the request run two stored procedures (measured
// at ~1.6s for a single membership id) before it answers at all. Batched, that cost is
// paid by every badge on the screen — one cadre nobody has rated yet held up the score,
// Member Since and Renewals of every member beside them. Per id each card fills the
// moment its own answer lands, and the already-rated ones do not wait at all.
// A failure is logged, never surfaced: the ratings database is optional and the card
// reads "No score" without it.
export function loadScores(membershipIds, setScores) {
  for (const mid of [...new Set(membershipIds.filter(Boolean))]) {
    getCadreScores([mid])
      .then((data) =>
        setScores((prev) => ({
          ...prev,
          ...Object.fromEntries(data.candidates.map((c) => [String(c.membership_id), c])),
        }))
      )
      .catch((err) => console.error(err))
  }
}

// The photo lightbox, shared by every screen that renders a MemberCard.
export function PhotoViewer({ cadre, onClose }) {
  return (
    <div className="leap-modal-overlay" onClick={onClose}>
      <div className="leap-photo-viewer" onClick={(e) => e.stopPropagation()}>
        <div className="leap-modal-title-row">
          <div>
            <h3>{cadre.member_name}</h3>
            <p>{memberIds(cadre)}</p>
          </div>
          <button type="button" className="leap-modal-close" onClick={onClose}>✕</button>
        </div>
        <img className="leap-photo-viewer-img" src={cadre.img_url} alt={cadre.member_name} />
      </div>
    </div>
  )
}

/* Search a cadre by membership id (searchCadre), stage several against one position to weigh them
   up, then write them all with assignCandidate. The wizard's step 6 and the Candidates screen's "Add
   Members" are the same thing, so they are the same component — mount it keyed by
   proposal_position_id, since a staged list belongs to the position it was staged for.
   `num` is the wizard's step number; the Candidates screen has no step to number. */
export function AddMembersPanel({ constituencyId, position, placeName, num, onAssigned }) {
  // The role's own reservation, off getPositionsOverview / getPositionsWithCandidates —
  // it is a proposal_position column, and two roles under one local body routinely
  // reserve differently.
  const reservation = position.reservation_type || ''
  const [searchType, setSearchType] = useState(SEARCH_TYPES[0].value)
  const [searchValue, setSearchValue] = useState('')
  // null until a search answers with more than one cadre — a mobile number or a name can
  // match several, and the user says which one before anything is staged.
  const [matches, setMatches] = useState(null)
  const [staged, setStaged] = useState([])
  // tdp_cadre_id -> the proposal_status_id its button picked (1 Proposed, 2 Shortlisted).
  // Assign writes these alone: the two buttons are what decides which status the row gets.
  const [selection, setSelection] = useState({})
  // membership_id -> the getCadreScores row: the card wants the report behind the score as well as
  // the score. Kept apart from `staged` so a row arriving late does not have to rewrite
  // the cadre it belongs to.
  const [scores, setScores] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [assigned, setAssigned] = useState('')
  const [zoomed, setZoomed] = useState(null)

  const openSlots = position.max_proposals - position.proposed_cnt

  // Best first — the whole point of holding candidates back from assignment is to see
  // them ranked. An unscored cadre sorts last rather than as a zero.
  const stagedByScore = [...staged].sort(
    (a, b) =>
      (scores[b.membership_id]?.total_score ?? -1) - (scores[a.membership_id]?.total_score ?? -1)
  )

  // Every staged cadre is saved; the buttons only say *as what*. An untouched card is a
  // proposal, so staging someone and hitting save does what it did before the shortlist
  // existed rather than silently saving nobody.
  const statusOf = (cadre) => selection[cadre.tdp_cadre_id] || DEFAULT_STATUS_ID

  // The score decides the order the staged cards are shown in, so it is fetched as each
  // cadre is staged. Its absence is not an
  // error — the ratings database is optional, and the cards read "No score" without it.
  const loadScore = (membershipId) => loadScores([membershipId], setScores)

  const typeLabel = SEARCH_TYPES.find((t) => t.value === searchType)

  const selectType = (type) => {
    setSearchType(type)
    setSearchValue('')
    setMatches(null)
    setError('')
  }

  // The end of every search path: one searchCadre cadre row, staged or refused. searchCadre returns
  // matched-but-ineligible rows on purpose, which is what lets "no such cadre" and
  // "barred by the reservation" read as different answers.
  const stage = (cadre) => {
    if (staged.some((c) => c.tdp_cadre_id === cadre.tdp_cadre_id)) {
      setError('That candidate is already staged below.')
      return
    }
    // Named before the reservation: a cadre from another assembly cannot be proposed here
    // whatever their caste category, and "wrong assembly" is a different fix for the user
    // than "wrong category".
    if (cadre.in_assembly !== 'Y') {
      setError(
        `Provided ID belongs to another assembly${cadre.constituency_name ? ` (${cadre.constituency_name})` : ''}.`
      )
      return
    }
    if (cadre.eligible !== 'Y') {
      setError(`${cadre.member_name} is not eligible — this position is reserved for ${reservation}.`)
      return
    }
    setStaged((prev) => [...prev, cadre])
    setSearchValue('')
    setMatches(null)
    loadScore(cadre.membership_id)
  }

  // A directory row is not an searchCadre row: it knows nothing about this position's
  // reservation and carries no eligibility flag, so the cadre the user picked is looked
  // up again through searchCadre by membership id before being staged.
  const pickMatch = async (row) => {
    if (row.tdp_cadre_id) {
      stage(row)
      return
    }
    setBusy(true)
    setError('')
    try {
      // By cadre id: the directory's cadreId is the same tdp_cadre_id assignCandidate
      // writes, so this is one indexed row. This used to fall back to searchCadre's Name
      // filter when the directory returned no membership id — a LIKE '%name%' over every
      // cadre in the state with no LIMIT, which is what made picking a name result take
      // seconds. Membership id stays as the fallback for a row with no cadre id.
      const rows = row.cadreId
        ? await searchCadre(position.proposal_position_id, 'CadreId', row.cadreId)
        : await searchCadre(position.proposal_position_id, 'MembershipId', row.membershipId)
      const cadre = rows[0]
      if (!cadre) setError(`${row.cadreName} could not be looked up — try searching by Membership ID.`)
      else stage(cadre)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // One match stages straight away; several put the picker up instead, since only the
  // user can say which of two people with the same name is the one they meant.
  const runSearch = async () => {
    if (busy) return
    const value = searchValue.trim()
    if (searchType === 'MembershipId' && value.length !== 8) {
      setError('Enter the full 8-digit Membership ID.')
      return
    }
    if (searchType === 'CadreName' && value.length < MIN_NAME_LENGTH) {
      setError(`Enter at least ${MIN_NAME_LENGTH} characters of the name to search.`)
      return
    }
    if (!value) {
      setError(`Enter a ${typeLabel.label} to search.`)
      return
    }
    if (DIRECTORY_TYPES.includes(searchType) && !constituencyId) {
      setError(`A ${typeLabel.label} can only be searched within an assembly — pick one first.`)
      return
    }
    setBusy(true)
    setError('')
    setAssigned('')
    setMatches(null)
    try {
      const rows =
        DIRECTORY_TYPES.includes(searchType)
          ? await searchCadreDirectory(searchType, value, constituencyId)
          : await searchCadre(position.proposal_position_id, searchType, value)
      if (!rows.length) setError(`No cadre found for that ${typeLabel.label}.`)
      else if (rows.length === 1) await pickMatch(rows[0])
      else setMatches(rows)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // assignCandidate takes one cadre at a time and re-checks eligibility and the slot count on each
  // write, so a batch can partly succeed — the slot count is exactly what the staged
  // candidates are competing for. Assign in score order, one at a time so the server can
  // enforce that, then report who went in and leave the rest staged with assignCandidate's own
  // {detail} text, which is the real reason a proposal was refused.
  const assignStaged = async () => {
    setBusy(true)
    setError('')
    setAssigned('')
    const done = []
    const failed = []
    for (const cadre of stagedByScore) {
      try {
        await assignCandidate(position.proposal_position_id, cadre.tdp_cadre_id, statusOf(cadre))
        done.push(cadre)
      } catch (err) {
        failed.push(`${cadre.member_name}: ${err.message}`)
      }
    }
    setStaged((prev) => prev.filter((c) => !done.includes(c)))
    setSelection((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([id]) => !done.some((c) => String(c.tdp_cadre_id) === id))
      )
    )
    if (done.length) {
      // Names carry their status: the batch can hold both, and "assigned" alone would
      // not say which of the two each one was written as.
      const named = done.map((c) => {
        const s = PROPOSAL_STATUSES.find((x) => x.id === statusOf(c))
        return `${c.member_name} (${s.done})`
      })
      setAssigned(`${named.join(', ')} saved for ${position.role_name}.`)
      onAssigned()
    }
    if (failed.length) setError(failed.join(' · '))
    setBusy(false)
  }

  return (
    <div className="leap-modal-step">
      <div className="leap-modal-step-header">
        {num && <span className="num">{num}</span>}
        <b>Cadre Search</b>
        <p>
          Search cadre eligible for <b>{position.role_name}</b> in {placeName}
          {reservation ? ` · ${reservation}` : ''} · {openSlots} proposal slot
          {openSlots !== 1 ? 's' : ''} left.
        </p>
      </div>

      <div className="leap-cadre-search-row">
        <Dropdown
          value={searchType}
          onChange={selectType}
          options={SEARCH_TYPES.map((t) => ({ value: t.value, label: t.label }))}
        />
        <input
          value={searchValue}
          onChange={(e) => setSearchValue(sanitizeSearchValue(searchType, e.target.value))}
          onKeyDown={(e) => { if (e.key === 'Enter') runSearch() }}
          placeholder={typeLabel.placeholder}
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

      {matches && (
        <div className="leap-cadre-results">
          <p className="leap-cadre-meta">{matches.length} cadre matched — pick the one you meant.</p>
          {matches.map((row) => {
            const m = matchInfo(row)
            return (
              <button
                key={m.id}
                type="button"
                className="leap-cadre-result"
                disabled={busy}
                onClick={() => pickMatch(row)}
              >
                <MatchAvatar match={m} onZoom={() => setZoomed(m.zoom)} />
                <span className="leap-cadre-body">
                  <span className="leap-cadre-name">{m.name}</span>
                  <span className="leap-cadre-meta">
                    {m.meta}
                    {m.ineligible ? ` · not eligible for ${reservation}` : ''}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      {error && <div className="leap-form-error">{error}</div>}
      {assigned && <div className="leap-form-success">✓ {assigned}</div>}

      {staged.length > 0 && (
        <div className="leap-staged">
          <div className="leap-staged-head">
            <b>{staged.length} staged</b>
            <span>All staged candidates are saved — unmarked ones as Proposed.</span>
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
                  setSelection(({ [c.tdp_cadre_id]: _, ...rest }) => rest)
                }}
                status={selection[c.tdp_cadre_id]}
                onStatus={(statusId) =>
                  setSelection((prev) => {
                    const { [c.tdp_cadre_id]: _, ...rest } = prev
                    return statusId ? { ...rest, [c.tdp_cadre_id]: statusId } : rest
                  })
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
          disabled={busy || staged.length === 0}
          onClick={assignStaged}
        >
          {busy ? 'Saving…' : staged.length > 1 ? `Save ${staged.length} Candidates` : 'Save Candidate'}
        </button>
      </div>

      {zoomed && <PhotoViewer cadre={zoomed} onClose={() => setZoomed(null)} />}
    </div>
  )
}

// `initial` jumps the wizard straight to a known location instead of making the user
// click through steps 1-4: the Dashboard's location view already knows the election
// type, assembly, mandal/town and local body, so it hands them over rather than making
// the wizard re-derive them one picklist at a time. Only ids, not names — every name
// still comes off the picklists once they load, same as a manual walk-through would.
export default function NewPositionModal({ initial } = {}) {
  const [electionTypeId, setElectionTypeId] = useState(initial?.electionTypeId || '')
  const [assemblyId, setAssemblyId] = useState(initial?.assemblyId || '')
  const [locationKey, setLocationKey] = useState(initial?.locationKey || '')
  const [proposalConstituencyId, setProposalConstituencyId] = useState(initial?.proposalConstituencyId || '')

  const [membersAction, setMembersAction] = useState(initial?.membersAction || '')

  const [positionId, setPositionId] = useState('')

  // Bumped after a successful assign so getPositionsOverview's proposed_cnt / open slots re-read.
  const [positionsKey, setPositionsKey] = useState(0)

  const electionTypes = useList(getElectionTypes, [])
  const assemblies = useList(getAssemblies, [])

  // A "proposal constituency" is the body the election type contests — a panchayat,
  // a ward, a municipality. getElectionTypes's names are already those words, so the step-1 choice
  // is the label.
  const electionType =
    electionTypes.find((t) => String(t.proposal_election_type_id) === electionTypeId)?.election_type || ''
  const localBodyLabel = electionType || 'Local Body'

  // ZPTC/MPTC/MPP data is mandal-based and the municipal types are town-based (see the
  // proposal_consituency rows behind each type) — restricting step 3 to the relevant
  // picklist instead of merging both avoids a selection that can never resolve to a
  // local body. Every name here is a proposal_election_type.election_type value: a type
  // missing from both sets falls back to the merged picklist, which is why Municipality
  // and Corporation used to offer mandals and then report themselves "not configured".
  const MANDAL_ONLY_TYPES = new Set(['ZPTC', 'MPTC', 'MPP'])
  const TOWN_ONLY_TYPES = new Set([
    'Municipality', 'Corporation', 'Municipal Ward', 'Corporation Ward', 'GMC Ward',
  ])
  const isMandalOnlyType = MANDAL_ONLY_TYPES.has(electionType)
  const isTownOnlyType = TOWN_ONLY_TYPES.has(electionType)

  const mandals = useList(
    assemblyId && !isTownOnlyType ? () => getMandals(assemblyId) : null,
    [assemblyId, isTownOnlyType]
  )
  const towns = useList(
    assemblyId && !isMandalOnlyType ? () => getTowns(assemblyId) : null,
    [assemblyId, isMandalOnlyType]
  )

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

  // "View Members" wants the cadre themselves, and getProposalCandidates is per position — one
  // call per role, only once the user asks for the view.
  const [members, setMembers] = useState(null)
  // membership_id -> the getCadreScores row behind the member card's score badge and its
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
        // The scores decorate a list that already renders, so a ratings database that is
        // unset or slow leaves the badge and those two fields blank rather than failing
        // the whole view. One call per member, not one for all of them — see loadScores.
        loadScores(lists.flat().map((c) => c.membership_id), setMemberScores)
      })
      .catch((err) => { if (!cancelled) { console.error(err); setMembers({}) } })
    return () => { cancelled = true }
  }, [membersAction, positions])

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

  // Same reason step 4 auto-selects a lone local body: don't ask for the only answer.
  // Arriving from the Dashboard this goes straight from the location to the cadre
  // search; a body with two open roles still has to be picked from.
  useEffect(() => {
    if (membersAction !== 'add' || positionId) return
    const open = positions.filter((p) => openSlots(p) > 0)
    if (open.length === 1) setPositionId(String(open[0].proposal_position_id))
  }, [membersAction, positions, positionId])

  const step1Done = !!electionTypeId
  const step2Done = step1Done && !!assemblyId
  const step3Done = step2Done && !!proposalConstituencyId
  const step4Done = step3Done && !!membersAction
  const step5Done = step4Done && membersAction === 'add' && !!position

  // Arriving from the Dashboard's "Assign", steps 1-4 are already answered, so the top of
  // the wizard is four filled-in picklists with nothing to do — the work is below the fold.
  // Scroll to Cadre Search once a role reveals it, and to the role list until then. Only for
  // a prefilled arrival: walking the wizard by hand already leaves you at the step you filled.
  const membersRef = useRef(null)
  const cadreSearchRef = useRef(null)
  useEffect(() => {
    if (initial?.membersAction !== 'add') return
    const el = step5Done ? cadreSearchRef.current : membersRef.current
    el?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })
  }, [step3Done, step5Done])

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
                  className={`leap-chip-option leap-chip-option-lg ${electionTypeId === String(proposal_election_type_id) ? `selected ${PANCHAYAT_RAJ_TYPES.has(election_type) ? 'tone-blue' : 'tone-red'}` : ''}`}
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
            <div className="leap-modal-step-header"><span className="num">3</span><b>{isMandalOnlyType ? 'Mandal' : isTownOnlyType ? 'Town' : 'Mandal/Town/District'}</b><p>Narrow down to the exact local area.</p></div>
            <Dropdown
              value={locationKey}
              onChange={selectLocation}
              disabled={!step2Done}
              placeholder={step2Done ? 'Select…' : 'Select an assembly first'}
              options={[
                ...(isTownOnlyType ? [] : mandals.map((m) => ({ value: `m:${m.tehsil_id}`, label: m.tehsil_name }))),
                ...(isMandalOnlyType ? [] : towns.map((t) => ({ value: `t:${t.town_id}`, label: t.town_name }))),
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
        <div className="leap-modal-step" ref={membersRef}>
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
                // undefined while getProposalCandidates is still in flight; [] once it says none.
                const rows = members?.[row.proposal_position_id]
                return (
                  <div className="leap-members-group" key={row.proposal_position_id}>
                    <div className="leap-members-group-head">
                      <b className="leap-members-role">{row.role_name}</b>
                      <span className="leap-members-count">{row.proposed_cnt} / {row.max_proposals} proposed</span>
                      <span className={`leap-members-badge ${open <= 0 ? 'full' : ''}`}>
                        {open <= 0 ? 'Full' : `${open} open`}
                      </span>
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
                  // Matches checkPositionAvailability's rule: a position is available while it has
                  // proposal slots left, not seats.
                  const open = openSlots(row)
                  return (
                    <button
                      type="button"
                      key={row.proposal_position_id}
                      className={`leap-position-card ${positionId === String(row.proposal_position_id) ? 'selected' : ''}`}
                      disabled={open <= 0}
                      title={open <= 0 ? 'Position has reached its maximum proposals' : undefined}
                      // Everything staged below belongs to the role it was staged for, and
                      // the panel is keyed by it — picking another role remounts it empty.
                      onClick={() => setPositionId(String(row.proposal_position_id))}
                    >
                      <span className="leap-position-card-head">
                        <span className="leap-position-card-name">{row.role_name}</span>
                        {/* This role's own reservation — the rule that decides who may be
                            proposed for it. Per card because it is a proposal_position
                            column: a President BC-GENERAL sits beside a Vice-President
                            ST-WOMEN under one local body. */}
                        <span className={`leap-reservation-badge ${row.reservation_type ? '' : 'open'}`}>
                          {row.reservation_type || 'Unreserved'}
                        </span>
                      </span>
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
          <div ref={cadreSearchRef}>
            <AddMembersPanel
              key={position.proposal_position_id}
              num={6}
              position={position}
              constituencyId={assemblyId}
              placeName={proposalConstituencyName}
              onAssigned={() => setPositionsKey((k) => k + 1)}
            />
          </div>
        )}

        {zoomed && <PhotoViewer cadre={zoomed} onClose={() => setZoomed(null)} />}
    </div>
  )
}
