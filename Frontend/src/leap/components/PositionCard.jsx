import { STAGE_COLORS, stagesFor } from '../data.js'

export default function PositionCard({ position, onOpen }) {
  const stages = stagesFor(position.kind)
  const stageIndex = Math.min(position.stageIndex, stages.length - 1)
  const stage = stages[stageIndex]
  const finalized = position.candidates.filter((c) => c.status === 'Finalized').length
  const shortlisted = position.candidates.length - finalized

  return (
    <button className="leap-position-card" onClick={() => onOpen(position.id)}>
      <div className="leap-card-top">
        <span className={`leap-kind-badge ${position.kind}`}>{position.kind === 'nominated' ? 'BOARD' : 'COMMITTEE'}</span>
        <span className="leap-card-dept">{position.dept}</span>
        <span className="leap-card-state">{position.level} · {position.state}</span>
        <span className="leap-step-pill">{String(position.stageIndex + 1).padStart(2, '0')} / {String(stages.length).padStart(2, '0')}</span>
      </div>

      <div className="leap-card-title">{position.title}</div>
      <div className="leap-card-role">{position.role}</div>

      <div className="leap-progress-track">
        {stages.map((s, i) => (
          <span
            key={s.key}
            className="leap-progress-seg"
            style={{ background: i <= position.stageIndex ? STAGE_COLORS[i] : '#e5e7eb' }}
          />
        ))}
      </div>

      <div className="leap-card-stage-row">
        <span className="leap-card-stage-label" style={{ color: STAGE_COLORS[stageIndex] }}>{stage.full}</span>
        <span className="leap-card-team">{stage.team.split('·')[0].trim()}</span>
      </div>

      <div className="leap-card-stats">
        <div>
          <div className="leap-card-stat-num">{position.seatsFilled}/{position.seats}</div>
          <div className="leap-card-stat-label">SEATS FILLED</div>
        </div>
        <div>
          <div className="leap-card-stat-num">{position.candidates.length}</div>
          <div className="leap-card-stat-label">CANDIDATES</div>
        </div>
        <div>
          <div className="leap-card-stat-num">{shortlisted}</div>
          <div className="leap-card-stat-label">SHORTLISTED</div>
        </div>
      </div>

      {finalized > 0 && <div className="leap-card-footer-tag finalized">{finalized} Finalized</div>}
      {finalized === 0 && shortlisted > 0 && <div className="leap-card-footer-tag">{shortlisted} Shortlisted</div>}
    </button>
  )
}
