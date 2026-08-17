import { useEffect, useState } from 'react'
import { getAssemblies, useLoadable } from '../api.js'
import { Dropdown } from './NewPositionModal.jsx'
import KssPanel from './committee/KssPanel.jsx'
import CubsPanel from './committee/CubsPanel.jsx'
import MainCommitteePanel from './committee/MainCommitteePanel.jsx'

// KSS radio + committeeLevelId for the other three — same ids the legacy screen's own
// radio group used (validateSearchType(18|15|16|17) in cadreCommittee.js).
const CUBS_TYPES = [
  { id: 'kss', label: 'KSS (Kutumba Sadikara Saradulu)' },
  { id: 'booth', label: 'Booth Wise Committee', committeeLevelId: 15 },
  { id: 'unit', label: 'Unit Wise Committee', committeeLevelId: 16 },
  { id: 'cluster', label: 'Cluster Wise Committee', committeeLevelId: 17 },
]

export default function CommitteesAssign({ user }) {
  const [assemblyId, setAssemblyId] = useState('')
  const [tab, setTab] = useState('cubs')
  const [typeId, setTypeId] = useState(CUBS_TYPES[0].id)

  const { items: assemblies, loading: assembliesLoading } = useLoadable(getAssemblies, [])

  // Same self-selecting assembly as the Dashboard: the user's own home constituency when
  // it is one of their grants, otherwise the first one getAssemblies returned.
  useEffect(() => {
    if (assemblyId || assemblies.length === 0) return
    const own = assemblies.find((a) => String(a.constituency_id) === String(user?.constituency_id))
    setAssemblyId(String((own || assemblies[0]).constituency_id))
  }, [assemblies, user])

  const assemblyName = assemblies.find((a) => String(a.constituency_id) === assemblyId)?.constituency_name
  const activeType = CUBS_TYPES.find((t) => t.id === typeId)

  return (
    <div className="leap-view">
      <div className="leap-view-header">
        <div className="leap-view-header-brand">
          <div>
            <h1>Committees Assign</h1>
            <p>
              {assemblyName
                ? `Committee Management — ${assemblyName} Constituency.`
                : 'Committee Management for a state assembly.'}
            </p>
          </div>
        </div>

        <div className="leap-header-actions">
          <div className="leap-dash-filter">
            <label className="leap-dash-filter-label" htmlFor="committee-assembly">Constituency</label>
            {assembliesLoading ? (
              <div className="leap-skel leap-skel-input" aria-label="Loading assemblies" />
            ) : (
              <div id="committee-assembly">
                <Dropdown
                  value={assemblyId}
                  onChange={setAssemblyId}
                  searchable
                  placeholder="Select…"
                  options={assemblies.map((a) => ({
                    value: String(a.constituency_id),
                    label: a.constituency_name,
                  }))}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {!assembliesLoading && assemblies.length === 0 && (
        <div className="leap-members-empty">
          No assembly is granted to this account, so there is nothing to show. Ask an
          administrator for access to a constituency.
        </div>
      )}

      {assemblyId && (
        <>
          <div className="leap-committee-note">
            <span className="leap-committee-note-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5" />
                <path d="M12 16.5h.01" />
              </svg>
            </span>
            <p>
              <strong>Note: </strong>
              1. పార్టీలో ఏ పదవివైనా అతను/ఆమె KSS అయి ఉండాలి.
              {' '}2. ప్రతి 60 మంది ఓటర్లకు ఒక KSS విభాగాన్ని సృష్టించాలి.
              {' '}3. ప్రతి KSS విభాగానికి - ఒక పురుషుడు మరియు ఒక స్త్రీ సభ్యురాలిని కేటాయించాలి.
            </p>
          </div>

          <div className="leap-committee-tabs-row">
            <div className="leap-committee-tabs" role="tablist" aria-label="Committee mode">
              {[{ id: 'cubs', label: 'CUBS' }, { id: 'committees', label: 'Committees' }].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={`leap-committee-tab ${tab === t.id ? 'active' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {tab === 'committees' ? (
            <div className="leap-committee-card">
              <MainCommitteePanel key={assemblyId} constituencyId={assemblyId} user={user} />
            </div>
          ) : (
            <div className="leap-committee-card">
              <div className="leap-chip-list leap-committee-chip-list" role="radiogroup" aria-label="Committee level">
                {CUBS_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={typeId === t.id}
                    className={`leap-chip-option ${typeId === t.id ? 'selected' : ''}`}
                    onClick={() => setTypeId(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="leap-section">
                {typeId === 'kss' ? (
                  <KssPanel key={assemblyId} constituencyId={assemblyId} user={user} locationName={assemblyName} />
                ) : (
                  <CubsPanel
                    key={`${assemblyId}_${activeType.committeeLevelId}`}
                    constituencyId={assemblyId}
                    committeeLevelId={activeType.committeeLevelId}
                    locationName={assemblyName}
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
