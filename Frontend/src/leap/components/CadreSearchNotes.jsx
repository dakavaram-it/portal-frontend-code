import { useState } from 'react'
import { getAssemblies, useLoadable } from '../api.js'
import { Dropdown, initials } from './NewPositionModal.jsx'
import { SEARCH_TYPES, cadreImageUrl, searchCadre } from '../cadreSearchApi.js'
import CadreNotesModal from './CadreNotesModal.jsx'

const PLACEHOLDERS = {
  MembershipId: 'e.g. 10000000',
  VoterCardNo: 'e.g. RYT0222026',
  MobileNo: 'e.g. 9985649860',
  CadreName: 'e.g. UZAIR',
}

const TYPE_ICONS = {
  MembershipId: 'fa-id-card',
  VoterCardNo: 'fa-address-card',
  MobileNo: 'fa-phone',
  CadreName: 'fa-user',
}

// Digits-only for the two numeric-id searches, upper-cased for the voter card (the
// service's own values come back upper-case), left alone for a name. membership_id is
// an 8-digit number (same cap the wizard's own cadre search applies), so anything past
// that can only ever fail to match.
function sanitizeValue(type, raw) {
  if (type === 'MembershipId') return raw.replace(/\D/g, '').slice(0, 8)
  if (type === 'MobileNo') return raw.replace(/\D/g, '')
  if (type === 'VoterCardNo') return raw.replace(/\s/g, '').toUpperCase()
  return raw
}

// Rendered even when empty, as "—" — the convention the wizard's own MemberCard uses
// for fields this data source can't fill. Sized to its own content (see .leap-cadresearch-grid
// below) rather than an equal-width grid column, so a short value like "M" doesn't leave a
// half-empty lane next to it.
function Field({ label, value }) {
  return (
    <div className="leap-cadresearch-field">
      <span>{label}</span>
      <b title={value || undefined}>{value || '—'}</b>
    </div>
  )
}

function CadreResultCard({ cadre, canAddNotes }) {
  const [imgFailed, setImgFailed] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const hasPhoto = !!cadre.imageUrl && !imgFailed

  return (
    <div className="leap-cadresearch-card">
      <div className="leap-cadresearch-head">
        {hasPhoto ? (
          <img
            className="leap-cadresearch-photo"
            src={cadreImageUrl(cadre.imageUrl)}
            alt=""
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="leap-cadresearch-photo initials">{initials(cadre.cadreName || '?')}</span>
        )}
        <div className="leap-cadresearch-head-info">
          <div className="leap-cadresearch-name-row">
            <span className="leap-cadresearch-name">{cadre.cadreName}</span>
            {canAddNotes && (
              <button type="button" className="leap-cadresearch-note-btn" onClick={() => setNotesOpen(true)}>
                <i className="fa-solid fa-plus" aria-hidden="true" /> Add Note
              </button>
            )}
          </div>
          {cadre.relativeName && (
            <div className="leap-cadresearch-relative">Relative: {cadre.relativeName}</div>
          )}
          <div className="leap-cadresearch-pills">
            {cadre.membershipId && (
              <span><i className="fa-solid fa-id-card" aria-hidden="true" /> MID: {cadre.membershipId}</span>
            )}
            {cadre.mobile && (
              <span><i className="fa-solid fa-phone" aria-hidden="true" /> {cadre.mobile}</span>
            )}
          </div>
        </div>
      </div>

      <div className="leap-cadresearch-sections">
        <div className="leap-cadresearch-section">
          <div className="leap-cadresearch-section-label">
            <i className="fa-solid fa-user" aria-hidden="true" /> Profile
          </div>
          <div className="leap-cadresearch-grid">
            <Field label="Age / Gender" value={[cadre.age, cadre.gender].filter(Boolean).join(' / ')} />
            <Field label="Caste" value={cadre.casteName} />
            <Field label="Voter ID" value={cadre.voterCardNo} />
          </div>
        </div>

        <div className="leap-cadresearch-section">
          <div className="leap-cadresearch-section-label">
            <i className="fa-solid fa-location-dot" aria-hidden="true" /> Location &amp; Booth
          </div>
          <div className="leap-cadresearch-grid">
            <Field label="District" value={cadre.districtName} />
            <Field label="Constituency" value={cadre.constituencyName} />
            <Field label="Mandal/Town" value={cadre.mandalTown} />
            <Field label="Village/Ward" value={cadre.villageWard} />
            <Field label="Booth No" value={cadre.booth} />
          </div>
        </div>
      </div>

      {cadre.enrollmentYears?.length > 0 && (
        <div className="leap-cadresearch-section">
          <div className="leap-cadresearch-section-label">
            <i className="fa-solid fa-calendar-check" aria-hidden="true" /> Enrolled
          </div>
          <div className="leap-cadresearch-years">
            {cadre.enrollmentYears.map((y) => (
              <span key={y} className="leap-cadresearch-year">{y}</span>
            ))}
          </div>
        </div>
      )}

      {notesOpen && (
        <CadreNotesModal cadreId={cadre.cadreId} cadreName={cadre.cadreName} onClose={() => setNotesOpen(false)} />
      )}
    </div>
  )
}

// A separate module from the wizard's own cadre search (searchCadre) — this one hits the
// mypartydashboard.com PSA service rather than /leapapi, and is reachable state-wide
// rather than scoped to one proposal constituency. See cadreSearchApi.js.
export default function CadreSearchNotes({ user }) {
  const { items: assemblies, loading: assembliesLoading } = useLoadable(getAssemblies, [])

  // Add Note is gated on the login response's own entitlements list — CADRE_PROFILE_NOTES_PUBLIC_ADD
  // is the one that grants it — with user_id 1 (the reserved super-admin account) let
  // through regardless of what entitlements were actually issued.
  const canAddNotes = !!user?.entitlements?.includes('CADRE_PROFILE_NOTES_PUBLIC_ADD') || user?.user_id === 1

  const [constituencyId, setConstituencyId] = useState('')
  const [constituencyInvalid, setConstituencyInvalid] = useState(false)
  const [searchType, setSearchType] = useState(SEARCH_TYPES[0].value)
  const [value, setValue] = useState('')
  // null = not searched yet, [] = searched and found nothing — same distinction the rest
  // of leap/ draws between "loading" and "loaded empty".
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const nameSearch = searchType === 'CadreName'

  const selectType = (type) => {
    setSearchType(type)
    setValue('')
    setResults(null)
    setError(null)
    setConstituencyInvalid(false)
  }

  const pickConstituency = (id) => {
    setConstituencyId(id)
    if (id) setConstituencyInvalid(false)
  }

  const runSearch = async (e) => {
    e.preventDefault()
    const v = value.trim()
    // A name is a substring match with no other filter, so without a constituency it
    // routinely returns thousands of rows — the same reason the wizard's own cadre
    // search (searchCadre) never offers a name search at all. Membership ID / Voter ID / Mobile
    // No all resolve to at most a handful of rows on their own, so only Name requires it.
    if (nameSearch && !constituencyId) {
      setConstituencyInvalid(true)
      setError('Select a constituency to search by name.')
      return
    }
    if (!v) {
      setError('Enter a value to search.')
      return
    }
    setConstituencyInvalid(false)
    setLoading(true)
    setError(null)
    setResults(null)
    try {
      const data = await searchCadre(searchType, v, constituencyId || null)
      setResults(data || [])
    } catch (err) {
      console.error(err)
      setError(err.message)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const typeLabel = SEARCH_TYPES.find((t) => t.value === searchType)?.label || searchType

  return (
    <div className="leap-cadresearch-screen">
      <div className="leap-cadresearch-header">
        <h2><i className="fa-solid fa-address-book" aria-hidden="true" /> Cadre Search &amp; Notes</h2>
        <p>Look up a cadre by membership ID, voter ID, mobile number or name.</p>
      </div>

      <form className="leap-cadresearch-panel" onSubmit={runSearch}>
        <div className="leap-cadresearch-field">
          <label htmlFor="cadresearch-constituency">
            <i className="fa-solid fa-map-location-dot" aria-hidden="true" /> Constituency{' '}
            {nameSearch && <span className="leap-cadresearch-required">*</span>}
          </label>
          {assembliesLoading ? (
            <div className="leap-skel leap-skel-input" aria-label="Loading constituencies" />
          ) : (
            <div id="cadresearch-constituency" className={constituencyInvalid ? 'invalid' : ''}>
              <Dropdown
                value={constituencyId}
                onChange={pickConstituency}
                searchable
                placeholder="ALL"
                options={[
                  { value: '', label: 'ALL' },
                  ...assemblies.map((a) => ({ value: String(a.constituency_id), label: a.constituency_name })),
                ]}
              />
            </div>
          )}
          {nameSearch && (
            <div className="leap-cadresearch-field-hint">Required for a name search — it's a substring match otherwise.</div>
          )}
        </div>

        <div className="leap-cadresearch-types" role="radiogroup" aria-label="Search by">
          {SEARCH_TYPES.map((t) => (
            <label
              key={t.value}
              className={`leap-cadresearch-type ${searchType === t.value ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name="cadre-search-type"
                value={t.value}
                checked={searchType === t.value}
                onChange={() => selectType(t.value)}
              />
              <i className={`fa-solid ${TYPE_ICONS[t.value]}`} aria-hidden="true" /> {t.label}
            </label>
          ))}
        </div>

        <div className="leap-cadresearch-value-row">
          <input
            className="leap-cadresearch-input"
            value={value}
            onChange={(e) => setValue(sanitizeValue(searchType, e.target.value))}
            maxLength={searchType === 'MembershipId' ? 8 : undefined}
            placeholder={PLACEHOLDERS[searchType]}
          />
          <button type="submit" className="leap-cadresearch-submit" disabled={loading}>
            <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-magnifying-glass'}`} aria-hidden="true" />
            {loading ? ' Searching…' : ' Submit'}
          </button>
        </div>

        {error && <div className="leap-cadresearch-error">{error}</div>}
      </form>

      <div className="leap-cadresearch-results">
        {results !== null && (
          results.length === 0 ? (
            <div className="leap-cand-empty">
              <div className="leap-cand-empty-title">No cadre found</div>
              <div className="leap-cand-empty-sub">Nobody matched that {typeLabel.toLowerCase()}.</div>
            </div>
          ) : (
            results.map((c, i) => <CadreResultCard key={c.cadreId ?? i} cadre={c} canAddNotes={canAddNotes} />)
          )
        )}
      </div>
    </div>
  )
}
