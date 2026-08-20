import Icon from '../Icon/Icon.jsx';
import { LEVEL_LABEL, badgeClass, fmtDate, num } from '../../lib/format.js';
import { api } from '../../lib/api.js';
import { NOT_SCHEDULED_COLUMNS, PC_NOT_UPDATED_COLUMNS, columnsFor } from '../../lib/schedules.js';
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
    // A strict two-state read of the PC in-charge's own status: 'Y' is
    // Conducted, anything else (IS NULL, or 'N' on the rare row that
    // carries one) is Not conducted — the two foot to `pc.total` exactly.
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

  // The PC stats fetch this one meeting's own rows — `fetcher([meeting.id])`
  // is the same call LevelTable makes for a whole level, just scoped to a
  // single-meeting id list, so the count on the button and the rows behind
  // it are always the same meeting's.
  const openPc = async (fetcher, columns, label) => {
    const title = name + ' · Meeting #' + meeting.id + ' · ' + label;
    try {
      const data = await fetcher([meeting.id]);
      onCount({ title, rows: data.rows, columns });
    } catch {
      onCount({ title, rows: [], columns });
    }
  };

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
          <Stat
            label="PC Conducted" value={t.pcConducted} tone="var(--ok)"
            onClick={() => openPc(api.pcCompletedSchedules, columnsFor(PC_NOT_UPDATED_COLUMNS, level), 'PC Conducted')}
          />
          <Stat
            label="PC Not conducted" value={t.pcNotConducted} tone="var(--accent)"
            onClick={() => openPc(api.pcNotCompletedSchedules, columnsFor(PC_NOT_UPDATED_COLUMNS, level), 'PC Not conducted')}
          />
          <Stat
            label="PC Not Updated" value={t.pcNotUpdated}
            onClick={() => openPc(api.pcNeverUpdatedSchedules, columnsFor(NOT_SCHEDULED_COLUMNS, level), 'PC Not Updated')}
          />
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
