import { useState } from 'react'
import { STAGES, STAGE_COLORS, stagesFor } from '../data.js'
import { searchCadre, assignCandidate, getProposalCandidates, useList } from '../api.js'

// Values must match the backend's CADRE_SEARCH_FILTERS keys.
const SEARCH_TYPES = [
  { value: 'Name', label: 'Name' },
  { value: 'MembershipId', label: 'Membership ID' },
  { value: 'MobileNo', label: 'Mobile No' },
]

// A name search is a substring match over the whole constituency and routinely
// returns four figures of rows; only the first page gets rendered.
const MAX_RESULTS = 50

function IconPeople() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="26" height="26">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M15.5 14.2c2.4.3 4.5 2.3 4.5 5.3" />
    </svg>
  )
}

function initials(name) {
  return name
    .replace(/^[A-Z]\.\s*/, '')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

// Both the assigned list (S13) and the search results (S12) return the same
// cadre fields, so these two render off one shape.
function cadreDetail(c) {
  return [c.gender, c.age && `${c.age} yrs`, c.category_name, c.caste_name].filter(Boolean).join(' · ')
}

function cadrePlace(c) {
  return [c.constituency_name, c.mandal_town_name].filter(Boolean).join(' · ')
}

function CandidateCard({ candidate, role }) {
  return (
    <div className="leap-candidate-card">
      <div className="leap-candidate-top">
        {candidate.img_url
          ? <img className="leap-candidate-avatar" src={candidate.img_url} alt="" />
          : <span className="leap-candidate-avatar">{initials(candidate.member_name)}</span>}
        <div className="leap-candidate-headline">
          <div className="leap-candidate-name">{candidate.member_name}</div>
          <div className="leap-candidate-considered">Considered for <b>{role}</b></div>
          <div className="leap-candidate-contact">
            <span>{candidate.membership_id || `Cadre #${candidate.tdp_cadre_id}`}</span>
            {candidate.mobile_no && <span>📞 {candidate.mobile_no}</span>}
          </div>
          <div className="leap-candidate-meta">{cadreDetail(candidate)}</div>
          <div className="leap-candidate-meta">{cadrePlace(candidate)}</div>
        </div>
      </div>
    </div>
  )
}

function CadreResult({ cadre, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`leap-cadre-result ${selected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <span className="leap-cadre-radio">{selected ? '●' : '○'}</span>
      <span className="leap-cadre-body">
        <span className="leap-cadre-name">{cadre.member_name}</span>
        <span className="leap-cadre-meta">{cadreDetail(cadre)}</span>
        <span className="leap-cadre-meta">
          {[cadre.membership_id, cadre.mobile_no, cadrePlace(cadre)].filter(Boolean).join(' · ')}
        </span>
      </span>
    </button>
  )
}

export default function PositionDetail({ position, onBack, onAdvance, onRetreat }) {
  const stages = stagesFor(position.kind)
  const [viewStage, setViewStage] = useState(position.stageIndex)
  const stage = stages[viewStage] || stages[stages.length - 1]
  const isCurrent = viewStage === position.stageIndex

  const [showSearchModal, setShowSearchModal] = useState(false)
  const [searchType, setSearchType] = useState('Name')
  const [searchValue, setSearchValue] = useState('')
  const [results, setResults] = useState([])
  const [searched, setSearched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selectedCadreId, setSelectedCadreId] = useState(null)
  const [error, setError] = useState('')
  // Bumped after a successful assign to re-run S13.
  const [reloadKey, setReloadKey] = useState(0)

  const candidates = useList(
    position.proposalPositionId ? () => getProposalCandidates(position.proposalPositionId) : null,
    [position.proposalPositionId, reloadKey]
  )
  const remaining = position.maxProposals - candidates.length

  const openSearchModal = () => setShowSearchModal(true)
  const closeSearchModal = () => {
    setShowSearchModal(false)
    setSearchValue('')
    setResults([])
    setSearched(false)
    setSelectedCadreId(null)
    setError('')
  }

  const runSearch = async () => {
    if (!searchValue.trim()) return
    setBusy(true)
    setError('')
    setSelectedCadreId(null)
    try {
      setResults(await searchCadre(position.proposalConstituencyId, searchType, searchValue.trim()))
    } catch (err) {
      setResults([])
      setError(err.message)
    } finally {
      setSearched(true)
      setBusy(false)
    }
  }

  const handleAssign = async () => {
    if (!selectedCadreId) return
    setBusy(true)
    setError('')
    try {
      await assignCandidate(position.proposalPositionId, selectedCadreId)
      setReloadKey((k) => k + 1)
      closeSearchModal()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="leap-view">
      <div className="leap-breadcrumb">
        <button onClick={onBack}>← Back</button>
      </div>

      <div className="leap-detail-header">
        <div>
          <h1>{position.title}</h1>
          <p>{position.kind === 'nominated' ? 'Board' : 'Committee'} · {position.level} · {position.state} · {1} position · {position.seats} seat{position.seats > 1 ? 's' : ''}</p>
          {(position.assembly || position.location) && (
            <p className="leap-detail-location">
              {[
                position.assembly && `${position.assembly} Assembly`,
                position.location,
              ].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>

      <div className="leap-position-tab">
        <span className="leap-position-tab-label">POSITIONS</span>
        <span className="leap-position-tab-chip">{position.role} · {position.seats} seat{position.seats > 1 ? 's' : ''} · {candidates.length} cand <b>{String(position.stageIndex + 1).padStart(2, '0')}</b></span>
      </div>

      {stage.key === 'profiles' && (
        <div className="leap-detail-info-grid">
          <div><span>POSITION</span><b>{position.role}</b></div>
          <div><span>SEATS</span><b>{position.seats}</b></div>
          <div><span>CANDIDATES PROPOSED</span><b>{candidates.length} / {position.maxProposals}</b></div>
          <div><span>COMMITTEE</span><b>{position.title}</b></div>
          <div><span>TYPE</span><b>{position.kind === 'nominated' ? 'Board' : 'Committee'}</b></div>
          <div><span>SUB-TYPE</span><b>{position.dept}</b></div>
          <div><span>LEVEL</span><b>{position.level} · {position.state}</b></div>
          <div><span>RESERVATION</span><b>{position.reservation || 'Unreserved'}</b></div>
          <div><span>STATUS</span><b>{position.stageIndex === 0 ? 'DRAFT' : 'IN REVIEW'}</b></div>
          <div>
            <span>ADD CANDIDATES</span>
            <div className="leap-add-candidates-btns">
              <button
                type="button"
                className="leap-chip-btn-outline mid"
                disabled={remaining <= 0}
                title={remaining <= 0 ? 'Position has reached its maximum proposals' : undefined}
                onClick={openSearchModal}
              >
                + Add Candidate
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="leap-stage-tabs">
        {stages.map((st, i) => (
          <button
            key={st.key}
            className={`leap-stage-tab ${i === viewStage ? 'selected' : ''} ${i > position.stageIndex ? 'disabled' : ''}`}
            style={i <= position.stageIndex ? { borderColor: STAGE_COLORS[i] } : undefined}
            disabled={i > position.stageIndex}
            onClick={() => setViewStage(i)}
            title={st.team}
          >
            {i < position.stageIndex && <span className="check">✓</span>}
            {st.full}
          </button>
        ))}
      </div>

      <div className="leap-stage-actions">
        <span className="leap-seats-badge">S: {position.seats}</span>
        <button className="leap-btn-secondary" disabled={position.stageIndex === 0} onClick={onRetreat}>← Back</button>
        <button className="leap-btn-primary" disabled={position.stageIndex >= stages.length - 1} onClick={onAdvance}>
          Move to Step {String(position.stageIndex + 2).padStart(2, '0')} →
        </button>
      </div>

      {stage.key === 'profiles' ? (
        <>
          <div className="leap-mapped-candidates-label">MAPPED CANDIDATES</div>

          {candidates.length === 0 ? (
            <div className="leap-candidates-empty">
              <div className="leap-candidates-empty-icon"><IconPeople /></div>
              <div className="leap-candidates-empty-title">No candidates proposed yet</div>
              <div className="leap-candidates-empty-sub">Search the cadre register to propose a candidate for this position.</div>
              <div className="leap-candidates-empty-actions">
                <button type="button" className="leap-btn-add-candidates" disabled={remaining <= 0} onClick={openSearchModal}>+ Add Candidate</button>
              </div>
            </div>
          ) : (
            <div className="leap-candidate-list">
              {candidates.map((c) => (
                <CandidateCard key={c.proposal_candidate_id} candidate={c} role={position.role} />
              ))}
            </div>
          )}

          {showSearchModal && (
            <div className="leap-modal-overlay" onClick={closeSearchModal}>
              <div className="leap-cadre-search-modal" onClick={(e) => e.stopPropagation()}>
                <div className="leap-modal-title-row">
                  <div>
                    <h3>Add Candidate</h3>
                    <p>
                      Eligible cadre in {position.proposalConstituencyName} only
                      {position.reservation ? ` · ${position.reservation}` : ''}
                      {' · '}{remaining} proposal slot{remaining !== 1 ? 's' : ''} left
                    </p>
                  </div>
                  <button type="button" className="leap-modal-close" onClick={closeSearchModal}>✕</button>
                </div>

                <div className="leap-cadre-search-row">
                  <select value={searchType} onChange={(e) => setSearchType(e.target.value)}>
                    {SEARCH_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <input
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') runSearch() }}
                    placeholder="Search…"
                  />
                  <button type="button" className="leap-btn-primary" disabled={busy || !searchValue.trim()} onClick={runSearch}>
                    {busy ? 'Searching…' : 'Search'}
                  </button>
                </div>

                {error && <div className="leap-form-error">{error}</div>}

                <div className="leap-cadre-results">
                  {searched && results.length === 0 && !error && (
                    <div className="leap-empty">
                      No eligible cadre in {position.proposalConstituencyName} matched that search.
                    </div>
                  )}
                  {results.slice(0, MAX_RESULTS).map((c) => (
                    <CadreResult
                      key={c.tdp_cadre_id}
                      cadre={c}
                      selected={selectedCadreId === c.tdp_cadre_id}
                      onSelect={() => setSelectedCadreId(c.tdp_cadre_id)}
                    />
                  ))}
                  {results.length > MAX_RESULTS && (
                    <div className="leap-field-hint">
                      Showing the first {MAX_RESULTS} of {results.length} matches — refine your search.
                    </div>
                  )}
                </div>

                <div className="leap-modal-actions-row">
                  <button type="button" className="leap-btn-secondary" onClick={closeSearchModal}>Cancel</button>
                  <button type="button" className="leap-btn-primary" disabled={busy || !selectedCadreId} onClick={handleAssign}>
                    {busy ? 'Assigning…' : 'Assign Candidate'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {isCurrent && (
            <div className="leap-info-banner">
              {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} proposed for <b>{position.role}</b>.
              {position.stageIndex < stages.length - 1
                ? <> Review the list below, then click <b>&quot;Move to Step {String(position.stageIndex + 2).padStart(2, '0')}&quot;</b> to advance.</>
                : <> This is the final stage.</>}
            </div>
          )}

          {!isCurrent && (
            <div className="leap-info-banner muted">Viewing stage &quot;{stage.full}&quot; — assigned to {stage.team}.</div>
          )}

          <div className="leap-candidate-list">
            {candidates.length === 0 && <div className="leap-empty">No candidates proposed yet.</div>}
            {candidates.map((c) => (
              <CandidateCard key={c.proposal_candidate_id} candidate={c} role={position.role} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
