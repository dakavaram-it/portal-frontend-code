import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import './Programs.css';
import AttendanceUploadModal from '../components/AttendanceUploadModal/AttendanceUploadModal.jsx';
import Dropdown from '../components/Dropdown/Dropdown.jsx';
import Icon from '../components/Icon/Icon.jsx';
import LeaderActivityEntriesModal from '../components/LeaderActivityEntriesModal/LeaderActivityEntriesModal.jsx';
import LeaderMeetingEntriesModal from '../components/LeaderMeetingEntriesModal/LeaderMeetingEntriesModal.jsx';
import LeaderMonthlyActivityModal from '../components/LeaderMonthlyActivityModal/LeaderMonthlyActivityModal.jsx';
import LeaderRemarksModal from '../components/LeaderRemarksModal/LeaderRemarksModal.jsx';
import MemberActivityCard from '../components/MemberActivityCard/MemberActivityCard.jsx';
import Select from '../components/Select/Select.jsx';
import { api } from '../lib/api.js';
import { num } from '../lib/format.js';
import { prefersReduced, useAnim } from '../lib/motion.js';

/* Programmes are not meetings: the service records who turned up and how many
   beneficiaries were served, and there is no invitee list to be absent from —
   so no attendance split here.

   The Overview table and the member card are real, `party_track`-backed
   data, refetched whenever `month` (or `monthMode`) changes: `GET
   .../activity-summary` (role × programme rows) for the Overview table,
   `.../leaders` for the member card once a role/activity pairing is open.
   `null` means "still loading" (each card renders its own "Loading…"), `[]`
   means "loaded, genuinely nothing there".

   The Overview table is `activitySummary` pivoted client-side: one row per
   programme, one repeated 3-column group (Total members / Updated / Not
   updated) per role — there is no separate role-only endpoint any more,
   since every figure the old role-summary card showed is exactly the
   per-role column totals summed across this same row set. There is no
   Role/Activity filter any more either — the table always shows every role
   and programme the month has.

   `monthMode` also carries `'overall'`: the request drops year/month
   entirely rather than the screen guessing a range, which only works once
   the backend itself learns to aggregate across months — until then it
   reads as the Overview table's own empty state. Overall has no single
   month to scope a leader drill-down to, so the Total-members cells render
   as plain numbers instead of the click-to-open button in that mode.

   `activitySummary` rows carry `roleId`/`activityId` alongside the display
   names — the Assembly filter inside the member card derives its options
   from whatever leader list is on screen, the same pattern the old Activity
   filter used to derive its own roster from `activitySummary`.

   Which Update overlay a programme opens, and which table it writes, is
   decided by its name alone — `memberCardVariant` below:

   - Calendar Meeting — the meeting-entries overlay, remarks per real meeting,
     into `leader_meeting_attendance`.
   - Pedala Sevalo / Swatch Andhra / Pattadar Passbook — one monthly record,
     into `leader_program_activity` (`MONTHLY_ACTIVITIES`).
   - Grievance / Cadre / Central Party Office Grievance / PC Lunch-Dinner /
     Press Meets / Field Performance — the date/files/remarks list, into
     `leader_meetings` (`LOG_ACTIVITIES`).

   Nothing else has a save endpoint: the remaining activities' remarks and
   uploads are still client-side state for the visit only. */
const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString('en-IN', { month: 'long' }));
const thisMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); };
const lastMonth = () => { const d = thisMonth(); return new Date(d.getFullYear(), d.getMonth() - 1, 1); };
const YEARS = Array.from({ length: 7 }, (_, i) => thisMonth().getFullYear() - i);

const hashInt = (str, seed) => {
  let h = seed;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
};

const CHIP_COLORS = ['var(--primary)', 'var(--violet)', 'var(--ok)', 'var(--accent)', 'var(--bad)'];
const chipColor = (str, seed) => CHIP_COLORS[hashInt(str, seed) % CHIP_COLORS.length];
const roleTint = (name) => chipColor(name, 17);

// Client-side stand-in for a grouping the backend doesn't do yet: these
// `party_track.role` names collapse into one "MLA/ACI/Ministers" Overview
// column instead of three. Placeholder names — swap this list (or the whole
// mechanism) out once the backend groups them itself and hands the Overview
// table one role id for the three.
const ROLE_GROUP_LABEL = 'MLA/ACI/Ministers';
const ROLE_GROUP_MEMBERS = new Set(['mla', 'aci', 'minister', 'ministers', 'mlc']);
const ROLE_GROUP_KEY = 'grp:mla-aci-ministers';
const roleGroupKey = (roleId, roleName) =>
  ROLE_GROUP_MEMBERS.has(String(roleName || '').trim().toLowerCase()) ? ROLE_GROUP_KEY : `id:${roleId}`;

// The Overview table's sort is per-cell, not per-column: "Updated" means
// nothing on its own once every role repeats that header, so a sort spec
// names which role's triple to read alongside which of the three. `null`
// getter leaves rows in server order, matching SummaryTable's own
// convention; `{ scope: 'name' }` is the one spec that isn't role-scoped.
function sortRows(rows, getter, sortDir) {
  if (!getter) return rows;
  const sorted = [...rows].sort((a, b) => {
    const av = getter(a), bv = getter(b);
    return av < bv ? -1 : av > bv ? 1 : 0;
  });
  return sortDir === 'desc' ? sorted.reverse() : sorted;
}
const sortSpecEqual = (a, b) => a.scope === b.scope && a.roleKey === b.roleKey && a.metric === b.metric;

// A cell missing for this programme/role sorts as lower than any real
// figure (including a genuine 0) rather than being coerced into one —
// same "unrated sorts last, never as zero" reasoning the wizard's cadre
// scores use.
function sortGetterFor(spec) {
  if (spec.scope === 'name') return (p) => (p.name || '').toLowerCase();
  const field = spec.metric === 'total' ? 'totalMembers' : spec.metric === 'updated' ? 'updated' : 'notUpdated';
  return (p) => {
    const cell = p.cells.get(spec.roleKey);
    return cell ? cell[field] : -1;
  };
}

// Service returns "—" for missing place names — treat those as blank in the UI.
const hasPlace = (v) => {
  if (v == null) return false;
  const s = String(v).trim();
  return s !== '' && s !== '-' && s !== '—';
};

// Only this programme activity gets the meeting-entries Update modal.
const isCalendarMeetingsActivity = (name) =>
  /calendar\s*meetings?/i.test(String(name || '').trim());

const normActivity = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');

// One monthly record Update modal, backed by
// `party_track.leader_program_activity` — the same table the two summary
// cards count Updated/Not updated from. That table keys a row by `month_id`
// and has no date column, so these three get a single record per month
// rather than the dated list below; the backend's `_MONTHLY_ACTIVITY_PROGRAMS`
// is the same set and refuses them on the log-entry routes.
const MONTHLY_ACTIVITIES = new Set([
  'pedala sevalo',
  'swatch andhra',
  'pattadar passbook'
]);
const isMonthlyActivity = (name) => MONTHLY_ACTIVITIES.has(normActivity(name));

// Date / files / remarks Update modal — matched by normalised activity name.
// The remaining non-Calendar-Meeting rows of `party_track.program` (verified
// live: id 3 Grievance Meetings, 4 Cadre Meetings, 5 Central Party Office
// Grievance, 8 PC Lunch/Dinner Meetings, 9 Press Meets, 10 Field Performance
// — id 2 Calendar Meeting is excluded by `isCalendarMeetingsActivity`, and
// ids 1/6/7 by `isMonthlyActivity` above) get this modal, backed by
// `party_track.leader_meetings` — see `_MEETING_TYPE_LABELS` in the backend's
// `programs.py` for the short label each is stored under.
const LOG_ACTIVITIES = new Set([
  'grievance meetings',
  'cadre meetings',
  'central party office grievance',
  'pc lunch/dinner meetings',
  'press meets',
  'field performance'
]);
const isLogEntriesActivity = (name) => {
  const n = normActivity(name);
  if (LOG_ACTIVITIES.has(n)) return true;
  // tolerate "PC Lunch / Dinner Meetings" spacing variants around the slash
  if (/^pc\s+lunch\s*\/?\s*dinner\s+meetings?$/.test(n)) return true;
  return false;
};

const memberCardVariant = (activity) => {
  if (isCalendarMeetingsActivity(activity)) return 'calendar';
  if (isMonthlyActivity(activity)) return 'monthly';
  if (isLogEntriesActivity(activity)) return 'log';
  return 'default';
};

export default function Programs() {
  const ref = useRef(null);
  const memberCardRef = useRef(null);
  const [monthMode, setMonthMode] = useState('this'); // 'this' | 'last' | 'overall' | 'custom'
  const [month, setMonth] = useState(thisMonth);
  const [activitySummary, setActivitySummary] = useState(null); // null = loading, [] = loaded and empty
  const [openRow, setOpenRow] = useState(null); // the activitySummary row the member card is showing
  const [leaders, setLeaders] = useState(null); // null = loading, [] = loaded and empty
  const [leaderMeetings, setLeaderMeetings] = useState(null); // Calendar Meetings Update modal rows — real, from GET .../meetings
  const [savingRemarksFor, setSavingRemarksFor] = useState(null); // meetingId currently saving, or null
  const [remarksError, setRemarksError] = useState(null); // { meetingId, message } for whichever save last failed
  const [uploadingFileFor, setUploadingFileFor] = useState(null); // meetingId currently uploading, or null
  const [uploadFileError, setUploadFileError] = useState(null); // { meetingId, message } for whichever upload last failed
  const [attendanceTypes, setAttendanceTypes] = useState([]); // PC status dropdown options, fetched once
  const [savingPcStatusFor, setSavingPcStatusFor] = useState(null); // meetingId currently saving, or null
  const [pcStatusError, setPcStatusError] = useState(null); // { meetingId, message } for whichever save last failed
  const [leaderLogEntries, setLeaderLogEntries] = useState(null); // other programmes' Update modal rows — real, from GET .../log-entries
  const [addingLogEntry, setAddingLogEntry] = useState(false);
  const [addLogEntryError, setAddLogEntryError] = useState(null);
  const [uploadingLogEntryFileFor, setUploadingLogEntryFileFor] = useState(null); // entry id currently uploading, or null
  const [logEntryFileError, setLogEntryFileError] = useState(null); // { id, message } for whichever upload last failed
  const [monthlyRecord, setMonthlyRecord] = useState(null); // the three monthly programmes' one record — from GET .../monthly-activity
  const [savingMonthly, setSavingMonthly] = useState(false);
  const [monthlyError, setMonthlyError] = useState(null);
  const [uploadingMonthlyFile, setUploadingMonthlyFile] = useState(false);
  const [monthlyFileError, setMonthlyFileError] = useState(null);
  // The monthly-activity modal's own month, seeded from the page's `month`
  // when it opens but changeable from inside the modal from there on — these
  // three programmes have no date field, only ever one record a month, so
  // reaching a month other than the one selected on the page (to backfill a
  // missed one, say) has to happen without touching the page-level filter
  // and its summary cards.
  const [monthlyModalMonth, setMonthlyModalMonth] = useState(null);
  const [remarksByMid, setRemarksByMid] = useState({}); // other activities' remarks overlay
  const [uploadsByMid, setUploadsByMid] = useState({}); // other activities' attendance uploads
  const [selectedAc, setSelectedAc] = useState(null); // narrows the member card to one Assembly within the open role/activity
  const [updateMid, setUpdateMid] = useState(null); // entries Update modal (calendar or log)
  const [remarkMid, setRemarkMid] = useState(null);
  const [remarkMode, setRemarkMode] = useState('view');
  const [uploadMid, setUploadMid] = useState(null);
  const [uploadMode, setUploadMode] = useState('upload');
  const [programQuery, setProgramQuery] = useState(''); // Overview table's own search, by programme name
  const [sortSpec, setSortSpec] = useState({ scope: 'name' }); // { scope: 'name' } | { scope: 'cell', roleKey, metric }
  const [sortDir, setSortDir] = useState('asc');
  const onSort = (spec) => {
    if (sortSpecEqual(sortSpec, spec)) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortSpec(spec); setSortDir('asc'); }
  };

  useAnim(ref, () => {
    gsap.from('.overview-card, .role-select, .member-detail-card', {
      y: 14, autoAlpha: 0, duration: .4, stagger: .06
    });
  }, [month, activitySummary]);

  // The PC status dropdown's own options — a fixed roster, fetched once
  // rather than per month the way the Overview table below is.
  useEffect(() => {
    let cancelled = false;
    api.programAttendanceTypes()
      .then((rows) => { if (!cancelled) setAttendanceTypes(rows); })
      .catch(() => { if (!cancelled) setAttendanceTypes([]); });
    return () => { cancelled = true; };
  }, []);

  // The Overview table's only data source — refired whenever `month` picks a
  // new calendar month, or `monthMode` flips to/from Overall. Overall omits
  // year/month from the request entirely rather than guessing a range —
  // the backend doesn't group across months yet, so until it does this reads
  // as "no rows" (the empty state below) rather than a wrong total.
  useEffect(() => {
    let cancelled = false;
    setActivitySummary(null);
    const args = monthMode === 'overall' ? [] : [month.getFullYear(), month.getMonth() + 1];
    api.programActivitySummary(...args)
      .then((activityRows) => { if (!cancelled) setActivitySummary(activityRows); })
      .catch(() => { if (!cancelled) setActivitySummary([]); });
    return () => { cancelled = true; };
  }, [month, monthMode]);

  // Overall has no single month to scope a leader drill-down, a Calendar
  // Meetings entry or a monthly-activity record to — close whatever was open
  // rather than leave it showing one stale month's detail under an all-time
  // summary.
  useEffect(() => {
    if (monthMode === 'overall') setOpenRow(null);
  }, [monthMode]);

  // The card only ever opens from an explicit click on a members count, so
  // every time it does, scroll it to the top of the viewport and give it a
  // small entrance so the change is noticeable.
  useEffect(() => {
    if (!openRow) return;
    memberCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!prefersReduced()) {
      gsap.from('.member-detail-card', { y: -12, autoAlpha: 0, duration: .35, ease: 'power2.out' });
    }
  }, [openRow]);

  // The open pairing's leaders, refetched whenever the pairing or the month
  // changes. The roster only — what has been recorded for one leader is
  // fetched per-leader when their Update modal opens. `openRow.roleIds` is
  // usually one id; for the merged MLA/ACI/Ministers column it's the several
  // underlying role ids, fetched in parallel and flattened into one roster —
  // the backend has no single id for the group yet.
  useEffect(() => {
    if (!openRow) { setLeaders(null); return; }
    let cancelled = false;
    setLeaders(null);
    const year = month.getFullYear(), mo = month.getMonth() + 1;
    Promise.all(openRow.roleIds.map((roleId) => api.programLeaders(roleId, openRow.activityId, year, mo)))
      .then((results) => { if (!cancelled) setLeaders(results.flat()); })
      .catch(() => { if (!cancelled) setLeaders([]); });
    return () => { cancelled = true; };
  }, [openRow, month]);

  // Calendar Meetings' Update modal: the real meetings this leader was
  // invited to, refetched whenever the modal opens for a different leader or
  // the month changes.
  useEffect(() => {
    if (updateMid === null || !isCalendarMeetingsActivity(openRow?.activity)) { setLeaderMeetings(null); return; }
    let cancelled = false;
    setLeaderMeetings(null);
    setRemarksError(null);
    setUploadFileError(null);
    const year = month.getFullYear(), mo = month.getMonth() + 1;
    api.programLeaderMeetings(updateMid, year, mo)
      .then((rows) => { if (!cancelled) setLeaderMeetings(rows); })
      .catch(() => { if (!cancelled) setLeaderMeetings([]); });
    return () => { cancelled = true; };
  }, [updateMid, openRow, month]);

  // Patches the saved remark into `leaderMeetings` in place rather than
  // refetching, so the row order and scroll position do not jump.
  const saveLeaderMeetingRemarks = async (meetingId, remarks) => {
    setSavingRemarksFor(meetingId);
    setRemarksError(null);
    try {
      await api.saveLeaderMeetingRemarks(updateMid, meetingId, remarks);
      setLeaderMeetings((cur) => (cur || []).map((r) => (r.meetingId === meetingId ? { ...r, remarks } : r)));
    } catch (err) {
      setRemarksError({ meetingId, message: err.message });
    } finally {
      setSavingRemarksFor(null);
    }
  };

  // Same in-place patch as remarks above, keyed by whichever meeting the
  // file was uploaded against — not necessarily `updateMid`'s own row, once
  // a Not-Attended row's Update form has picked a different real meeting.
  const uploadLeaderMeetingFile = async (meetingId, file) => {
    setUploadingFileFor(meetingId);
    setUploadFileError(null);
    try {
      const saved = await api.uploadLeaderMeetingFile(updateMid, meetingId, file);
      setLeaderMeetings((cur) => (cur || []).map((r) => (r.meetingId === meetingId ? { ...r, filePath: saved.filePath } : r)));
    } catch (err) {
      setUploadFileError({ meetingId, message: err.message });
    } finally {
      setUploadingFileFor(null);
    }
  };

  const viewLeaderMeetingFile = (meetingId) =>
    api.getLeaderMeetingFileUrl(updateMid, meetingId).then((r) => r.url);

  // Same in-place patch as remarks/file above — a PC user's own pick from
  // `attendanceTypes`, not derived the way `attended` is.
  const saveLeaderMeetingPcStatus = async (meetingId, attendanceTypeId) => {
    setSavingPcStatusFor(meetingId);
    setPcStatusError(null);
    try {
      await api.saveLeaderMeetingPcStatus(updateMid, meetingId, attendanceTypeId);
      const picked = attendanceTypes.find((t) => t.id === attendanceTypeId) || null;
      setLeaderMeetings((cur) => (cur || []).map((r) => (r.meetingId === meetingId ? { ...r, pcStatus: picked } : r)));
    } catch (err) {
      setPcStatusError({ meetingId, message: err.message });
    } finally {
      setSavingPcStatusFor(null);
    }
  };

  // The dated-log programmes' Update modal: the leader's own hand-added log
  // for the open programme/month, refetched whenever the modal opens for a
  // different leader, the programme changes, or the month changes — same
  // shape as the Calendar Meetings effect above, off `leader_meetings`.
  useEffect(() => {
    if (updateMid === null || !isLogEntriesActivity(openRow?.activity)) { setLeaderLogEntries(null); return; }
    let cancelled = false;
    setLeaderLogEntries(null);
    setAddLogEntryError(null);
    setLogEntryFileError(null);
    const year = month.getFullYear(), mo = month.getMonth() + 1;
    api.programLeaderLogEntries(updateMid, openRow.activityId, year, mo)
      .then((rows) => { if (!cancelled) setLeaderLogEntries(rows); })
      .catch(() => { if (!cancelled) setLeaderLogEntries([]); });
    return () => { cancelled = true; };
  }, [updateMid, openRow, month]);

  // Prepends the new row rather than refetching. Returns the saved row (with
  // its real id) on success, or `null` after recording the error — the modal
  // reads a falsy return as "stay open, the error is already showing".
  // Reloads the two summary cards too: a leader's first entry for the month
  // is what moves them from Not updated to Updated, same reasoning as
  // `saveMonthlyActivity` below.
  const addLeaderLogEntry = async (date, remarks) => {
    setAddingLogEntry(true);
    setAddLogEntryError(null);
    try {
      const saved = await api.addLeaderLogEntry(updateMid, openRow.activityId, date, remarks);
      setLeaderLogEntries((cur) => [saved, ...(cur || [])]);
      await reloadSummaries();
      return saved;
    } catch (err) {
      setAddLogEntryError(err.message);
      return null;
    } finally {
      setAddingLogEntry(false);
    }
  };

  // Deleting a leader's only entry for the month can move them back to Not
  // updated, so this reloads the summaries too.
  const deleteLeaderLogEntry = async (entryId) => {
    await api.deleteLeaderLogEntry(updateMid, entryId);
    setLeaderLogEntries((cur) => (cur || []).filter((r) => r.id !== entryId));
    await reloadSummaries();
  };

  // Same in-place patch as the meeting/monthly file uploads — the entry
  // already exists (Add or an earlier row both create it first), this only
  // ever updates its `filePath`.
  const uploadLogEntryFile = async (entryId, file) => {
    setUploadingLogEntryFileFor(entryId);
    setLogEntryFileError(null);
    try {
      const saved = await api.uploadLeaderLogEntryFile(updateMid, entryId, file);
      setLeaderLogEntries((cur) => (cur || []).map((r) => (r.id === entryId ? { ...r, filePath: saved.filePath } : r)));
    } catch (err) {
      setLogEntryFileError({ id: entryId, message: err.message });
    } finally {
      setUploadingLogEntryFileFor(null);
    }
  };

  const viewLogEntryFile = (entryId) =>
    api.getLeaderLogEntryFileUrl(updateMid, entryId).then((r) => r.url);

  // Seeds the modal's own month from the page's the moment it opens for a
  // monthly activity — not on every `month` tick, since the page filter
  // stays reachable underneath and must not yank the modal to a different
  // month while it's open.
  useEffect(() => {
    if (updateMid === null || !isMonthlyActivity(openRow?.activity)) return;
    setMonthlyModalMonth(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateMid]);

  // Pedala Sevalo / Swatch Andhra / Pattadar Passbook's Update modal: this
  // leader's one `leader_program_activity` record for the open programme and
  // whichever month is picked inside the modal. Same shape as the two
  // effects above — `null` while in flight, and a failure loads as an
  // unrecorded month rather than leaving the modal on "Loading…" forever.
  useEffect(() => {
    if (updateMid === null || !isMonthlyActivity(openRow?.activity) || !monthlyModalMonth) { setMonthlyRecord(null); return; }
    let cancelled = false;
    setMonthlyRecord(null);
    setMonthlyError(null);
    setMonthlyFileError(null);
    const year = monthlyModalMonth.getFullYear(), mo = monthlyModalMonth.getMonth() + 1;
    api.programLeaderMonthlyActivity(updateMid, openRow.activityId, year, mo)
      .then((row) => { if (!cancelled) setMonthlyRecord(row); })
      .catch((err) => {
        if (cancelled) return;
        setMonthlyRecord({ recorded: false, remarks: '' });
        setMonthlyError(err.message);
      });
    return () => { cancelled = true; };
  }, [updateMid, openRow, monthlyModalMonth]);

  // Re-reads the Overview table in place — no `setActivitySummary(null)`
  // first, unlike the month effect: its figures are only a few counts out of
  // date, and blanking it to "Loading…" behind an open modal reads as though
  // the save had cleared the screen. A failure here leaves the old figures
  // up; the save it follows has already succeeded and must not report
  // otherwise.
  const reloadSummaries = async () => {
    const args = monthMode === 'overall' ? [] : [month.getFullYear(), month.getMonth() + 1];
    try {
      setActivitySummary(await api.programActivitySummary(...args));
    } catch {
      /* keep the figures on screen */
    }
  };

  // Only the currently displayed month's summary cards are on screen, so a
  // save against some other month picked inside the modal has nothing there
  // to move.
  const reloadSummariesIfCurrentMonth = async () => {
    if (monthlyModalMonth.getFullYear() === month.getFullYear() && monthlyModalMonth.getMonth() === month.getMonth()) {
      await reloadSummaries();
    }
  };

  // Returns true only on a save that landed, which is what keeps the modal
  // open on failure. A success reloads the summary cards: this table is where
  // their Updated/Not updated figures come from, so the row just written
  // moves them, and leaving them stale would read as a lost save. Merged
  // into the existing record rather than replacing it — the save response
  // carries no `filePath`, and a plain overwrite would blank out a file
  // uploaded earlier in the same visit until the modal was reopened.
  const saveMonthlyActivity = async (remarks) => {
    setSavingMonthly(true);
    setMonthlyError(null);
    const year = monthlyModalMonth.getFullYear(), mo = monthlyModalMonth.getMonth() + 1;
    try {
      const saved = await api.saveLeaderMonthlyActivity(updateMid, openRow.activityId, year, mo, remarks);
      setMonthlyRecord((cur) => ({ ...cur, ...saved }));
      await reloadSummariesIfCurrentMonth();
      return true;
    } catch (err) {
      setMonthlyError(err.message);
      return false;
    } finally {
      setSavingMonthly(false);
    }
  };

  // Same merge reasoning as above, in reverse: the upload response carries
  // no `remarks`, so a plain overwrite would blank those out instead. A
  // success also reloads the summaries — an upload can be what first
  // creates this leader's row for the month (see
  // `_upsert_monthly_activity_row`), which is itself enough to move
  // Updated/Not updated even before any remark is saved.
  const uploadMonthlyActivityFile = async (file) => {
    setUploadingMonthlyFile(true);
    setMonthlyFileError(null);
    const year = monthlyModalMonth.getFullYear(), mo = monthlyModalMonth.getMonth() + 1;
    try {
      const saved = await api.uploadLeaderMonthlyActivityFile(updateMid, openRow.activityId, year, mo, file);
      setMonthlyRecord((cur) => ({ ...cur, ...saved }));
      await reloadSummariesIfCurrentMonth();
    } catch (err) {
      setMonthlyFileError(err.message);
    } finally {
      setUploadingMonthlyFile(false);
    }
  };

  const viewMonthlyActivityFile = () => {
    const year = monthlyModalMonth.getFullYear(), mo = monthlyModalMonth.getMonth() + 1;
    return api.getLeaderMonthlyActivityFileUrl(updateMid, openRow.activityId, year, mo).then((r) => r.url);
  };

  const pickThis = () => { setMonthMode('this'); setMonth(thisMonth()); };
  const pickLast = () => { setMonthMode('last'); setMonth(lastMonth()); };
  const pickOverall = () => setMonthMode('overall');
  const pickCustomMonth = (mo) => { setMonthMode('custom'); setMonth((d) => new Date(d.getFullYear(), +mo, 1)); };
  const pickCustomYear = (yr) => { setMonthMode('custom'); setMonth((d) => new Date(+yr, d.getMonth(), 1)); };
  const monthTitle = monthMode === 'overall' ? 'All time' : month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const monthlyModalTitle = monthlyModalMonth
    ? monthlyModalMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : '';

  const activityRows = activitySummary ?? [];

  // The Overview table's shape: every role becomes a repeated 3-column group
  // (MLA/ACI/Ministers merges its three roles into one, via `roleGroupKey`),
  // every programme becomes a row, and each row's `cells` map holds the
  // (possibly summed) figures for that programme/role pairing, keyed by
  // group key — a role with no data for a given programme renders as a dash
  // rather than a false zero.
  const pivotRoles = useMemo(() => {
    const seen = new Map();
    for (const r of activityRows) {
      const key = roleGroupKey(r.roleId, r.role);
      const entry = seen.get(key);
      if (entry) entry.roleIds.add(r.roleId);
      else seen.set(key, { key, name: key === ROLE_GROUP_KEY ? ROLE_GROUP_LABEL : r.role, roleIds: new Set([r.roleId]) });
    }
    return [...seen.values()].map((v) => ({ ...v, roleIds: [...v.roleIds] }));
  }, [activityRows]);

  const pivotPrograms = useMemo(() => {
    const byId = new Map();
    for (const r of activityRows) {
      let p = byId.get(r.activityId);
      if (!p) {
        p = { id: r.activityId, name: r.activity, cells: new Map(), total: 0, updated: 0, notUpdated: 0 };
        byId.set(r.activityId, p);
      }
      const key = roleGroupKey(r.roleId, r.role);
      let cell = p.cells.get(key);
      if (!cell) {
        cell = { roleIds: [], activityId: r.activityId, activity: r.activity, role: key === ROLE_GROUP_KEY ? ROLE_GROUP_LABEL : r.role, totalMembers: 0, updated: 0, notUpdated: 0 };
        p.cells.set(key, cell);
      }
      cell.roleIds.push(r.roleId);
      cell.totalMembers += r.totalMembers || 0;
      cell.updated += r.updated || 0;
      cell.notUpdated += r.notUpdated || 0;
      p.total += r.totalMembers || 0;
      p.updated += r.updated || 0;
      p.notUpdated += r.notUpdated || 0;
    }
    return [...byId.values()];
  }, [activityRows]);

  const searchedPrograms = useMemo(() => {
    const q = programQuery.trim().toLowerCase();
    return q ? pivotPrograms.filter((p) => (p.name || '').toLowerCase().includes(q)) : pivotPrograms;
  }, [pivotPrograms, programQuery]);

  const sortedPrograms = useMemo(
    () => sortRows(searchedPrograms, sortGetterFor(sortSpec), sortDir),
    [searchedPrograms, sortSpec, sortDir]
  );

  // Per-role column totals for the footer — replaces the old role-only
  // summary card's figures, which were exactly this same sum. Keyed by the
  // same group key as `pivotRoles`/`pivotPrograms`, so MLA/ACI/Ministers gets
  // one summed footer cell too.
  const roleTotals = useMemo(() => {
    const byRole = new Map();
    for (const r of activityRows) {
      const key = roleGroupKey(r.roleId, r.role);
      const cur = byRole.get(key) || { total: 0, updated: 0, notUpdated: 0 };
      cur.total += r.totalMembers || 0;
      cur.updated += r.updated || 0;
      cur.notUpdated += r.notUpdated || 0;
      byRole.set(key, cur);
    }
    return byRole;
  }, [activityRows]);

  const openMembers = (r) => {
    if (monthMode === 'overall') return; // no single month to scope the drill-down to
    setOpenRow(r);
    setSelectedAc(null); // a new role/activity pairing has its own Assembly roster
  };

  // The card only ever opens from an explicit click on a members count — if
  // the month changes and the open row's programme/role pairing no longer
  // has data, close it rather than silently swapping in a different one.
  // `openRow.roleIds` may hold several ids (the merged MLA/ACI/Ministers
  // cell), so any one of them still being present for this programme counts
  // as "still here".
  useEffect(() => {
    if (openRow && !activityRows.some((r) => r.activityId === openRow.activityId && openRow.roleIds.includes(r.roleId))) {
      setOpenRow(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityRows]);

  const sortIconClass = (spec) => {
    const active = sortSpecEqual(sortSpec, spec);
    return 'sort-icon' + (active ? ' is-active' : '') + (active && sortDir === 'asc' ? ' is-asc' : '');
  };

  const mergedLeaders = useMemo(
    () => (leaders || []).map((m) => ({ ...m, remarks: remarksByMid[m.mid] || '' })),
    [leaders, remarksByMid]
  );
  const acOptions = useMemo(
    () => [...new Set(mergedLeaders.map((m) => m.assembly).filter(hasPlace))],
    [mergedLeaders]
  );
  useEffect(() => {
    if (selectedAc && !acOptions.includes(selectedAc)) setSelectedAc(null);
  }, [selectedAc, acOptions]);
  const visibleMembers = selectedAc ? mergedLeaders.filter((m) => m.assembly === selectedAc) : mergedLeaders;
  const cardVariant = memberCardVariant(openRow?.activity);
  const calendarActivity = cardVariant === 'calendar';
  const monthlyActivity = cardVariant === 'monthly';
  const logActivity = cardVariant === 'log';
  const defaultActivity = cardVariant === 'default';
  const updateMember = updateMid !== null ? mergedLeaders.find((m) => m.mid === updateMid) : null;
  const remarkMember = remarkMid !== null ? mergedLeaders.find((m) => m.mid === remarkMid) : null;
  const uploadMember = uploadMid !== null ? mergedLeaders.find((m) => m.mid === uploadMid) : null;
  const saveRemark = (text) => {
    setRemarksByMid((cur) => ({ ...cur, [remarkMid]: text }));
    setRemarkMid(null);
  };
  const saveUpload = (file) => {
    setUploadsByMid((cur) => {
      const prev = cur[uploadMid];
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return { ...cur, [uploadMid]: file };
    });
    setUploadMid(null);
  };

  return (
    <section className="view" aria-label="Programmes overview" ref={ref}>
      <div className="level-table-tools">
        {monthMode === 'custom' && (
          <div className="month-pick" role="group" aria-label="Select month and year">
            <Icon name="calendar" sm className="month-pick-icon" />
            <Select id="programs-month" label="Month" value={month.getMonth()} onChange={pickCustomMonth}>
              {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </Select>
            <Select id="programs-year" label="Year" value={month.getFullYear()} onChange={pickCustomYear}>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>
        )}
        <div className="seg" role="group" aria-label="Select period">
          <button className="btn btn-sm" type="button" aria-pressed={monthMode === 'this'} onClick={pickThis}>This month</button>
          <button className="btn btn-sm" type="button" aria-pressed={monthMode === 'last'} onClick={pickLast}>Last month</button>
          <button className="btn btn-sm" type="button" aria-pressed={monthMode === 'overall'} onClick={pickOverall}>Overall</button>
          <button className="btn btn-sm" type="button" aria-pressed={monthMode === 'custom'} onClick={() => setMonthMode('custom')}>Custom</button>
        </div>
      </div>

      <div className="overview-card table-card">
        <div className="card-head">
          <h2>Programmes overview</h2>
          <div className="card-head-tools">
            <span className="sub"><Icon name="calendar" sm />{monthTitle}</span>
            <label className="search overview-search">
              <Icon name="search" sm />
              <span className="sr-only" id="programs-search-label">Search programmes</span>
              <input
                type="search"
                placeholder="Search programme…"
                aria-labelledby="programs-search-label"
                value={programQuery}
                onChange={(e) => setProgramQuery(e.target.value)}
              />
            </label>
          </div>
        </div>
        <div className="table-scroll overview-scroll">
          <table className="overview-table">
            <caption className="sr-only">Programmes by role and activity for {monthTitle}</caption>
            <thead>
              <tr>
                <th rowSpan={2} scope="col" className="col-sticky col-program">
                  <button className="sort-th" type="button" onClick={() => onSort({ scope: 'name' })}>
                    Programme
                    <Icon name="chevron-down" sm className={sortIconClass({ scope: 'name' })} />
                  </button>
                </th>
                {pivotRoles.map((role) => (
                  <th key={role.key} colSpan={3} scope="colgroup" className="role-group-head" style={{ '--tint': roleTint(role.name) }}>
                    <span className="role-chip" style={{ '--tint': roleTint(role.name) }}>{role.name}</span>
                  </th>
                ))}
              </tr>
              <tr>
                {pivotRoles.map((role) => (
                  <Fragment key={role.key}>
                    <th scope="col" className="n sub-head" style={{ '--tint': roleTint(role.name) }}>
                      <button className="sort-th" type="button" onClick={() => onSort({ scope: 'cell', roleKey: role.key, metric: 'total' })}>
                        Total members
                        <Icon name="chevron-down" sm className={sortIconClass({ scope: 'cell', roleKey: role.key, metric: 'total' })} />
                      </button>
                    </th>
                    <th scope="col" className="n sub-head" style={{ '--tint': roleTint(role.name) }}>
                      <button className="sort-th" type="button" onClick={() => onSort({ scope: 'cell', roleKey: role.key, metric: 'updated' })}>
                        Updated
                        <Icon name="chevron-down" sm className={sortIconClass({ scope: 'cell', roleKey: role.key, metric: 'updated' })} />
                      </button>
                    </th>
                    <th scope="col" className="n sub-head last-in-group" style={{ '--tint': roleTint(role.name) }}>
                      <button className="sort-th" type="button" onClick={() => onSort({ scope: 'cell', roleKey: role.key, metric: 'notUpdated' })}>
                        Not updated
                        <Icon name="chevron-down" sm className={sortIconClass({ scope: 'cell', roleKey: role.key, metric: 'notUpdated' })} />
                      </button>
                    </th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedPrograms.map((p) => (
                <tr key={p.id}>
                  <td className="col-sticky col-program">
                    <span className="program-name">{p.name}</span>
                  </td>
                  {pivotRoles.map((role) => {
                    const cell = p.cells.get(role.key);
                    return (
                      <Fragment key={role.key}>
                        <td className="n num" style={{ '--tint': roleTint(role.name) }}>
                          {!cell ? (
                            <span className="muted">—</span>
                          ) : monthMode === 'overall' ? (
                            num(cell.totalMembers)
                          ) : (
                            <button className="cell-count num" type="button" onClick={() => openMembers(cell)}>
                              {num(cell.totalMembers)}
                            </button>
                          )}
                        </td>
                        <td className="n num">
                          {cell ? <span className="stat-pill stat-pill-ok">{num(cell.updated)}</span> : <span className="muted">—</span>}
                        </td>
                        <td className="n num last-in-group" style={{ '--tint': roleTint(role.name) }}>
                          {cell ? <span className="stat-pill stat-pill-bad">{num(cell.notUpdated)}</span> : <span className="muted">—</span>}
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {sortedPrograms.length > 0 && (
              <tfoot>
                <tr>
                  <th scope="row" className="col-sticky col-program">Total</th>
                  {pivotRoles.map((role) => {
                    const t = roleTotals.get(role.key) || { total: 0, updated: 0, notUpdated: 0 };
                    return (
                      <Fragment key={role.key}>
                        <td className="n num">{num(t.total)}</td>
                        <td className="n num" style={{ color: 'var(--ok)' }}>{num(t.updated)}</td>
                        <td className="n num last-in-group" style={{ color: 'var(--bad)', '--tint': roleTint(role.name) }}>{num(t.notUpdated)}</td>
                      </Fragment>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div className="empty" hidden={activitySummary !== null}>
          <div className="empty-title">Loading…</div>
        </div>
        <div className="empty" hidden={activitySummary === null || sortedPrograms.length > 0}>
          <Icon name="inbox" />
          {programQuery.trim() ? (
            <>
              <div className="empty-title">No programme matches "{programQuery.trim()}"</div>
              <div className="empty-hint">Try a different search, or clear it.</div>
            </>
          ) : (
            <>
              <div className="empty-title">No programme is linked to a role yet</div>
              <div className="empty-hint">party_track.program_role has no rows to summarise.</div>
            </>
          )}
        </div>
      </div>

      {openRow && (
        <>
          <div className="filter-row">
            <div className="role-select">
              <span className="role-select-label">Assembly</span>
              <Dropdown
                id="programs-member-ac" label="Filter by assembly"
                value={selectedAc ?? 'all'}
                onChange={(v) => setSelectedAc(v === 'all' ? null : v)}
                options={[{ value: 'all', label: 'All assemblies' }, ...acOptions.map((a) => ({ value: a, label: a }))]}
              />
            </div>
          </div>
          <div ref={memberCardRef}>
            <MemberActivityCard
              title={openRow.role + ' · ' + openRow.activity}
              members={leaders === null ? null : visibleMembers}
              variant={cardVariant}
              uploadsByMid={uploadsByMid}
              onUpdate={setUpdateMid}
              onUpdateRemarks={(mid) => { setRemarkMid(mid); setRemarkMode('edit'); }}
              onViewRemarks={(mid) => { setRemarkMid(mid); setRemarkMode('view'); }}
              onUpload={(mid) => { setUploadMid(mid); setUploadMode('upload'); }}
              onViewAttendance={(mid) => { setUploadMid(mid); setUploadMode('view'); }}
            />
          </div>
        </>
      )}

      {calendarActivity && updateMember && (
        <LeaderMeetingEntriesModal
          member={updateMember}
          meetings={leaderMeetings}
          savingRemarksFor={savingRemarksFor}
          remarksError={remarksError}
          uploadingFileFor={uploadingFileFor}
          uploadFileError={uploadFileError}
          attendanceTypes={attendanceTypes}
          savingPcStatusFor={savingPcStatusFor}
          pcStatusError={pcStatusError}
          onClose={() => setUpdateMid(null)}
          onSaveRemarks={saveLeaderMeetingRemarks}
          onUploadFile={uploadLeaderMeetingFile}
          onViewFile={viewLeaderMeetingFile}
          onSavePcStatus={saveLeaderMeetingPcStatus}
        />
      )}

      {monthlyActivity && updateMember && monthlyModalMonth && (
        <LeaderMonthlyActivityModal
          member={updateMember}
          activity={openRow?.activity}
          monthTitle={monthlyModalTitle}
          year={monthlyModalMonth.getFullYear()}
          monthIndex={monthlyModalMonth.getMonth()}
          onMonthChange={(y, mo) => setMonthlyModalMonth(new Date(y, mo, 1))}
          record={monthlyRecord}
          saving={savingMonthly}
          saveError={monthlyError}
          uploadingFile={uploadingMonthlyFile}
          uploadError={monthlyFileError}
          onClose={() => setUpdateMid(null)}
          onSave={saveMonthlyActivity}
          onUploadFile={uploadMonthlyActivityFile}
          onViewFile={viewMonthlyActivityFile}
        />
      )}

      {logActivity && updateMember && (
        <LeaderActivityEntriesModal
          member={updateMember}
          entries={leaderLogEntries}
          adding={addingLogEntry}
          addError={addLogEntryError}
          uploadingFileFor={uploadingLogEntryFileFor}
          uploadFileError={logEntryFileError}
          onClose={() => setUpdateMid(null)}
          onAdd={addLeaderLogEntry}
          onDelete={deleteLeaderLogEntry}
          onUploadFile={uploadLogEntryFile}
          onViewFile={viewLogEntryFile}
        />
      )}

      {defaultActivity && remarkMember && (
        <LeaderRemarksModal
          member={{ ...remarkMember, activity: openRow?.activity || remarkMember.activity }}
          mode={remarkMode}
          onClose={() => setRemarkMid(null)}
          onSave={saveRemark}
        />
      )}

      {defaultActivity && uploadMember && (uploadMode === 'upload' || uploadsByMid[uploadMid]) && (
        <AttendanceUploadModal
          member={uploadMember}
          mode={uploadMode}
          file={uploadsByMid[uploadMid]}
          onClose={() => setUploadMid(null)}
          onSave={saveUpload}
        />
      )}
    </section>
  );
}
