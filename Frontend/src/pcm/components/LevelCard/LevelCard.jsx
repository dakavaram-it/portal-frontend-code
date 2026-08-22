import Icon from '../Icon/Icon.jsx';
import { LEVEL_LABEL, badgeClass, fmtDate, num } from '../../lib/format.js';
import { api } from '../../lib/api.js';
import {
  NOT_SCHEDULED_COLUMNS, NOT_UPDATED_COLUMNS, PC_NOT_UPDATED_COLUMNS,
  columnsFor, pcNotConductedColumnsFor, openDrillProgressive
} from '../../lib/schedules.js';
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
  // MCS row count — same figure App & PC Summary lists, not schedule rows.
  const totalMeetings = meeting.totalMeetings != null
    ? meeting.totalMeetings
    : (pc ? pc.total : 0);
  return {
    conducted: u.completed || 0,
    notConducted: u.notConducted || 0,
    // Roster locations this meeting never scheduled at all — outside the
    // App funnel above on the meeting object itself, same as at table level.
    notUpdated: meeting.notScheduled || 0,
    totalMeetings,
    // The PC in-charge's own status: 'Y' is Conducted, IS NULL is Not
    // conducted — an explicit 'N' is its own rare state and counts as
    // neither, so the two can sit just under `pc.total` on a meeting that
    // carries one.
    pcConducted: pc ? pc.conducted : null,
    pcNotConducted: pc ? pc.notConducted : null,
    // Roster gap is the primary Not Updated figure; the arithmetic
    // Total − (Conducted + Not Conducted) is only a backup when the
    // roster value is missing.
    pcNotUpdated: pc
      ? (pc.notUpdated != null ? pc.notUpdated : pc.notUpdatedBackup)
      : null
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

  // Same drill helpers LevelTable uses, scoped to this one meeting so the
  // App/PC modal filters (Assembly / Parliament) see real rows. First page
  // opens the modal; remaining rows append in the background.
  const openSlice = (fetcher, columns, label) => {
    const title = name + ' · Meeting #' + meeting.id + ' · ' + label;
    return openDrillProgressive({
      onCount, title, columns, level, fetcher, meetingIds: [meeting.id]
    });
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
          <Stat
            label="App Conducted" value={t.conducted} tone="var(--ok)"
            onClick={() => openSlice(api.conductedSchedules, columnsFor(NOT_UPDATED_COLUMNS, level), 'App Conducted')}
          />
          <Stat
            label="App Not Conducted" value={t.notConducted} tone="var(--bad)"
            onClick={() => openSlice(api.notUpdatedSchedules, columnsFor(NOT_UPDATED_COLUMNS, level), 'App Not Conducted')}
          />
          <Stat
            label="App Not Updated" value={t.notUpdated}
            onClick={() => openSlice(api.notScheduledSchedules, columnsFor(NOT_SCHEDULED_COLUMNS, level), 'App Not Updated')}
          />
        </div>
        <div className="lc-box">
          <Stat
            label="PC Conducted" value={t.pcConducted} tone="var(--ok)"
            onClick={() => openSlice(api.pcCompletedSchedules, columnsFor(PC_NOT_UPDATED_COLUMNS, level), 'PC Conducted')}
          />
          <Stat
            label="PC Not conducted" value={t.pcNotConducted} tone="var(--accent)"
            onClick={() => openSlice(api.pcNotCompletedSchedules, pcNotConductedColumnsFor(level), 'PC Not conducted')}
          />
          <Stat
            label="PC Not Updated" value={t.pcNotUpdated}
            onClick={() => openSlice(api.pcNeverUpdatedSchedules, columnsFor(NOT_SCHEDULED_COLUMNS, level), 'PC Not Updated')}
          />
        </div>
      </div>

      <button
        className="lc-summary"
        type="button"
        aria-expanded={expanded}
        onClick={() => onSummary(meeting.id)}
      >
        <span className="lc-summary-label">Total Meetings</span>
        <span className="lc-summary-total num">{num(t.totalMeetings)}</span>
        <Icon name="arrow-right" sm />
      </button>
    </article>
  );
}
