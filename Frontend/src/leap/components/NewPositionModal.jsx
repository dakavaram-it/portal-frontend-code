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
  searchCadre,
  assignCandidate,
  useList,
} from '../api.js'

// Values must match the backend's CADRE_SEARCH_FILTERS keys.
const SEARCH_TYPES = [
  { value: 'Name', label: 'Name' },
  { value: 'MembershipId', label: 'Membership ID' },
  { value: 'MobileNo', label: 'Mobile No' },
]

// A name search is a substring match over the whole constituency and routinely
// returns four figures of rows; only the first page gets rendered.
const MAX_RESULTS = 50

// S13 is keyed per position, so the member list is the same cadre shape the
// detail screen renders. Every field it returns is shown except the internal
// ids and img_url (which is the photo itself).
const MEMBER_FIELDS = [
  { label: 'MOBILE', value: (c) => c.mobile_no },
  { label: 'GENDER', value: (c) => c.gender },
  { label: 'AGE', value: (c) => c.age },
  { label: 'CATEGORY', value: (c) => c.category_name },
  { label: 'CASTE', value: (c) => c.caste_name },
  { label: 'VOTER ID', value: (c) => c.voter_id_card_no },
  { label: 'PANCHAYAT', value: (c) => c.panchayat_name },
  { label: 'MANDAL / TOWN', value: (c) => c.mandal_town_name },
  { label: 'ASSEMBLY', value: (c) => c.constituency_name },
]

function relativeOf(c) {
  return [c.relative_type, c.relative_name].filter(Boolean).join(' ')
}

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

export default function NewPositionModal() {
  const [electionTypeId, setElectionTypeId] = useState('')
  const [assemblyId, setAssemblyId] = useState('')
  const [locationKey, setLocationKey] = useState('')
  const [proposalConstituencyId, setProposalConstituencyId] = useState('')

  const [membersAction, setMembersAction] = useState('')

  const [positionId, setPositionId] = useState('')

  // Step 6 — cadre search (S12) and assign (S11).
  const [searchType, setSearchType] = useState('Name')
  const [searchValue, setSearchValue] = useState('')
  const [results, setResults] = useState([])
  const [searched, setSearched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selectedCadreId, setSelectedCadreId] = useState(null)
  const [error, setError] = useState('')
  const [assigned, setAssigned] = useState('')
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
  // The member whose photo is open in the lightbox.
  const [zoomed, setZoomed] = useState(null)
  useEffect(() => {
    if (membersAction !== 'view' || positions.length === 0) return
    let cancelled = false
    Promise.all(positions.map((p) => getProposalCandidates(p.proposal_position_id)))
      .then((lists) => {
        if (!cancelled) {
          setMembers(Object.fromEntries(positions.map((p, i) => [p.proposal_position_id, lists[i]])))
        }
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

  // Picking a different role invalidates the search below it — S12's pool is
  // per constituency, but the selection and any assign result are per position.
  const selectPosition = (id) => {
    setPositionId(id)
    setResults([])
    setSearched(false)
    setSelectedCadreId(null)
    setError('')
    setAssigned('')
  }

  const runSearch = async () => {
    if (!searchValue.trim()) return
    setBusy(true)
    setError('')
    setAssigned('')
    setSelectedCadreId(null)
    try {
      setResults(await searchCadre(proposalConstituencyId, searchType, searchValue.trim()))
    } catch (err) {
      setResults([])
      setError(err.message)
    } finally {
      setSearched(true)
      setBusy(false)
    }
  }

  // S11 re-checks eligibility and the slot count on write, so its {detail} text
  // is the real reason a proposal was refused.
  const handleAssign = async () => {
    if (!selectedCadreId) return
    const cadre = results.find((c) => c.tdp_cadre_id === selectedCadreId)
    setBusy(true)
    setError('')
    try {
      await assignCandidate(position.proposal_position_id, selectedCadreId)
      setAssigned(`${cadre.member_name} assigned to ${position.role_name}.`)
      setResults([])
      setSearched(false)
      setSearchValue('')
      setSelectedCadreId(null)
      setPositionsKey((k) => k + 1)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
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
                      <span className="leap-members-seats">{row.max_positions} seat{row.max_positions > 1 ? 's' : ''}</span>
                    </div>
                    {rows === undefined && <div className="leap-members-empty">Loading members…</div>}
                    {rows?.length === 0 && <div className="leap-members-empty">No members proposed yet.</div>}
                    {rows?.length > 0 && (
                      <div className="leap-member-grid">
                        {rows.map((c) => (
                          <div className="leap-member-card" key={c.proposal_candidate_id}>
                            <div className="leap-member-card-top">
                              {c.img_url ? (
                                <button
                                  type="button"
                                  className="leap-member-photo-btn"
                                  title={`Enlarge ${c.member_name}'s photo`}
                                  onClick={() => setZoomed(c)}
                                >
                                  <img className="leap-member-photo" src={c.img_url} alt={c.member_name} />
                                </button>
                              ) : (
                                <span className="leap-member-photo initials">{initials(c.member_name)}</span>
                              )}
                              <div className="leap-member-headline">
                                <span className="leap-member-name">{c.member_name}</span>
                                {relativeOf(c) && <span className="leap-member-relative">{relativeOf(c)}</span>}
                                <span className="leap-member-id">{c.membership_id || `Cadre #${c.tdp_cadre_id}`}</span>
                              </div>
                            </div>
                            <div className="leap-member-detail-grid">
                              {MEMBER_FIELDS.map(({ label, value }) => (
                                <div key={label}>
                                  <span>{label}</span>
                                  <b>{value(c) || '—'}</b>
                                </div>
                              ))}
                            </div>
                          </div>
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
            <Dropdown value={searchType} onChange={setSearchType} options={SEARCH_TYPES} />
            <input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runSearch() }}
              placeholder="Search…"
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

          {searched && (
            <div className="leap-cadre-results">
              {results.length === 0 && !error && (
                <div className="leap-empty">
                  No eligible cadre in {proposalConstituencyName} matched that search.
                </div>
              )}
              {results.slice(0, MAX_RESULTS).map((c) => (
                <button
                  type="button"
                  key={c.tdp_cadre_id}
                  className={`leap-cadre-result ${selectedCadreId === c.tdp_cadre_id ? 'selected' : ''}`}
                  onClick={() => setSelectedCadreId(c.tdp_cadre_id)}
                >
                  <span className="leap-cadre-radio">{selectedCadreId === c.tdp_cadre_id ? '●' : '○'}</span>
                  <span className="leap-cadre-body">
                    <span className="leap-cadre-name">{c.member_name}</span>
                    <span className="leap-cadre-meta">{memberIds(c)}</span>
                    <span className="leap-cadre-meta">
                      {[c.gender, c.age && `${c.age} yrs`, c.category_name, c.caste_name]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </button>
              ))}
              {results.length > MAX_RESULTS && (
                <div className="leap-field-hint">
                  Showing the first {MAX_RESULTS} of {results.length} matches — refine your search.
                </div>
              )}
            </div>
          )}

          <div className="leap-modal-actions-row">
            <button
              type="button"
              className="leap-btn-primary"
              disabled={busy || !selectedCadreId}
              onClick={handleAssign}
            >
              {busy ? 'Assigning…' : 'Assign Candidate'}
            </button>
          </div>
        </div>
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
