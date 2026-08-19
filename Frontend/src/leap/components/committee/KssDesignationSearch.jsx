import { useState } from 'react'
import { getKssMemberSearchDetails, getCadreKssMemberSearchDetails } from '../../committeeApi.js'
import { initials } from '../NewPositionModal.jsx'

// "All" needs no value; the other four each fill exactly one field on
// getCadreKssMemberSearchDetails — this is that mapping.
const SEARCH_TYPES = [
  { value: 'All', label: 'All' },
  { value: 'MembershipId', field: 'membershipId', label: 'Membership ID' },
  { value: 'VoterId', field: 'voterCardNo', label: 'Voter ID' },
  { value: 'MobileNo', field: 'mobileNo', label: 'Mobile No' },
  { value: 'Name', field: 'memberName', label: 'Name' },
]

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

// A row of small label/value pills — used twice per card (profile facts, then
// section/role/booth facts) so the two groups stay visually distinct without needing two
// different components.
function ChipRow({ items, muted }) {
  return (
    <div className={`leap-kss-chip-row${muted ? ' muted' : ''}`}>
      {items.map(([label, value]) => (
        <span className="leap-kss-chip" key={label}>
          <span className="leap-kss-chip-label">{label}</span>{value ?? '—'}
        </span>
      ))}
    </div>
  )
}

// One row from either search — the KSS section/role/booth a cadre is already tied to,
// plus whether they're already on this committee (`isAssigned`), which is what decides
// between the "Select & Update Profile" button and the "already on committee" badge.
function KssMemberCard({ member, busy, onSelect }) {
  const alreadyAdded = member.isAssigned === 'Y'
  return (
    <div className={`leap-committee-result-card leap-kss-result-card${alreadyAdded ? ' is-added' : ''}`}>
      <span className="leap-kss-result-photo">
        {member.imagePath ? <img src={member.imagePath} alt="" /> : initials(member.memberName || '?')}
      </span>
      <div className="leap-kss-result-body">
        <div className="leap-kss-result-head">
          <div className="leap-kss-result-identity">
            <div className="leap-kss-result-name">{member.memberName}</div>
            {member.relativeName && (
              <div className="leap-kss-result-relative">{member.relation || 'Relative'}: {member.relativeName}</div>
            )}
          </div>
          {alreadyAdded ? (
            <span className="leap-kss-badge">
              <IconCheck /> Already on committee
            </span>
          ) : (
            <button type="button" className="leap-btn-primary leap-kss-select-btn" disabled={busy} onClick={() => onSelect(member)}>
              {busy ? 'Assigning…' : 'Select & Update Profile'}
            </button>
          )}
        </div>

        <ChipRow items={[
          ['Age', member.age], ['Gender', member.gender], ['Mobile', member.mobileNo],
          ['Caste', member.casteName], ['Voter ID', member.voterCardNo],
        ]}
        />
        <ChipRow muted items={[
          ['Section', member.sectionName], ['Role', member.roleName],
          ['Booth', member.booth], ['Membership No', member.membershipId],
        ]}
        />
      </div>
    </div>
  )
}

// The Booth Wise Committee "Add a committee member" search box — All/Membership ID/
// Voter ID/Mobile No/Name against the KSS-scoped search pair in committeeApi.js, one
// booth (`locationId`) and its designations at a time. `busyCadreId` and `onSelect` are
// owned by the caller, since assigning is the same committeTdpCadreSaveRegistration write
// CommitteeSnapshotPanel already makes for its other Add flow.
export default function KssDesignationSearch({ locationScopeId, locationId, busyCadreId, onSelect }) {
  const [searchType, setSearchType] = useState('All')
  const [value, setValue] = useState('')
  const [results, setResults] = useState(null) // null = not searched, [] = searched, none found
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const selectType = (type) => {
    setSearchType(type)
    setValue('')
    setResults(null)
    setError('')
  }

  const run = async () => {
    const type = SEARCH_TYPES.find((t) => t.value === searchType)
    if (type.field && !value.trim()) {
      setError(`Enter a ${type.label.toLowerCase()} to search.`)
      return
    }
    setBusy(true)
    setError('')
    setResults(null)
    try {
      const rows = type.field
        ? await getCadreKssMemberSearchDetails({ locationScopeId, locationId, [type.field]: value.trim() })
        : await getKssMemberSearchDetails(locationScopeId, locationId)
      setResults(rows || [])
      if (!rows || rows.length === 0) setError('No members found.')
    } catch (err) {
      setError(err.message)
      setResults([])
    } finally {
      setBusy(false)
    }
  }

  const activeType = SEARCH_TYPES.find((t) => t.value === searchType)

  return (
    <div className="leap-kss-search">
      <div className="leap-kss-search-title">Search KSS Assigned Members For Selected Designation</div>

      <div className="leap-committee-search-types" role="radiogroup" aria-label="Search by">
        {SEARCH_TYPES.map((t) => (
          <label key={t.value} className={`leap-committee-search-type ${searchType === t.value ? 'selected' : ''}`}>
            <input
              type="radio"
              name="kss-designation-search-type"
              checked={searchType === t.value}
              onChange={() => selectType(t.value)}
            />
            {t.label}
          </label>
        ))}
      </div>

      <div className="leap-kss-search-bar">
        {activeType.field && (
          <input
            key={activeType.value}
            className="leap-kss-search-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') run() }}
            placeholder={`Enter ${activeType.label.toLowerCase()}`}
            autoFocus
          />
        )}
        <button type="button" className="leap-btn-primary leap-kss-search-btn" disabled={busy} onClick={run}>
          {busy ? 'Searching…' : 'Search'}
        </button>
      </div>
      {error && <div className="leap-field-hint">{error}</div>}

      {results && results.length > 0 && (
        <>
          <div className="leap-kss-search-hint">Click Select &amp; Update Profile to add a cadre to the committee.</div>
          <div className="leap-committee-results-list">
            {results.map((m) => (
              <KssMemberCard key={m.cadreId} member={m} busy={busyCadreId === m.cadreId} onSelect={onSelect} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
