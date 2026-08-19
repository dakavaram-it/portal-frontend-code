import { useEffect, useState } from 'react'
import {
  getKSSCommitteeOverview,
  getNextSectionSerialNo,
  saveKssSection,
  getUnassignedKssSectionsByBooth,
  addKSSMember,
  getKssBooths,
} from '../../committeeApi.js'
import { CASTE_LIST } from '../../casteList.js'
import { cadreImageUrl } from '../../cadreSearchApi.js'
import { Dropdown, initials } from '../NewPositionModal.jsx'
import KssDrilldownModal from './KssDrilldownModal.jsx'
import CommitteeStatTile from './CommitteeStatTile.jsx'
import useMembershipSearch, { SEARCH_TYPES } from './useMembershipSearch.js'

const ICON_PROPS = {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
}
function IconPin() {
  return <svg {...ICON_PROPS}><path d="M12 21s7-7.58 7-12a7 7 0 1 0-14 0c0 4.42 7 12 7 12z" /><circle cx="12" cy="9" r="2.4" /></svg>
}
function IconLayers() {
  return <svg {...ICON_PROPS}><path d="M12 3 3 8l9 5 9-5-9-5z" /><path d="M3 13l9 5 9-5" /></svg>
}
function IconPeople() {
  return <svg {...ICON_PROPS}><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><circle cx="17" cy="9" r="2.3" /><path d="M15 14.2A5 5 0 0 1 20.5 19" /></svg>
}
function IconGrid() {
  return <svg {...ICON_PROPS}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></svg>
}
function IconUserCheck() {
  return <svg {...ICON_PROPS}><circle cx="9" cy="8" r="3.3" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 11l2 2 3.5-3.5" /></svg>
}
function IconPlus() {
  return <svg {...ICON_PROPS}><path d="M12 5v14" /><path d="M5 12h14" /></svg>
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

const CASTE_OPTIONS = CASTE_LIST.map((c) => ({ value: String(c.id), label: c.name }))
const sanitizeMobile = (raw) => raw.replace(/\D/g, '').slice(0, 10)

// NOTE ON ids: the legacy Create/Assign-KSS forms called a committee-scoped search
// (getCadreSearchDetailsForCommitteeAction.action) that was never migrated to a
// confirmed PSA endpoint, so useMembershipSearch reuses the general Cadre/search call
// instead (same one the Cadre Search screen already uses live). Its `cadreId` is passed
// through below as the `cadreId` saveKssSection/addKSSMember expect in `kssCadres[]` —
// the legacy code's own field there was `tdpCadreId`, plausibly the same id under a
// different name, but that has not been confirmed against a live saveSection/addKSSMember
// call.

function BoothPicker({ constituencyId, value, onChange }) {
  const [options, setOptions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getKssBooths(constituencyId)
      .then((rows) => { if (!cancelled) setOptions(rows) })
      .catch((err) => { console.error(err); if (!cancelled) setOptions([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [constituencyId])

  if (loading) return <div className="leap-skel leap-skel-input" aria-label="Loading booths" />
  return <Dropdown value={value} onChange={onChange} searchable placeholder="Select booth…" options={options} />
}

function StagedCadreCard({ cadre, casteId, mobileNo, onCasteChange, onMobileChange, onRemove }) {
  return (
    <div className="leap-committee-staged-card">
      <span className="leap-committee-staged-photo">
        {cadre.imageUrl ? <img src={cadreImageUrl(cadre.imageUrl)} alt="" /> : initials(cadre.cadreName || '?')}
      </span>
      <div className="leap-committee-staged-body">
        <div className="leap-committee-staged-name">{cadre.cadreName}</div>
        <div className="leap-committee-staged-meta">
          MID {cadre.membershipId} · {cadre.age || '—'} / {cadre.gender || '—'} · {cadre.casteName || '—'}
        </div>
        <div className="leap-committee-staged-fields">
          <Dropdown value={casteId} onChange={onCasteChange} searchable placeholder="Select caste…" options={CASTE_OPTIONS} />
          <input value={mobileNo} onChange={(e) => onMobileChange(sanitizeMobile(e.target.value))} placeholder="Mobile number" />
        </div>
      </div>
      {onRemove && (
        <button type="button" className="leap-committee-delete-btn" title="Remove" onClick={onRemove}>
          <IconTrash />
        </button>
      )}
    </div>
  )
}

const SEARCH_PLACEHOLDERS = {
  MembershipId: 'e.g. 10000000',
  VoterCardNo: 'e.g. RYT0222026',
  MobileNo: 'e.g. 9985649860',
  CadreName: 'e.g. UZAIR',
}

// The Membership ID / Voter ID / Mobile No / Name choice ahead of a search — same four
// fields cadreSearchApi.js's SEARCH_TYPES offers on the main Cadre Search screen.
function SearchTypeRadioGroup({ searchType, onChange }) {
  return (
    <div className="leap-committee-search-types" role="radiogroup" aria-label="Search by">
      {SEARCH_TYPES.map((t) => (
        <label
          key={t.value}
          className={`leap-committee-search-type ${searchType === t.value ? 'selected' : ''}`}
        >
          <input
            type="radio"
            name="kss-search-type"
            value={t.value}
            checked={searchType === t.value}
            onChange={() => onChange(t.value)}
          />
          {t.label}
        </label>
      ))}
    </div>
  )
}

// Every other field on the cadre gets its own label/value tile — searchCadre's response
// carries fields this module has no fixed opinion about ahead of time (and the backend is
// free to add more), so rather than hand-picking a handful to show, this renders whatever
// actually came back. cadreName/imageUrl are pulled out for the name line and the photo;
// cadreId is the internal id passed to assignCandidate/addKSSMember, not a member-facing
// detail.
const RESULT_HIDDEN_FIELDS = new Set(['cadreName', 'imageUrl', 'cadreId'])

const fieldLabel = (key) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())
    .trim()

const fieldValue = (v) => {
  if (v === null || v === undefined || v === '') return '—'
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

// One matched cadre from a (possibly multi-row, for Voter/Mobile/Name searches) result —
// a preview, not yet staged. `Select Member` is the explicit step that stages it; toggling
// it off again un-stages the same cadre.
function SearchResultCard({ cadre, selected, disabled, onToggle }) {
  const fields = Object.entries(cadre).filter(([k]) => !RESULT_HIDDEN_FIELDS.has(k))

  return (
    <div className="leap-committee-result-card">
      <span className="leap-committee-staged-photo">
        {cadre.imageUrl ? <img src={cadreImageUrl(cadre.imageUrl)} alt="" /> : initials(cadre.cadreName || '?')}
      </span>
      <div className="leap-committee-staged-body">
        <div className="leap-committee-staged-name">{cadre.cadreName}</div>
        {fields.length > 0 && (
          <div className="leap-committee-result-grid">
            {fields.map(([k, v]) => (
              <div key={k} className="leap-committee-result-field">
                <span>{fieldLabel(k)}</span>
                <b>{fieldValue(v)}</b>
              </div>
            ))}
          </div>
        )}
        <label className="leap-committee-select-toggle">
          <input type="checkbox" checked={selected} disabled={disabled} onChange={onToggle} />
          Select Member
        </label>
        {selected && <div className="leap-committee-added-note">Member added — see Selected Members above.</div>}
      </div>
    </div>
  )
}

// Shared by SerialRangeFields' own booth-change effect and by a form's save() — a
// section just created shifts the booth's next-serial-no forward, so the fields need the
// same fetch re-run once the save resolves, not just once when the booth is first picked.
async function fetchNextSerial(boothId) {
  try {
    const r = await getNextSectionSerialNo(boothId)
    if (!r || r.status === 'Fail') {
      return { max: '0', from: '0', error: (r && r.message) || 'Could not load the serial-no range for this booth.' }
    }
    return {
      max: r.maxSerialNo > 0 ? String(r.maxSerialNo) : '0',
      from: r.maxSerialNo > 0 ? String(r.nextSerialNo) : '0',
      error: '',
    }
  } catch (err) {
    return { max: '0', from: '0', error: err.message }
  }
}

// Booth + serial-no range fields, shared by the plain Create and Create & Assign forms.
function SerialRangeFields({ constituencyId, boothId, setBoothId, maxSerialNo, setMaxSerialNo, fromSerialNo, setFromSerialNo, toSerialNo, setToSerialNo }) {
  const [serialError, setSerialError] = useState('')

  useEffect(() => {
    if (!boothId) return
    let cancelled = false
    setSerialError('')
    fetchNextSerial(boothId).then((r) => {
      if (cancelled) return
      setMaxSerialNo(r.max)
      setFromSerialNo(r.from)
      setSerialError(r.error)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boothId])

  return (
    <div className="leap-committee-form-row">
      <div className="leap-committee-field">
        <label>Booth</label>
        <BoothPicker constituencyId={constituencyId} value={boothId} onChange={setBoothId} />
      </div>
      <div className="leap-committee-field">
        <label>Max serial no (total voters)</label>
        <input value={maxSerialNo} readOnly placeholder="—" />
      </div>
      <div className="leap-committee-field">
        <label>From serial no</label>
        <input value={fromSerialNo} readOnly placeholder="—" />
      </div>
      <div className="leap-committee-field">
        <label>To serial no</label>
        <input
          value={toSerialNo}
          onChange={(e) => setToSerialNo(e.target.value.replace(/\D/g, ''))}
          placeholder="e.g. 60"
        />
      </div>
      {serialError && <div className="leap-form-error">{serialError}</div>}
    </div>
  )
}

function validateRange(fromSerialNo, toSerialNo, maxSerialNo) {
  if (!fromSerialNo) return 'Pick a booth first.'
  if (!toSerialNo) return 'Enter a To-Serial-No.'
  const from = parseInt(fromSerialNo, 10)
  const to = parseInt(toSerialNo, 10)
  const max = parseInt(maxSerialNo, 10)
  if (to <= from) return 'To-Serial-No must be greater than From-Serial-No.'
  if (to - from > 59) return 'A KSS section covers at most 60 voters.'
  if (max && to > max) return 'To-Serial-No must not exceed the booth\'s total voters.'
  return ''
}

function CreateKssForm({ constituencyId, onDone }) {
  const [boothId, setBoothId] = useState('')
  const [maxSerialNo, setMaxSerialNo] = useState('')
  const [fromSerialNo, setFromSerialNo] = useState('')
  const [toSerialNo, setToSerialNo] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const v = validateRange(fromSerialNo, toSerialNo, maxSerialNo)
    if (v) { setError(v); return }
    setBusy(true)
    setError('')
    try {
      await saveKssSection({ boothId, fromSerialNo, toSerialNo, kssCadres: [] })
      setSuccess('Section created.')
      setToSerialNo('')
      onDone()
      const r = await fetchNextSerial(boothId)
      setMaxSerialNo(r.max)
      setFromSerialNo(r.from)
      setTimeout(() => setSuccess(''), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="leap-committee-panel">
      <h4>Create KSS</h4>
      <SerialRangeFields
        constituencyId={constituencyId}
        boothId={boothId} setBoothId={setBoothId}
        maxSerialNo={maxSerialNo} setMaxSerialNo={setMaxSerialNo}
        fromSerialNo={fromSerialNo} setFromSerialNo={setFromSerialNo}
        toSerialNo={toSerialNo} setToSerialNo={setToSerialNo}
      />
      <button type="button" className="leap-btn-primary" disabled={busy || !boothId} onClick={save}>
        {busy && <span className="leap-btn-spinner" aria-hidden="true" />}
        {busy ? 'Creating…' : 'Create KSS'}
      </button>
      {error && <div className="leap-form-error">{error}</div>}
      {success && <div className="leap-form-success">{success}</div>}
    </div>
  )
}

function CreateKssWithMembersForm({ constituencyId, onDone }) {
  const [boothId, setBoothId] = useState('')
  const [maxSerialNo, setMaxSerialNo] = useState('')
  const [fromSerialNo, setFromSerialNo] = useState('')
  const [toSerialNo, setToSerialNo] = useState('')
  const [staged, setStaged] = useState([]) // [{cadre, casteId, mobileNo}], max 2
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const search = useMembershipSearch(constituencyId)

  // The explicit "Select Member" step on a search result — mirrors the legacy screen's
  // own checkbox rather than staging the instant a search resolves, since Voter ID/Mobile/
  // Name can each match more than one row and the user needs to pick which.
  const toggleSelect = (cadre) => {
    const already = staged.some((s) => s.cadre.membershipId === cadre.membershipId)
    if (already) {
      setStaged((prev) => prev.filter((s) => s.cadre.membershipId !== cadre.membershipId))
      return
    }
    if (staged.length >= 2) { setError('You can add at most two KSS members to this section.'); return }
    setStaged((prev) => [...prev, { cadre, casteId: '', mobileNo: cadre.mobile || '' }])
  }

  const save = async () => {
    const v = validateRange(fromSerialNo, toSerialNo, maxSerialNo)
    if (v) { setError(v); return }
    for (const s of staged) {
      if (!s.casteId) { setError(`Select a caste for ${s.cadre.cadreName}.`); return }
      if (s.mobileNo.length !== 10) { setError(`Enter a valid 10-digit mobile number for ${s.cadre.cadreName}.`); return }
    }
    setBusy(true)
    setError('')
    try {
      await saveKssSection({
        boothId, fromSerialNo, toSerialNo,
        kssCadres: staged.map((s) => ({ cadreId: s.cadre.cadreId, casteId: s.casteId, mobileNo: s.mobileNo })),
      })
      setSuccess('Section created and members assigned.')
      setToSerialNo('')
      setStaged([])
      onDone()
      const r = await fetchNextSerial(boothId)
      setMaxSerialNo(r.max)
      setFromSerialNo(r.from)
      setTimeout(() => setSuccess(''), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="leap-committee-panel">
      <h4>Create KSS &amp; Assign Members</h4>
      <SerialRangeFields
        constituencyId={constituencyId}
        boothId={boothId} setBoothId={setBoothId}
        maxSerialNo={maxSerialNo} setMaxSerialNo={setMaxSerialNo}
        fromSerialNo={fromSerialNo} setFromSerialNo={setFromSerialNo}
        toSerialNo={toSerialNo} setToSerialNo={setToSerialNo}
      />

      <p className="leap-field-hint">
        For this section (up to 60 voters) you can add up to two KSS members here.
      </p>

      {staged.length > 0 && (
        <>
          <div className="leap-committee-subhead">Selected Members ({staged.length}/2)</div>
          <div className="leap-committee-staged-box">
            {staged.map((s, i) => (
              <StagedCadreCard
                key={s.cadre.membershipId}
                cadre={s.cadre}
                casteId={s.casteId}
                mobileNo={s.mobileNo}
                onCasteChange={(v) => setStaged((prev) => prev.map((x, xi) => (xi === i ? { ...x, casteId: v } : x)))}
                onMobileChange={(v) => setStaged((prev) => prev.map((x, xi) => (xi === i ? { ...x, mobileNo: v } : x)))}
                onRemove={() => setStaged((prev) => prev.filter((_, xi) => xi !== i))}
              />
            ))}

            <button type="button" className="leap-btn-primary leap-committee-submit-btn" disabled={busy || !boothId} onClick={save}>
              {busy && <span className="leap-btn-spinner" aria-hidden="true" />}
              {busy ? 'Saving…' : 'Create KSS & Assign Members'}
            </button>
          </div>
        </>
      )}

      {staged.length < 2 && boothId && (
        <div className="leap-committee-search-box">
          <div className="leap-committee-subhead leap-committee-subhead-flush">Search Member</div>
          <SearchTypeRadioGroup searchType={search.searchType} onChange={search.selectType} />
          <div className="leap-committee-search-row">
            <input
              value={search.value}
              onChange={(e) => search.setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') search.run() }}
              placeholder={SEARCH_PLACEHOLDERS[search.searchType]}
            />
            <button type="button" className="leap-btn-secondary" disabled={search.busy} onClick={search.run}>
              {search.busy && <span className="leap-btn-spinner leap-btn-spinner-dark" aria-hidden="true" />}
              {search.busy ? 'Searching…' : 'Search'}
            </button>
          </div>
          {search.error && <div className="leap-field-hint">{search.error}</div>}

          {search.results && search.results.length > 0 && (
            <div className="leap-committee-results-list">
              {search.results.map((cadre) => (
                <SearchResultCard
                  key={cadre.membershipId}
                  cadre={cadre}
                  selected={staged.some((s) => s.cadre.membershipId === cadre.membershipId)}
                  disabled={staged.length >= 2 && !staged.some((s) => s.cadre.membershipId === cadre.membershipId)}
                  onToggle={() => toggleSelect(cadre)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {error && <div className="leap-form-error">{error}</div>}
      {success && <div className="leap-form-success">{success}</div>}
    </div>
  )
}

function AssignMembersForm({ constituencyId, onDone }) {
  const [boothId, setBoothId] = useState('')
  const [sectionOptions, setSectionOptions] = useState([])
  const [sectionsLoading, setSectionsLoading] = useState(false)
  const [sectionId, setSectionId] = useState('')
  const [casteId, setCasteId] = useState('')
  const [mobileNo, setMobileNo] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const search = useMembershipSearch(constituencyId)

  useEffect(() => {
    setSectionId('')
    setSectionOptions([])
    if (!boothId) return
    let cancelled = false
    setSectionsLoading(true)
    getUnassignedKssSectionsByBooth(boothId)
      .then((rows) => { if (!cancelled) setSectionOptions((rows || []).map((r) => ({ value: String(r.id), label: r.name }))) })
      .catch((err) => console.error(err))
      .finally(() => { if (!cancelled) setSectionsLoading(false) })
    return () => { cancelled = true }
  }, [boothId])

  useEffect(() => {
    setCasteId('')
    setMobileNo(search.result?.mobile || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.result])

  const add = async () => {
    if (!sectionId) { setError('Select an unassigned KSS section first.'); return }
    if (!search.result) { setError('Search for a member to add.'); return }
    if (!casteId) { setError('Select a caste.'); return }
    if (mobileNo.length !== 10) { setError('Enter a valid 10-digit mobile number.'); return }
    setBusy(true)
    setError('')
    try {
      await addKSSMember({
        boothId, committeeRoleId: sectionId,
        kssCadres: [{ cadreId: search.result.cadreId, casteId, mobileNo }],
      })
      setSuccess(`${search.result.cadreName} assigned.`)
      search.reset()
      getUnassignedKssSectionsByBooth(boothId)
        .then((rows) => setSectionOptions((rows || []).map((r) => ({ value: String(r.id), label: r.name }))))
        .catch(() => {})
      setSectionId('')
      onDone()
      setTimeout(() => setSuccess(''), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="leap-committee-panel">
      <h4>Assign Members</h4>
      <div className="leap-committee-form-row leap-committee-form-row-compact">
        <div className="leap-committee-field">
          <label>Booth</label>
          <BoothPicker constituencyId={constituencyId} value={boothId} onChange={setBoothId} />
        </div>
        <div className="leap-committee-field">
          <label>Unassigned KSS</label>
          {sectionsLoading ? (
            <div className="leap-skel leap-skel-input" aria-label="Loading sections" />
          ) : (
            <Dropdown value={sectionId} onChange={setSectionId} placeholder="Select…" options={sectionOptions} disabled={!boothId} />
          )}
          {boothId && !sectionsLoading && sectionOptions.length === 0 && (
            <div className="leap-field-hint">No unassigned KSS in this booth.</div>
          )}
        </div>
      </div>

      {sectionId && (
        <div className="leap-committee-search-box">
          <div className="leap-committee-subhead leap-committee-subhead-flush">Search Member</div>
          <SearchTypeRadioGroup searchType={search.searchType} onChange={search.selectType} />
          <div className="leap-committee-search-row">
            <input
              value={search.value}
              onChange={(e) => search.setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') search.run() }}
              placeholder={SEARCH_PLACEHOLDERS[search.searchType]}
            />
            <button type="button" className="leap-btn-secondary" disabled={search.busy} onClick={search.run}>
              {search.busy && <span className="leap-btn-spinner leap-btn-spinner-dark" aria-hidden="true" />}
              {search.busy ? 'Searching…' : 'Search'}
            </button>
          </div>
          {search.error && <div className="leap-field-hint">{search.error}</div>}

          {search.result && (
            <>
              <StagedCadreCard
                cadre={search.result}
                casteId={casteId}
                mobileNo={mobileNo}
                onCasteChange={setCasteId}
                onMobileChange={setMobileNo}
              />
              <button type="button" className="leap-btn-primary" disabled={busy} onClick={add}>
                {busy && <span className="leap-btn-spinner" aria-hidden="true" />}
                {busy ? 'Assigning…' : 'Add & Assign'}
              </button>
            </>
          )}
        </div>
      )}

      {error && <div className="leap-form-error">{error}</div>}
      {success && <div className="leap-form-success">{success}</div>}
    </div>
  )
}

// The Kutumba Sadikara Saradulu (KSS) tab: the five overview tiles, the drill-downs
// behind them, and the three write flows (Create / Create & Assign / Assign) — one
// panel below the tiles, switched by which button was last pressed.
export default function KssPanel({ constituencyId, user, locationName }) {
  const [overview, setOverview] = useState(null)
  const [overviewError, setOverviewError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [drilldown, setDrilldown] = useState(null)
  const [panel, setPanel] = useState(null)

  useEffect(() => {
    let cancelled = false
    setOverview(null)
    setOverviewError('')
    getKSSCommitteeOverview(constituencyId)
      .then((data) => { if (!cancelled) setOverview(data) })
      .catch((err) => {
        if (cancelled) return
        console.error(err)
        setOverviewError(err.message)
        setOverview({})
      })
    return () => { cancelled = true }
  }, [constituencyId, reloadKey])

  const bump = () => setReloadKey((k) => k + 1)
  const loading = !overview

  return (
    <div>
      <div className="leap-section-header leap-committee-section-header">
        <h3>KSS (Kutumba Sadikara Saradulu)</h3>
        <button type="button" className="leap-btn-ghost" onClick={() => setDrilldown('complete')}>
          Click to KSS complete overview
        </button>
      </div>

      {overviewError && <div className="leap-form-error">{overviewError}</div>}

      {loading ? (
        <div className="leap-stat-row leap-committee-stat-row" aria-label="Loading KSS overview">
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="leap-skel leap-skel-tile" />)}
        </div>
      ) : (
        <div className="leap-stat-row leap-committee-stat-row">
          <CommitteeStatTile
            icon={<IconPin />} accent="#2563eb" label="Total Booths"
            value={overview?.totalBooth} sub="Tap to view booth-wise fill"
            onClick={() => setDrilldown('booths')}
          />
          <CommitteeStatTile
            icon={<IconLayers />} accent="#94a3b8" label="Min KSS Sections"
            value={overview?.minSections} sub="Minimum required"
          />
          <CommitteeStatTile
            icon={<IconPeople />} accent="#94a3b8" label="Min KSS Members"
            value={overview?.minKssRequired} sub="Minimum required"
          />
          <CommitteeStatTile
            icon={<IconGrid />} accent="#d97706" label="Total KSS Sections Created"
            value={overview?.totalSections} sub="Tap to view & manage"
            onClick={() => setDrilldown('sections')}
          />
          <CommitteeStatTile
            icon={<IconUserCheck />} accent="#059669" label="Total KSS Members Assigned"
            value={overview?.totalKssAssigned} sub="Tap to view & manage"
            onClick={() => setDrilldown('members')}
          />
        </div>
      )}

      <div className="leap-committee-actions">
        <button
          type="button"
          className={`leap-btn-secondary accent-blue ${panel === 'create' ? 'is-active' : ''}`}
          onClick={() => setPanel(panel === 'create' ? null : 'create')}
        >
          <IconPlus /> Create KSS
        </button>
        <button
          type="button"
          className={`leap-btn-secondary accent-purple ${panel === 'createAssign' ? 'is-active' : ''}`}
          onClick={() => setPanel(panel === 'createAssign' ? null : 'createAssign')}
        >
          <IconPlus /> Create KSS & Assign Members
        </button>
        <button
          type="button"
          className={`leap-btn-secondary accent-green ${panel === 'assign' ? 'is-active' : ''}`}
          onClick={() => setPanel(panel === 'assign' ? null : 'assign')}
        >
          <IconUserCheck /> Assign Members
        </button>
      </div>

      {panel === 'create' && <CreateKssForm constituencyId={constituencyId} onDone={bump} />}
      {panel === 'createAssign' && <CreateKssWithMembersForm constituencyId={constituencyId} onDone={bump} />}
      {panel === 'assign' && <AssignMembersForm constituencyId={constituencyId} onDone={bump} />}

      {drilldown && (
        <KssDrilldownModal
          kind={drilldown}
          constituencyId={constituencyId}
          user={user}
          locationName={locationName}
          onClose={() => setDrilldown(null)}
          onChanged={bump}
        />
      )}
    </div>
  )
}
