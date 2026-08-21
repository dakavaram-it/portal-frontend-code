import Icon from '../Icon/Icon.jsx';
import { LEVEL_LABEL, badgeClass, fmtDate, num } from '../../lib/format.js';
import './LevelCard.css';

// `units` is the App schedule funnel, its own three-bucket partition
// (Conducted, Not conducted, Not updated/never scheduled). `pc` is the PC
// in-charge's own real status from `meeting_conducted_status`, read as a
// strict two states — see the note by `pcConducted` below. `meeting.pc` is
// `null` when the meeting has no rows there at all, kept apart from a real
// 0 so "not tracked yet" doesn't read as "zero conducted".
function summarise(meeting) {
  const u = meeting.units || {};
  const pc = meeting.pc;
  return {
    conducted: u.completed || 0,
    notConducted: u.notConducted || 0,
    // Roster locations this meeting never scheduled at all — outside the
    // App funnel above on the meeting object itself, same as at table level.
    notUpdated: meeting.notScheduled || 0,
    // The PC in-charge's own status: 'Y' is Conducted, IS NULL is Not
    // conducted — an explicit 'N' is its own rare state and counts as
    // neither, so the two can sit just under `pc.total` on a meeting that
    // carries one.
    pcConducted: pc ? pc.conducted : null,
    pcNotConducted: pc ? pc.notConducted : null,
    // Roster locations with no `meeting_conducted_status` row at all — the
    // PC-side twin of `notUpdated` above, outside `pc.total` on purpose the
    // same way that one sits outside `units.total`. The backend only ever
    // sends it inside `pc`, so it reads as "not tracked yet" right along
    // with `pcConducted`/`pcNotConducted` when `pc` is null, same as those.
    pcNotUpdated: pc ? pc.notUpdated : null
  };
}

// Plain display, not a control — these six figures are read-only on the
// per-meeting card; the same drill-downs are still reachable from the
// level-wide table above.
function Stat({ label, value, tone }) {
  return (
    <div className="lc-stat">
      <span className="lc-stat-key">{label}</span>
      <span className="lc-stat-val num" style={tone ? { color: tone } : undefined}>
        {value === null ? '—' : num(value)}
      </span>
    </div>
  );
}

export default function LevelCard({ level, meeting, onSummary, expanded }) {
  const t = summarise(meeting);
  const name = LEVEL_LABEL[level] || level;

  return (
    <article className="level-card">
      <div className="lc-head">
        <span className={`badge ${badgeClass(level)}`}>{name} · #{meeting.id}</span>
        <span className="lc-date">
          <Icon name="calendar" sm />
          {meeting.date ? fmtDate(meeting.date) : 'No meeting date'}
        </span>
      </div>

      <div className="lc-split">
        <div className="lc-box">
          <Stat label="App Conducted" value={t.conducted} tone="var(--ok)" />
          <Stat label="App Not Conducted" value={t.notConducted} tone="var(--bad)" />
          <Stat label="App Not Updated" value={t.notUpdated} />
        </div>
        <div className="lc-box">
          <Stat label="PC Conducted" value={t.pcConducted} tone="var(--ok)" />
          <Stat label="PC Not conducted" value={t.pcNotConducted} tone="var(--accent)" />
          <Stat label="PC Not Updated" value={t.pcNotUpdated} />
        </div>
      </div>

      <button
        className="lc-summary"
        type="button"
        aria-expanded={expanded}
        onClick={() => onSummary(meeting.id)}
      >
        <span>App &amp; PC summary</span>
        <Icon name="arrow-right" sm />
      </button>
    </article>
  );
}
