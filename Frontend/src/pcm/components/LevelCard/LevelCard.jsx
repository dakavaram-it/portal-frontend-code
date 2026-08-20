import Icon from '../Icon/Icon.jsx';
import { LEVEL_LABEL, badgeClass, fmtDate, num } from '../../lib/format.js';
import './LevelCard.css';

// `units` is the App schedule funnel; `pc` is the PC in-charge's own real
// conducted/not-conducted split from `meeting_conducted_status`. Both sides
// are now the same three-bucket partition `LevelTable` sums across a whole
// level: Conducted, Not conducted (a row exists but says no / IS NULL), and
// Not updated (never touched at all) — each pair adds up to the meeting's
// own total with nothing double-counted. `meeting.pc` is `null` when the
// meeting has no rows there at all, kept apart from a real 0 so "not tracked
// yet" doesn't read as "zero conducted".
function summarise(meeting) {
  const u = meeting.units || {};
  const pc = meeting.pc;
  return {
    conducted: u.completed || 0,
    notConducted: u.notConducted || 0,
    // Roster locations this meeting never scheduled at all — outside the
    // App funnel above on the meeting object itself, same as at table level.
    notUpdated: meeting.notScheduled || 0,
    pcConducted: pc ? pc.conducted : null,
    // "Not conducted" is IS NULL; "Not updated" is the remainder off the
    // PC in-charge's own total — explicit 'N' — not its own condition.
    pcNotConducted: pc ? pc.notUpdated : null,
    pcNotUpdated: pc ? pc.total - pc.conducted - pc.notUpdated : null
  };
}

function Stat({ label, value, tone, onClick }) {
  return (
    <button className="lc-stat" type="button" onClick={onClick}>
      <span className="lc-stat-key">{label}</span>
      <span className="lc-stat-val num" style={tone ? { color: tone } : undefined}>
        {value === null ? '—' : num(value)}
      </span>
    </button>
  );
}

export default function LevelCard({ level, meeting, onCount, onSummary, expanded }) {
  const t = summarise(meeting);
  const name = LEVEL_LABEL[level] || level;
  const open = (label) => onCount(name + ' · Meeting #' + meeting.id + ' · ' + label);

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
          <Stat label="App Conducted" value={t.conducted} tone="var(--ok)" onClick={() => open('App Conducted')} />
          <Stat label="App Not Conducted" value={t.notConducted} tone="var(--bad)" onClick={() => open('App Not Conducted')} />
          <Stat label="App Not Updated" value={t.notUpdated} onClick={() => open('App Not Updated')} />
        </div>
        <div className="lc-box">
          <Stat label="PC Conducted" value={t.pcConducted} tone="var(--ok)" onClick={() => open('PC Conducted')} />
          <Stat label="PC Not conducted" value={t.pcNotConducted} tone="var(--accent)" onClick={() => open('PC Not conducted')} />
          <Stat label="PC Not Updated" value={t.pcNotUpdated} onClick={() => open('PC Not Updated')} />
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
