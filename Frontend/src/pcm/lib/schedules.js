// Columns for the Not-updated schedule list rendered inside BlankTableModal —
// exactly the fields GET /api/meetings/schedules/not-updated returns.
export const NOT_UPDATED_COLUMNS = [
  { key: 'meetingId', label: 'Meeting ID' },
  { key: 'location', label: 'Location' },
  { key: 'time', label: 'Time' }
];

// Columns for the Not-scheduled list — exactly the fields
// GET /api/meetings/schedules/not-scheduled returns. No Time column, unlike
// Not-updated: a location that was never scheduled has no schedule row to
// carry one.
export const NOT_SCHEDULED_COLUMNS = [
  { key: 'meetingId', label: 'Meeting ID' },
  { key: 'location', label: 'Location' }
];

// Columns for the App & PC Not-updated list — exactly the fields
// GET /api/meetings/schedules/pc-not-updated returns.
export const PC_NOT_UPDATED_COLUMNS = [
  { key: 'meetingId', label: 'Meeting ID' },
  { key: 'role', label: 'Role' },
  { key: 'location', label: 'Location' }
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
