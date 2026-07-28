import { STAGES, STAGE_COLORS, PARTY_SHORT, TERM_LABEL, summary } from '../data.js'

function StatTile({ label, value, sub }) {
  return (
    <div className="leap-stat-tile">
      <div className="leap-stat-label">{label}</div>
      <div className="leap-stat-value">{value}</div>
      {sub && <div className="leap-stat-sub">{sub}</div>}
    </div>
  )
}

function PipelinePanel({ title, accent, stats, stageCounts, stageKeys, recent, onOpen }) {
  return (
    <div className="leap-pipeline-panel" style={{ borderColor: accent }}>
      <div className="leap-pipeline-header">
        <div>
          <div className="leap-pipeline-title">{title}</div>
          <div className="leap-pipeline-sub">{stats.positions} positions · {stats.positions} {title === 'Committees' ? 'State' : 'State'}</div>
        </div>
      </div>

      <div className="leap-pipeline-stats">
        <div><div className="num">{stats.positions}</div><div className="lbl">POSITIONS</div></div>
        <div><div className="num">{stats.candidates}</div><div className="lbl">CANDIDATES</div></div>
        <div><div className="num">{stats.finalized}</div><div className="lbl">FINALIZED</div></div>
        <div><div className="num">{stats.complete}%</div><div className="lbl">COMPLETE</div></div>
      </div>

      <div className="leap-pipeline-label">PIPELINE</div>
      <div className="leap-progress-track wide">
        {stageKeys.map((si) => (
          <span key={si} className="leap-progress-seg" style={{ background: stageCounts[si] > 0 ? STAGE_COLORS[si] : '#e5e7eb', flexGrow: stageCounts[si] > 0 ? stageCounts[si] : 0.2 }} />
        ))}
      </div>
      <div className="leap-pipeline-steps">
        {stageKeys.map((si) => (
          <span key={si} className="leap-pipeline-step-chip" style={{ opacity: stageCounts[si] ? 1 : 0.4 }}>
            <span className="dot" style={{ background: STAGE_COLORS[si] }} />
            {stageCounts[si]} {STAGES[si].label}
          </span>
        ))}
      </div>

      <div className="leap-pipeline-recent-label">RECENT</div>
      <div className="leap-pipeline-recent">
        {recent.map((p, i) => (
          <button key={p.id} className="leap-recent-row" onClick={() => onOpen(p.id)}>
            <span className="leap-recent-index">{String(i + 1).padStart(2, '0')}</span>
            <span className="leap-recent-body">
              <span className="leap-recent-title">{p.title}</span>
              <span className="leap-recent-meta">{p.role} · {p.level} · {p.state} · {p.candidates.length} candidates</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard({ positions, onOpen }) {
  const s = summary(positions)
  const committees = positions.filter((p) => p.kind === 'committee')
  const nominated = positions.filter((p) => p.kind === 'nominated')

  const committeeStageCounts = STAGES.slice(0, 5).map((_, i) => committees.filter((p) => p.stageIndex === i).length)
  const nominatedStageCounts = STAGES.map((_, i) => nominated.filter((p) => p.stageIndex === i).length)
  const overallStageCounts = STAGES.map((_, i) => positions.filter((p) => p.stageIndex === i).length)

  const active = positions
    .filter((p) => p.stageIndex >= 1)
    .sort((a, b) => b.stageIndex - a.stageIndex)
    .slice(0, 8)

  return (
    <div className="leap-view">
      <div className="leap-view-header">
        <div className="leap-view-header-brand">
          <span className="leap-header-mark">{PARTY_SHORT}</span>
          <div>
            <h1>Dashboard</h1>
            <p>{PARTY_SHORT} Cadre Evaluation · Nomination Pipeline · {TERM_LABEL}</p>
          </div>
        </div>
      </div>

      <div className="leap-stat-row">
        <StatTile label="TOTAL POSITIONS" value={s.total} sub={`${s.committees}C · ${s.nominated}N`} />
        <StatTile label="COMMITTEES" value={s.committees} sub="Party positions" />
        <StatTile label="NOMINATED POSTS" value={s.nominated} sub="Boards & Commissions" />
        <StatTile label="SHORTLISTED" value={s.shortlisted} sub="Awaiting finalisation" />
        <StatTile label="FINALIZED" value={s.finalized} sub="Appointments confirmed" />
        <StatTile label="GO ISSUED" value={s.goIssued} sub="Nominated Posts only" />
      </div>

      <div className="leap-pipeline-grid">
        <PipelinePanel
          title="Committees"
          accent="#f59e0b"
          stats={s.committeeStats}
          stageCounts={committeeStageCounts}
          stageKeys={[0, 1, 2, 3, 4]}
          recent={committees.slice().reverse().slice(0, 3)}
          onOpen={onOpen}
        />
        <PipelinePanel
          title="Nominated Posts"
          accent="#10b981"
          stats={s.nominatedStats}
          stageCounts={nominatedStageCounts}
          stageKeys={[0, 1, 2, 3, 4, 5, 6]}
          recent={nominated.slice().reverse().slice(0, 3)}
          onOpen={onOpen}
        />
      </div>

      <div className="leap-section">
        <div className="leap-section-header">
          <h3>Nomination Pipeline</h3>
          <span className="leap-section-sub">Click any step to view positions in that stage</span>
        </div>
        <div className="leap-pipeline-steps-row">
          {STAGES.map((st, i) => (
            <div key={st.key} className="leap-pipeline-step-tile">
              <span className="leap-step-index">{String(i + 1).padStart(2, '0')}</span>
              <span className="leap-step-count" style={{ color: STAGE_COLORS[i] }}>{overallStageCounts[i]}</span>
              <span className="leap-step-name">{st.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="leap-section">
        <div className="leap-section-header">
          <h3>Active Positions</h3>
          <span className="leap-section-sub">Step 02 and above · {active.length} in progress</span>
        </div>
        <table className="leap-table">
          <thead>
            <tr>
              <th>STEP</th>
              <th>POSITION &amp; ROLE</th>
              <th>TYPE / LEVEL</th>
              <th>CANDIDATES</th>
            </tr>
          </thead>
          <tbody>
            {active.map((p) => (
              <tr key={p.id} onClick={() => onOpen(p.id)}>
                <td>
                  <span className="leap-step-badge" style={{ background: STAGE_COLORS[p.stageIndex] }}>{String(p.stageIndex + 1).padStart(2, '0')}</span>
                  <span className="leap-step-name-inline">{STAGES[p.stageIndex].label}</span>
                </td>
                <td>
                  <div className="leap-table-title">{p.title}</div>
                  <div className="leap-table-sub">ROLE {p.role}</div>
                </td>
                <td>{p.kind === 'nominated' ? 'Board' : 'Committee'} · {p.level} · {p.state}</td>
                <td>{p.candidates.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
