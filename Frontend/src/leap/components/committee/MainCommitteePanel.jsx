import { useEffect, useState } from 'react'
import {
  getMainCommitteeMandals,
  getMainCommitteeLocationsByMandal,
  getMainCommitteeLocations,
  getAffiliatedCommittees,
  getMainCommitteeSnapshot,
  getAllCommitteeMembersInALocation,
} from '../../committeeApi.js'
import { Dropdown } from '../NewPositionModal.jsx'
import CommitteeSnapshotPanel from './CommitteeSnapshotPanel.jsx'

const LEVELS = [
  { id: '1', label: 'Village / Ward Wise Committee' },
  { id: '2', label: 'Mandal / Town / Division Wise Committee' },
  { id: '3', label: 'Constituency Wise Committee' },
]

const COMMITTEE_TYPES = [
  { value: '1', label: 'Main Committee' },
  { value: '2', label: 'Affiliated Committee' },
  { value: '3', label: 'View All Committee Info' },
]

// The one location-scoping input getCommitteMembersInfo actually wants — see
// committeeApi.js's own note on why this is the fuzziest part of the contract. Village/
// Ward leaves it blank (the legacy code never resolves it to anything else in the live
// path), Mandal/Town/Division and Affiliated pass 'mandal', Constituency passes
// 'assembly'.
function locationTypeFor(levelId, committeeTypeId) {
  if (committeeTypeId === '2') return levelId === '3' ? 'assembly' : ''
  if (levelId === '2') return 'mandal'
  if (levelId === '3') return 'assembly'
  return ''
}

// The Village-Ward / Mandal-Town-Division / Constituency wise Main & Affiliated
// Committee flow — the "Committees" tab in the legacy screen. Simpler than KSS in one
// way (one snapshot call carries both the designation list and the member list) and
// more involved in another (three location-picking shapes depending on which radio is
// picked).
export default function MainCommitteePanel({ constituencyId, user }) {
  const [levelId, setLevelId] = useState('1')
  const [mandalId, setMandalId] = useState('')
  const [mandalOptions, setMandalOptions] = useState([])
  const [locationId, setLocationId] = useState('')
  const [locationOptions, setLocationOptions] = useState([])
  const [committeeTypeId, setCommitteeTypeId] = useState('1')
  const [affiliatedId, setAffiliatedId] = useState('')
  const [affiliatedOptions, setAffiliatedOptions] = useState([])

  const [snapshot, setSnapshot] = useState(null) // {roles, members} | null
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [snapshotError, setSnapshotError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  // Resetting the whole downstream selection whenever the level radio changes — a
  // location from one level's shape means nothing under another's.
  const changeLevel = (id) => {
    setLevelId(id)
    setMandalId('')
    setLocationId('')
    setLocationOptions([])
    setCommitteeTypeId('1')
    setAffiliatedId('')
    setAffiliatedOptions([])
    setSnapshot(null)
  }

  useEffect(() => {
    if (levelId !== '1') return
    let cancelled = false
    getMainCommitteeMandals(constituencyId)
      .then((rows) => { if (!cancelled) setMandalOptions(rows) })
      .catch((err) => console.error(err))
    return () => { cancelled = true }
  }, [levelId, constituencyId])

  useEffect(() => {
    if (levelId !== '1' || !mandalId) return
    let cancelled = false
    setLocationId('')
    getMainCommitteeLocationsByMandal(mandalId, constituencyId)
      .then((rows) => { if (!cancelled) setLocationOptions(rows) })
      .catch((err) => console.error(err))
    return () => { cancelled = true }
  }, [levelId, mandalId, constituencyId])

  useEffect(() => {
    if (levelId !== '2') return
    let cancelled = false
    getMainCommitteeLocations(constituencyId)
      .then((rows) => { if (!cancelled) setLocationOptions(rows) })
      .catch((err) => console.error(err))
    return () => { cancelled = true }
  }, [levelId, constituencyId])

  useEffect(() => {
    if (committeeTypeId !== '2') { setAffiliatedOptions([]); setAffiliatedId(''); return }
    const locationType = levelId === '3' ? 'assembly' : ''
    const locationValue = levelId === '3' ? constituencyId : locationId
    if (levelId !== '3' && !locationValue) return
    let cancelled = false
    getAffiliatedCommittees(locationType, locationValue)
      .then((rows) => { if (!cancelled) setAffiliatedOptions(rows) })
      .catch((err) => console.error(err))
    return () => { cancelled = true }
  }, [committeeTypeId, levelId, locationId, constituencyId])

  // A selection is "complete" once every field the current level/type combination needs
  // has a value — that's what triggers the one snapshot fetch both View and Add read
  // from, instead of the legacy's two separate calls for the same data.
  const locationValue = levelId === '3' ? constituencyId : locationId
  const selectionComplete =
    (levelId !== '3' ? !!locationValue : true) &&
    (committeeTypeId === '2' ? !!affiliatedId : committeeTypeId !== '0')

  useEffect(() => {
    setSnapshot(null)
    if (!selectionComplete) return
    let cancelled = false
    setSnapshotLoading(true)
    setSnapshotError('')
    // The response's own `locationName` doubles as a confirmed/locked flag — 'N' means
    // still open, anything else means the committee is confirmed and members can't be
    // added, updated, or removed (the legacy screen's own check).
    const load = committeeTypeId === '3'
      ? getAllCommitteeMembersInALocation(locationTypeFor(levelId, committeeTypeId), locationValue).then((r) => ({ roles: [], members: r?.hamletsOfTownship || [] }))
      : getMainCommitteeSnapshot(
          locationTypeFor(levelId, committeeTypeId),
          committeeTypeId === '2' ? affiliatedId : locationValue,
          committeeTypeId === '2' ? 'affiliated' : 'main',
        ).then((r) => ({
          roles: r?.result || [],
          members: r?.hamletsOfTownship || [],
          locked: typeof r?.locationName === 'string' && r.locationName !== 'N',
        }))
    load
      .then((data) => { if (!cancelled) setSnapshot(data) })
      .catch((err) => {
        if (cancelled) return
        console.error(err)
        setSnapshotError(err.message)
        setSnapshot({ roles: [], members: [] })
      })
      .finally(() => { if (!cancelled) setSnapshotLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionComplete, levelId, committeeTypeId, locationValue, affiliatedId, reloadKey])

  const bump = () => setReloadKey((k) => k + 1)

  return (
    <div>
      <div className="leap-chip-list leap-committee-chip-list" role="radiogroup" aria-label="Committee scope">
        {LEVELS.map((l) => (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={levelId === l.id}
            className={`leap-chip-option ${levelId === l.id ? 'selected' : ''}`}
            onClick={() => changeLevel(l.id)}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="leap-section-header leap-committee-section-header">
        <h3>{LEVELS.find((l) => l.id === levelId)?.label}</h3>
      </div>

      <div className="leap-committee-form-row">
        {levelId === '1' && (
          <div className="leap-committee-field">
            <label>Mandal / Municipality / Corporation</label>
            <Dropdown value={mandalId} onChange={setMandalId} searchable placeholder="Select…" options={mandalOptions} />
          </div>
        )}
        {(levelId === '1' || levelId === '2') && (
          <div className="leap-committee-field">
            <label>Location</label>
            <Dropdown
              value={locationId}
              onChange={setLocationId}
              searchable
              placeholder="Select…"
              options={locationOptions}
              disabled={levelId === '1' && !mandalId}
            />
          </div>
        )}
        <div className="leap-committee-field">
          <label>Committee Type</label>
          <Dropdown value={committeeTypeId} onChange={setCommitteeTypeId} options={COMMITTEE_TYPES} />
        </div>
        {committeeTypeId === '2' && (
          <div className="leap-committee-field">
            <label>Affiliated Committee</label>
            <Dropdown value={affiliatedId} onChange={setAffiliatedId} searchable placeholder="Select…" options={affiliatedOptions} />
          </div>
        )}
      </div>

      {!selectionComplete && (
        <div className="leap-members-empty">Complete the selection above to view or add committee members.</div>
      )}

      {selectionComplete && (
        <CommitteeSnapshotPanel
          key={`${locationValue}_${committeeTypeId}_${affiliatedId}`}
          snapshot={snapshot}
          snapshotLoading={snapshotLoading}
          snapshotError={snapshotError}
          constituencyId={constituencyId}
          user={user}
          onReload={bump}
          showAdd={committeeTypeId !== '3'}
        />
      )}
    </div>
  )
}
