import { useMemo } from 'react';
import { api } from '../../lib/api.js';
import { LEVEL_LABEL, badgeClass, num } from '../../lib/format.js';
import { isoDay } from '../../lib/calendar.js';
import {
  NOT_SCHEDULED_COLUMNS, NOT_UPDATED_COLUMNS, PC_NOT_UPDATED_COLUMNS, PC_REMARKS_COLUMNS, columnsFor
} from '../../lib/schedules.js';
import './LevelTable.css';

// The Total column lists every roster location behind the level's meetings —
// the same three buckets `tally` sums (conducted, not conducted, never
// scheduled) — one row per location. None of the schedule endpoints carry
// `date`, only `meetingId`, so it's joined in client-side from `items`.
const TOTAL_COLUMNS = [
  { key: 'meetingId', label: 'Meeting ID' },
  { key: 'parliament', label: 'Parliament' },
  { key: 'assembly', label: 'Assembly' },
  { key: 'location', label: 'Location' },
  { key: 'date', label: 'Date' }
];

const RANGES = [
  ['today', 'Today'],
  ['yesterday', 'Yesterday'],
  ['overall', 'Overall'],
  ['custom', 'Custom']
];

const LEVELS = Object.keys(LEVEL_LABEL);

const empty = () => ({
  conducted: 0,
  notConducted: 0,
  notScheduled: 0,
  pcCompleted: 0,
  pcNotCompleted: 0,
  pcNotUpdated: 0,
  remarks: 0
});

function shiftDay(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return isoDay(d);
}

function inRange(m, range, from, to) {
  if (range === 'overall') return true;
  if (!m.date) return false;
  if (range === 'today') return m.date === shiftDay(0);
  if (range === 'yesterday') return m.date === shiftDay(-1);
  if (!from && !to) return true;
  if (from && m.date < from) return false;
  if (to && m.date > to) return false;
  return true;
}

export function meetingsInRange(meetings, range, from, to) {
  return meetings.filter((m) => inRange(m, range, from, to));
}

function tally(items) {
  return items.reduce((a, m) => {
    const u = m.units || {};
    a.conducted += u.completed || 0;
    a.notConducted += u.notConducted || 0;
    // Roster locations at this level with no schedule row at all for this
    // meeting — distinct from `notConducted`, which is scheduled-but-not-done.
    a.notScheduled += m.notScheduled || 0;
    a.remarks += m.pcRemarks || 0;
    /* PC Status' Conducted/Not conducted is a strict two-state read of
       `meeting_conducted_status`: `is_conducted = 'Y'` is Conducted,
       anything else — `IS NULL`, and 'N' on the rare row that carries one —
       is Not conducted, so the two always foot to `pc.total`. Not Updated
       sits outside that total the same way `notScheduled` sits outside
       `units.total`: it's roster locations with no conducted-status row at
       all, not a subset of the rows counted in `pc.total`. A meeting with
       no rows there at all (`m.pc` is null) contributes nothing to either
       Conducted or Not conducted — there is nothing to count yet — but can
       still carry a Not Updated figure, so that one is read unconditionally. */
    if (m.pc) {
      a.pcCompleted += m.pc.conducted;
      a.pcNotCompleted += m.pc.notConducted;
    }
    a.pcNotUpdated += m.pc ? m.pc.notUpdated : 0;
    return a;
  }, empty());
}

function Cell({ value, tone, onClick }) {
  return (
    <td className="n">
      <button
        className="cell-count num"
        type="button"
        style={tone ? { color: tone } : undefined}
        onClick={onClick}
      >
        {num(value)}
      </button>
    </td>
  );
}

export default function LevelTable({
  meetings, range, from, to, onRange, onFrom, onTo, picked, onPick, onCount
}) {

  const rows = useMemo(() => {
    const scoped = meetings.filter((m) => inRange(m, range, from, to));
    return LEVELS.map((level) => {
      const items = scoped.filter((m) => m.level === level);
      return { level, items, ...tally(items) };
    });
  }, [meetings, range, from, to]);

  /* Every App/PC figure is a slice of real `meeting_schedules` or
     `meeting_conducted_status` rows — fetched on click rather than
     pre-loaded, since a slice can run to thousands of rows across a level's
     meetings. `fetcher` picks the slice; `columns` picks the row shape. */
  const openSchedule = async (fetcher, columns, label, level, items) => {
    const title = (LEVEL_LABEL[level] || level) + ' · ' + label;
    const ids = items.map((m) => m.id);
    if (!ids.length) return onCount({ title, rows: [], columns });
    try {
      const data = await fetcher(ids);
      onCount({ title, rows: data.rows, columns });
    } catch {
      onCount({ title, rows: [], columns });
    }
  };

  /* App Status mirrors PC Status's combined/subset shape: Not Conducted is
     the broad figure (a schedule row marked not held, OR no row at all —
     the same "NULL or N" reach `pcNotCompletedSchedules` has), while Not
     Updated is just the never-scheduled subset of it. There's no single
     `meeting_schedules` condition for the combined figure the way there is
     for PC's `is_conducted IS NULL OR 'N'` — a never-scheduled location has
     no row to filter — so this fetches both slices and merges them. */
  const openNotConducted = async (level, items) => {
    const title = (LEVEL_LABEL[level] || level) + ' · App Not Conducted';
    const columns = columnsFor(NOT_SCHEDULED_COLUMNS, level);
    const ids = items.map((m) => m.id);
    if (!ids.length) return onCount({ title, rows: [], columns });
    try {
      // Not-updated rows carry a real `time`; never-scheduled rows have none
      // to carry — dropped here rather than shown blank, since this list has
      // no Time column at all (a mixed conducted/never-scheduled list would
      // read oddly half-filled).
      const [notHeld, neverScheduled] = await Promise.all([
        api.notUpdatedSchedules(ids),
        api.notScheduledSchedules(ids)
      ]);
      const strip = ({ time, ...rest }) => rest;
      const rows = [...notHeld.rows.map(strip), ...neverScheduled.rows];
      onCount({ title, rows, columns });
    } catch {
      onCount({ title, rows: [], columns });
    }
  };

  // The Total column sums the three mutually-exclusive raw buckets —
  // Conducted, "has a row but not held" (`notConducted`), and "never
  // scheduled" (`notScheduled`) — every roster location this level's
  // meetings could have touched in the picked range, whichever way it went.
  // The Not Conducted *cell* below displays `notConducted + notScheduled`
  // combined, PC-Status-style, but Total adds each raw bucket once, not that
  // combined display value, so it isn't double-counting `notScheduled`.
  // The click-through fetches the same three slices and lists every one of
  // their rows together, so the count in the modal foots to the cell.
  const openTotal = async (level, items) => {
    const title = (LEVEL_LABEL[level] || level) + ' · Total';
    const columns = columnsFor(TOTAL_COLUMNS, level);
    const ids = items.map((m) => m.id);
    if (!ids.length) return onCount({ title, rows: [], columns });
    const dateById = new Map(items.map((m) => [m.id, m.date]));
    const withDate = (rows) => rows.map((r) => ({ ...r, date: dateById.get(r.meetingId) }));
    try {
      const [conducted, notHeld, neverScheduled] = await Promise.all([
        api.conductedSchedules(ids),
        api.notUpdatedSchedules(ids),
        api.notScheduledSchedules(ids)
      ]);
      const rows = [
        ...withDate(conducted.rows),
        ...withDate(notHeld.rows),
        ...withDate(neverScheduled.rows)
      ];
      onCount({ title, rows, columns });
    } catch {
      onCount({ title, rows: [], columns });
    }
  };

  return (
    <section className="level-table" aria-label="Level status">
      <div className="level-table-tools">
        {range === 'custom' && (
          <div className="range-dates">
            <label>
              <span className="sr-only">From date</span>
              <input type="date" value={from} onChange={(e) => onFrom(e.target.value)} aria-label="From date" />
            </label>
            <span className="range-sep">to</span>
            <label>
              <span className="sr-only">To date</span>
              <input type="date" value={to} onChange={(e) => onTo(e.target.value)} aria-label="To date" />
            </label>
          </div>
        )}
        <div className="seg" role="group" aria-label="Date range">
          {RANGES.map(([value, label]) => (
            <button
              key={value}
              className="btn btn-sm"
              type="button"
              aria-pressed={range === value}
              onClick={() => onRange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="level-status">
            <caption className="sr-only">Unit conduct and PC status by committee level</caption>
            <thead>
              <tr className="level-groups">
                <th scope="col">Level</th>
                <th scope="col" className="n">Total</th>
                <th scope="colgroup" colSpan={3}>App Status</th>
                <th scope="colgroup" colSpan={3}>PC Status</th>
                <th scope="col">Remarks</th>
              </tr>
              <tr className="level-subs">
                <th scope="col" />
                <th scope="col" className="n" />
                <th scope="col" className="n">Conducted</th>
                <th scope="col" className="n">Not Conducted</th>
                <th scope="col" className="n">Not Updated</th>
                <th scope="col" className="n">Conducted</th>
                <th scope="col" className="n">Not conducted</th>
                <th scope="col" className="n">Not updated</th>
                <th scope="col" className="n" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.level} className={picked === r.level ? 'is-picked' : undefined}>
                  <th scope="row">
                    <button
                      className="level-pick"
                      type="button"
                      aria-pressed={picked === r.level}
                      onClick={() => onPick(r.level)}
                    >
                      <span className={`badge ${badgeClass(r.level)}`}>{LEVEL_LABEL[r.level]}</span>
                    </button>
                  </th>
                  <Cell
                    value={r.conducted + r.notConducted + r.notScheduled}
                    onClick={() => openTotal(r.level, r.items)}
                  />
                  <Cell
                    value={r.conducted} tone="var(--ok)"
                    onClick={() => openSchedule(api.conductedSchedules, columnsFor(NOT_UPDATED_COLUMNS, r.level), 'App Conducted', r.level, r.items)}
                  />
                  <Cell
                    value={r.notConducted + r.notScheduled} tone="var(--bad)"
                    onClick={() => openNotConducted(r.level, r.items)}
                  />
                  <Cell
                    value={r.notScheduled}
                    onClick={() => openSchedule(api.notScheduledSchedules, columnsFor(NOT_SCHEDULED_COLUMNS, r.level), 'Not Updated', r.level, r.items)}
                  />
                  <Cell
                    value={r.pcCompleted} tone="var(--ok)"
                    onClick={() => openSchedule(api.pcCompletedSchedules, columnsFor(PC_NOT_UPDATED_COLUMNS, r.level), 'Conducted', r.level, r.items)}
                  />
                  <Cell
                    value={r.pcNotCompleted} tone="var(--accent)"
                    onClick={() => openSchedule(api.pcNotCompletedSchedules, columnsFor(PC_NOT_UPDATED_COLUMNS, r.level), 'Not conducted', r.level, r.items)}
                  />
                  <Cell
                    value={r.pcNotUpdated}
                    onClick={() => openSchedule(api.pcNeverUpdatedSchedules, columnsFor(NOT_SCHEDULED_COLUMNS, r.level), 'Not updated', r.level, r.items)}
                  />
                  <Cell
                    value={r.remarks}
                    onClick={() => openSchedule(api.pcRemarksSchedules, PC_REMARKS_COLUMNS, 'Remarks', r.level, r.items)}
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
