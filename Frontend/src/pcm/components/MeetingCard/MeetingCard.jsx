import Icon from '../Icon/Icon.jsx';
import { LEVEL_LABEL, badgeClass, fmtSpan, num, tone } from '../../lib/format.js';
import './MeetingCard.css';

/* A committee meeting runs across every unit in the state, so it has no single
   venue or constituency. The attendance split is unknown until its member list
   has been pulled — until then the card shows the unit progress the service
   reports and says so, rather than showing 0%. */
export default function MeetingCard({ meeting: m, onOpen }) {
  const known = m.completion !== null && m.completion !== undefined;
  const u = m.units;

  return (
    <button
      className="meeting-card"
      type="button"
      style={{ '--tone': known ? tone(m.completion) : 'var(--surface-3)' }}
      aria-label={
        known
          ? `${m.title}, ${m.completion} percent feedback complete. Open member list.`
          : `${m.title}. Open member list.`
      }
      onClick={() => onOpen(m.id)}
    >
      <div className="mc-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mc-id mono">{m.id}</div>
          <h3 className="mc-title">{m.title}</h3>
        </div>
        <span className={`badge ${badgeClass(m.level)}`}>{LEVEL_LABEL[m.level] || m.levelName}</span>
        <Icon name="arrow-right" sm className="mc-go" />
      </div>

      <div className="mc-meta">
        {m.date && <span><Icon name="calendar" sm />{fmtSpan(m)}</span>}
        <span><Icon name="layers" sm />{m.meetingType}</span>
        <span><Icon name="pin" sm />{u.completed} of {u.total} units completed</span>
      </div>

      {known ? (
        <div className="progress-block">
          <div className="bar"><i style={{ width: m.completion + '%' }} /></div>
          <span className="pct num" style={{ color: tone(m.completion) }}>{m.completion}%</span>
        </div>
      ) : (
        <div className="progress-block">
          <div className="bar" />
          <span className="pct">Open to load</span>
        </div>
      )}

      <div className="stat-strip">
        <div><div className="s-val num">{num(m.invitees)}</div><div className="s-key">Invited</div></div>
        <div>
          <div className="s-val num" style={{ color: 'var(--ok)' }}>{num(m.attendanceRecords)}</div>
          {/* records, not people — upstream counts attendance rows across units */}
          <div className="s-key">Attended</div>
        </div>
        <div>
          <div className="s-val num" style={{ color: 'var(--bad)' }}>{m.absent === null ? '—' : num(m.absent)}</div>
          <div className="s-key">Absent</div>
        </div>
        <div><div className="s-val num">{num(m.feedbackTaken)}</div><div className="s-key">Captured</div></div>
        <div>
          <div className="s-val num" style={{ color: 'var(--warn)' }}>
            {m.feedbackPending === null ? '—' : num(m.feedbackPending)}
          </div>
          <div className="s-key">Owed</div>
        </div>
      </div>
    </button>
  );
}
