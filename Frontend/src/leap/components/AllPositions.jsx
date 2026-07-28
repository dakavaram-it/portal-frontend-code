import { useMemo, useState } from 'react'
import { STAGES, STAGE_COLORS, summary } from '../data.js'
import PositionCard from './PositionCard.jsx'

export default function AllPositions({ positions, filter, onFilterChange, onOpen, onNewPosition }) {
  const [query, setQuery] = useState('')
  const s = summary(positions)

  const overallStageCounts = STAGES.map((_, i) => positions.filter((p) => p.stageIndex === i).length)

  const filtered = useMemo(() => {
    let list = positions
    if (filter === 'committee') list = list.filter((p) => p.kind === 'committee')
    if (filter === 'nominated') list = list.filter((p) => p.kind === 'nominated')
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter((p) => p.title.toLowerCase().includes(q) || p.role.toLowerCase().includes(q) || p.state.toLowerCase().includes(q))
    }
    return list
  }, [positions, filter, query])

  return (
    <div className="leap-view">
      <div className="leap-view-header">
        <div>
          <h1>All Positions</h1>
          <p>{s.total} total · {s.committees} Committees · {s.nominated} Nominated Posts</p>
        </div>
        <div className="leap-header-actions">
          <button className={filter === 'committee' ? 'leap-chip active amber' : 'leap-chip amber'} onClick={() => onFilterChange('committee')}>Committees ({s.committees})</button>
          <button className={filter === 'nominated' ? 'leap-chip active green' : 'leap-chip green'} onClick={() => onFilterChange('nominated')}>Nominated ({s.nominated})</button>
          <button className="leap-new-position-btn small" onClick={onNewPosition}>+ New Position</button>
        </div>
      </div>

      <div className="leap-pipeline-steps-row">
        {STAGES.map((st, i) => (
          <div key={st.key} className="leap-pipeline-step-tile">
            <span className="leap-step-index">{String(i + 1).padStart(2, '0')}</span>
            <span className="leap-step-count" style={{ color: STAGE_COLORS[i] }}>{overallStageCounts[i]}</span>
            <span className="leap-step-name">{st.label}{st.nomOnly && <em> Nom only</em>}</span>
          </div>
        ))}
      </div>

      <div className="leap-search-row">
        <input
          className="leap-search-input"
          placeholder="Search by name, role or location…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="leap-search-count">{filtered.length} positions</span>
      </div>

      {filter !== 'all' && (
        <button className="leap-chip" style={{ marginBottom: 16 }} onClick={() => onFilterChange('all')}>← All Positions</button>
      )}

      <div className="leap-card-grid">
        {filtered.map((p) => (
          <PositionCard key={p.id} position={p} onOpen={onOpen} />
        ))}
        {filtered.length === 0 && <div className="leap-empty">No positions match your search.</div>}
      </div>
    </div>
  )
}
