// Columns for the Not-updated schedule list rendered inside BlankTableModal —
// exactly the fields GET /api/meetings/schedules/not-updated returns.
// Parliament/Assembly are the unit's (or mandal's) own — resolved the same
// way the App & PC summary panel resolves them, wired in on the backend
// rather than looked up again here.
export const NOT_UPDATED_COLUMNS = [
  { key: 'meetingId', label: 'Meeting ID' },
  { key: 'parliament', label: 'Parliament' },
  { key: 'assembly', label: 'Assembly' },
  { key: 'location', label: 'Location' },
  { key: 'time', label: 'Time' }
];

// Columns for the Not-scheduled list — exactly the fields
// GET /api/meetings/schedules/not-scheduled returns. No Time column, unlike
// Not-updated: a location that was never scheduled has no schedule row to
// carry one.
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
  { key: 'role', label: 'Role' },
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
