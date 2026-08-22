// Columns for App Conducted / App Not Conducted drill lists — Parliament /
// Assembly / Location resolved the same way the App & PC summary panel does.
export const NOT_UPDATED_COLUMNS = [
  { key: 'meetingId', label: 'Meeting ID' },
  { key: 'parliament', label: 'Parliament' },
  { key: 'assembly', label: 'Assembly' },
  { key: 'location', label: 'Location' }
];

// Columns for the Not-scheduled list — same place fields as above. No Time:
// a location that was never scheduled has no schedule row to carry one.
export const NOT_SCHEDULED_COLUMNS = [
  { key: 'meetingId', label: 'Meeting ID' },
  { key: 'parliament', label: 'Parliament' },
  { key: 'assembly', label: 'Assembly' },
  { key: 'location', label: 'Location' }
];

// Columns for PC Status' Conducted/Not conducted lists — the same
// Parliament/Assembly/Location fields the App Status columns above carry,
// resolved the same way on the backend, plus PC's own Role.
export const PC_NOT_UPDATED_COLUMNS = [
  { key: 'meetingId', label: 'Meeting ID' },
  { key: 'parliament', label: 'Parliament' },
  { key: 'assembly', label: 'Assembly' },
  { key: 'location', label: 'Location' },
  { key: 'role', label: 'Role' }
];

// Columns for the PC Remarks list — exactly the fields
// GET /api/meetings/schedules/pc-remarks returns.
export const PC_REMARKS_COLUMNS = [
  { key: 'meetingId', label: 'Meeting ID' },
  { key: 'role', label: 'Level' },
  { key: 'location', label: 'Location' },
  { key: 'category', label: 'Category' },
  { key: 'remarks', label: 'Remarks' }
];

// Assembly/Parliament are a location's administrative parents — showing one
// of them as a column of a level whose own rows already *are* that tier is
// empty noise: an AC-level row's own location IS the assembly, and a
// PC-level row's own location IS the parliament. Shared by LevelTable (the
// whole-level drill-downs) and LevelCard (the same drill-downs scoped to
// one meeting).
export function columnsFor(base, level) {
  if (level === 'PC') return base.filter((c) => c.key !== 'assembly' && c.key !== 'parliament');
  if (level === 'AC') return base.filter((c) => c.key !== 'assembly');
  return base;
}

// PC Status' Not-conducted Role column reports the row's own tier name
// verbatim ('Unit', 'Mandal', 'AC', 'Parliament') at every level — pure
// noise next to a title that already says the tier — so it's dropped
// everywhere. Shared by LevelTable (the whole-level cell) and LevelCard
// (the per-meeting stat).
export function pcNotConductedColumnsFor(level) {
  return columnsFor(PC_NOT_UPDATED_COLUMNS, level).filter((c) => c.key !== 'role');
}

export const DRILL_FIRST = 150;
export const DRILL_CHUNK = 500;

// Progressive drills keep calling `onCount` as pages arrive. Closing the
// modal (or opening another drill) flips this so late pages do not reopen
// the sheet the user just dismissed.
let activeDrill = null;

export function cancelActiveDrill() {
  if (activeDrill) activeDrill.cancelled = true;
  activeDrill = null;
}

/** Begin a drill fetch session; prior in-flight drills are cancelled. */
export function startDrillSession() {
  const session = { cancelled: false };
  if (activeDrill) activeDrill.cancelled = true;
  activeDrill = session;
  return session;
}

/** Open a drill modal on the first page, then append the rest in the background. */
export async function openDrillProgressive({
  onCount, title, columns, level, placeFilter = true, fetcher, meetingIds, mapRows
}) {
  const session = startDrillSession();
  const map = mapRows || ((rows) => rows);
  const publish = (payload) => {
    if (session.cancelled) return;
    onCount(payload);
  };

  publish({ title, rows: [], columns, level, placeFilter, loading: true, total: null });
  try {
    const first = await fetcher(meetingIds, { limit: DRILL_FIRST, offset: 0 });
    if (session.cancelled) return;
    let rows = map(first.rows || []);
    const total = first.total ?? rows.length;
    publish({
      title, rows, columns, level, placeFilter,
      loading: rows.length < total, total
    });
    let offset = first.rows?.length || 0;
    while (offset < total) {
      if (session.cancelled) return;
      const next = await fetcher(meetingIds, { limit: DRILL_CHUNK, offset });
      if (session.cancelled) return;
      const chunk = map(next.rows || []);
      if (!chunk.length) break;
      rows = rows.concat(chunk);
      offset += next.rows.length;
      publish({
        title, rows, columns, level, placeFilter,
        loading: offset < total, total
      });
    }
    publish({ title, rows, columns, level, placeFilter, loading: false, total });
  } catch {
    publish({ title, rows: [], columns, level, placeFilter, loading: false, total: 0 });
  }
}

