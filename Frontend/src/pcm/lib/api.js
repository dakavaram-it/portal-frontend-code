/* Client for the meetings API.

   `/pcmapi`, not `/api`: this module lives inside the portal now, whose own
   backend already answers under `/leapapi` and whose deployed host routes
   `/api` to an unrelated service. Vite proxies this prefix to the PSA gateway
   and swaps it for `/pc-meetings`, the mount the meetings backend sits behind
   there — so the paths below stay exactly the ones the service publishes. */
import { getToken, sessionExpired } from '../../leap/api.js';

const API_BASE = '/pcmapi';

/* Same bearer token the portal's own backend takes: this service verifies it
   with the same secret, reads the user id out of it and answers with only the
   assemblies that user is granted. Without it every route here is a 401 — the
   figures are the whole state's otherwise, which is exactly what the scoping
   exists to stop. */
async function request(path, options) {
  const token = getToken();
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers
    }
  });

  if (!res.ok) {
    // A 401 here is the one shared session lapsing, not this screen failing:
    // hand it to the portal's own handler so the app returns to the login
    // screen rather than showing this module's "could not reach the service".
    if (res.status === 401) sessionExpired();
    // FastAPI puts the reason in `detail`; fall back to the status so the
    // banner never reads "undefined".
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

const seg = encodeURIComponent;

export const api = {
  meetings: (from, to) => request(`/api/meetings?from=${from}&to=${to}`),
  programs: (from, to) => request(`/api/programs?from=${from}&to=${to}`),

  // Member designations a programme can be filtered by — a fixed roster, not
  // scoped to a period the way `programs` is.
  programRoles: () => request('/api/programs/roles'),

  // Activity types a programme can be filtered by — same shape as programRoles.
  programActivities: () => request('/api/programs/activities'),

  /* Programmes-by-role totals for one calendar month — Total/Members are the
     live `leader` roster (month-independent), Updated/Not updated come from
     `leader_program_activity` for that month. */
  programRoleSummary: (year, month) => request(`/api/programs/role-summary?year=${year}&month=${month}`),

  /* One row per real (role, programme) pairing `program_role` defines, same
     month scoping as roleSummary above. `activity` here is `program.program_name`. */
  programActivitySummary: (year, month) => request(`/api/programs/activity-summary?year=${year}&month=${month}`),

  /* Every active leader in one role for one programme/month — the Programmes
     page's third card. Carries no participation counts: the service's own
     `total`/`completed` columns were never written, so they are gone rather
     than reported as zero. Calendar Meetings rows alone carry `attended`, a
     real `meeting_attendance` fact. */
  programLeaders: (roleId, activityId, year, month) =>
    request(`/api/programs/leaders?role_id=${seg(roleId)}&activity_id=${seg(activityId)}&year=${year}&month=${month}`),

  /* Calendar Meetings' Update modal: one row per real meeting this leader
     was invited to in the month, off `mytdp` — not `leader_program_activity`,
     which Calendar Meetings never writes to. `leaderId` is the same `mid`
     `programLeaders` returns for a calendar-variant row. */
  programLeaderMeetings: (leaderId, year, month) =>
    request(`/api/programs/leaders/${seg(leaderId)}/meetings?year=${year}&month=${month}`),

  /* Saves one meeting's remarks for one leader, into `leader_meeting_attendance`
     — accepted whether or not the leader attended, unlike the Meetings screen's
     own remarks (`saveRemarks` below), which are absent-only. */
  saveLeaderMeetingRemarks: (leaderId, meetingId, remarks) =>
    request(`/api/programs/leaders/${seg(leaderId)}/meetings/${seg(meetingId)}/remarks`, {
      method: 'PUT',
      body: JSON.stringify({ remarks })
    }),

  /* Pedala Sevalo / Swatch Andhra / Pattadar Passbook's Update modal: this
     leader's single record for one programme and month, off
     `party_track.leader_program_activity` — the same table the two summary
     cards count Updated/Not updated from, which is why a save here moves
     those figures. One record rather than a list because that table keys a
     row by `month_id` and has no date column to file a second one under.
     `recorded` separates "nothing entered yet" from "entered, remark blank".
     The service refuses these three on the log-entry routes below, and
     refuses every other programme here, so the two never cross. */
  programLeaderMonthlyActivity: (leaderId, programId, year, month) =>
    request(
      `/api/programs/leaders/${seg(leaderId)}/monthly-activity` +
        `?program_id=${seg(programId)}&year=${year}&month=${month}`
    ),

  /* An upsert on (leader, programme, month): the row is the month, so saving
     twice corrects the record rather than adding a second one. Answers 409
     when `party_track.month` has no row for the period — a hand-seeded table
     that runs behind, so the message is meant to be shown. */
  saveLeaderMonthlyActivity: (leaderId, programId, year, month, remarks) =>
    request(`/api/programs/leaders/${seg(leaderId)}/monthly-activity`, {
      method: 'PUT',
      body: JSON.stringify({ programId, year, month, remarks })
    }),

  /* The dated-log programmes' Update modal: a leader's own hand-added
     date/remarks entries for one programme/month, off
     `party_track.leader_meetings` — not `leader_meeting_attendance` (Calendar
     Meetings only) and not `leader_program_activity` (the three above). */
  programLeaderLogEntries: (leaderId, programId, year, month) =>
    request(`/api/programs/leaders/${seg(leaderId)}/log-entries?program_id=${seg(programId)}&year=${year}&month=${month}`),

  addLeaderLogEntry: (leaderId, programId, date, remarks) =>
    request(`/api/programs/leaders/${seg(leaderId)}/log-entries`, {
      method: 'POST',
      body: JSON.stringify({ programId, date, remarks })
    }),

  deleteLeaderLogEntry: (leaderId, entryId) =>
    request(`/api/programs/leaders/${seg(leaderId)}/log-entries/${seg(entryId)}`, { method: 'DELETE' }),

  /* The first call for a meeting pulls its whole invitee list upstream — six
     figures of rows for a Unit-level meeting — so it can take minutes. Later
     calls are served from the service's own copy. */
  /* `ac` narrows the page service-side. Without it the table holds the first
     `limit` rows of the whole meeting, so a constituency deep in the list would
     otherwise be only partly reachable. */
  meeting: (meetingId) => request(`/api/meetings/${seg(meetingId)}`),

  members: (meetingId, limit = 3000, ac) =>
    request(
      `/api/meetings/${seg(meetingId)}/members?limit=${limit}` +
        (ac && ac !== 'all' ? `&ac=${seg(ac)}` : '')
    ),

  /* Attendance and capture posture per PC and AC, counted by the service over
     the whole invitee list — the table only ever holds a page of it. */
  rollup: (meetingId) => request(`/api/meetings/${seg(meetingId)}/rollup`),

  /* Row-level Assembly/Location/App/PC status behind Total Meetings —
     one row per `meeting_conducted_status`. Unit meetings page with
     `limit`/`offset` so the first rows paint before the full ~8k load. */
  scheduleSummary: (meetingId, { limit, offset } = {}) => {
    const q = new URLSearchParams();
    if (limit != null) q.set('limit', String(limit));
    if (offset != null) q.set('offset', String(offset));
    const qs = q.toString();
    return request(
      `/api/meetings/${seg(meetingId)}/schedule-summary` + (qs ? `?${qs}` : '')
    );
  },

  saveRemarks: (meetingId, mid, remarks, capturedBy) =>
    request(`/api/meetings/${seg(meetingId)}/members/${seg(mid)}/remarks`, {
      method: 'PUT',
      body: JSON.stringify({ remarks, capturedBy })
    }),

  /* Row-level detail behind the App section's figures — fetched on click
     rather than folded into the meetings list, since it can run to thousands
     of rows across a level's meetings. Every one of these is a slice of a
     figure already summed in the meetings list; the slug names the slice.
     Optional `{ limit, offset }` pages Unit-scale drills so the modal can
     paint the first chunk before the rest arrives. */
  conductedSchedules: (meetingIds, opts) => schedules('conducted', meetingIds, opts),
  notUpdatedSchedules: (meetingIds, opts) => schedules('not-updated', meetingIds, opts),
  notScheduledSchedules: (meetingIds, opts) => schedules('not-scheduled', meetingIds, opts),

  // Same shape, for the PC section: real `meeting_conducted_status` rows.
  pcCompletedSchedules: (meetingIds, opts) => schedules('pc-completed', meetingIds, opts),
  pcNotCompletedSchedules: (meetingIds, opts) => schedules('pc-not-completed', meetingIds, opts),
  pcNotUpdatedSchedules: (meetingIds, opts) => schedules('pc-not-updated', meetingIds, opts),
  // Roster locations with no `meeting_conducted_status` row at all — the
  // PC-side twin of `notScheduledSchedules`, behind PC Status' Not Updated.
  pcNeverUpdatedSchedules: (meetingIds, opts) => schedules('pc-never-updated', meetingIds, opts),

  // Every non-empty PC remark, across a level's meetings.
  pcRemarksSchedules: (meetingIds) => schedules('pc-remarks', meetingIds),

  // The roster behind ViewRemarksModal's Category selector.
  remarksCategories: () => request('/api/remarks-categories'),

  // Save (or clear) the PC in-charge's remark against one `meeting_conducted_status` row.
  saveConductedRemark: (conductedStatusId, categoryId, remarks) =>
    request(`/api/meetings/conducted-status/${seg(conductedStatusId)}/remark`, {
      method: 'PUT',
      body: JSON.stringify({ categoryId, remarks })
    })
};

function schedules(slug, meetingIds, opts = {}) {
  const q = new URLSearchParams({ meeting_ids: meetingIds.map(seg).join(',') });
  if (opts.limit != null) q.set('limit', String(opts.limit));
  if (opts.offset != null) q.set('offset', String(opts.offset));
  return request(`/api/meetings/schedules/${slug}?${q}`);
}
