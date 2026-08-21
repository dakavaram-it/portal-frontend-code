import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import './Programs.css';
import AttendanceUploadModal from '../components/AttendanceUploadModal/AttendanceUploadModal.jsx';
import Dropdown from '../components/Dropdown/Dropdown.jsx';
import Icon from '../components/Icon/Icon.jsx';
import LeaderActivityEntriesModal from '../components/LeaderActivityEntriesModal/LeaderActivityEntriesModal.jsx';
import LeaderMeetingEntriesModal from '../components/LeaderMeetingEntriesModal/LeaderMeetingEntriesModal.jsx';
import LeaderRemarksModal from '../components/LeaderRemarksModal/LeaderRemarksModal.jsx';
import MemberActivityCard from '../components/MemberActivityCard/MemberActivityCard.jsx';
import Select from '../components/Select/Select.jsx';
import SortHead from '../components/SortHead/SortHead.jsx';
import { api } from '../lib/api.js';
import { num } from '../lib/format.js';
import { prefersReduced, useAnim } from '../lib/motion.js';

/* Programmes are not meetings: the service records who turned up and how many
   beneficiaries were served, and there is no invitee list to be absent from —
   so no attendance split here.

   All three cards are real, `party_track`-backed data, refetched whenever
   `month` changes: `GET .../role-summary` (role-wise member counts) and
   `.../activity-summary` (role × programme rows) for the first two,
   `.../leaders` for the third once a role/activity pairing is open. `null`
   means "still loading" (each card renders its own "Loading…"), `[]` means
   "loaded, genuinely nothing there".

   `activitySummary` rows carry `roleId`/`activityId` alongside the display
   names — `roles` (from `/api/programs/roles`, `party_track.role`) filters
   by matching id straight through. The Activity filter has no roster prop of
   its own: `party_track.activity` (`/api/programs/activities`) is a
   different, unrelated scoring system, so its options are derived from
   `activitySummary` itself, the same way the Assembly filter below derives
   its options from whatever leader list is on screen.

   Calendar Meetings gets the meeting-entries Update overlay; AC Cadre /
   Parliament Lunch-Dinner / Field Performance / Ground AC Grievance /
   Central Party Office Grievance get the simpler date/files/remarks overlay
   (`logEntriesByMid`). Remaining activities keep remarks + upload overlays. */
const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString('en-IN', { month: 'long' }));
const thisMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); };
const lastMonth = () => { const d = thisMonth(); return new Date(d.getFullYear(), d.getMonth() - 1, 1); };
const YEARS = Array.from({ length: 7 }, (_, i) => thisMonth().getFullYear() - i);

const hashInt = (str, seed) => {
  let h = seed;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
};

// Role and Activity get separate colour rotations (different hash seeds over
// the same token set) so the two columns never read as one colour system.
const CHIP_COLORS = ['var(--primary)', 'var(--violet)', 'var(--ok)', 'var(--accent)', 'var(--bad)'];
const chipColor = (str, seed) => CHIP_COLORS[hashInt(str, seed) % CHIP_COLORS.length];
const roleTint = (name) => chipColor(name, 17);
const activityTint = (name) => chipColor(name, 53);

const sum = (rows, key) => rows.reduce((a, r) => a + (r[key] || 0), 0);

// Shared by both tables on this view — `null` sortKey leaves rows in
// server order, matching SummaryTable's own sort convention.
function sortRows(rows, sortKey, sortDir, getters) {
  if (!sortKey) return rows;
  const get = getters[sortKey];
  const sorted = [...rows].sort((a, b) => {
    const av = get(a), bv = get(b);
    return av < bv ? -1 : av > bv ? 1 : 0;
  });
  return sortDir === 'desc' ? sorted.reverse() : sorted;
}
function useSort() {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const onSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };
  return { sortKey, sortDir, onSort };
}

const ROLE_SORT_KEYS = {
  role: (r) => (r.role || '').toLowerCase(),
  total: (r) => r.total || 0,
  updated: (r) => r.updated || 0,
  notUpdated: (r) => r.notUpdated || 0
};
const ACTIVITY_SORT_KEYS = {
  role: (r) => (r.role || '').toLowerCase(),
  totalMembers: (r) => r.totalMembers || 0,
  activity: (r) => (r.activity || '').toLowerCase(),
  updated: (r) => r.updated || 0,
  notUpdated: (r) => r.notUpdated || 0
};

// Service returns "—" for missing place names — treat those as blank in the UI.
const hasPlace = (v) => {
  if (v == null) return false;
  const s = String(v).trim();
  return s !== '' && s !== '-' && s !== '—';
};

// Only this programme activity gets the meeting-entries Update modal.
const isCalendarMeetingsActivity = (name) =>
  /calendar\s*meetings?/i.test(String(name || '').trim());

// Date / files / remarks Update modal — matched by normalised activity name.
const LOG_ACTIVITIES = new Set([
  'ac cadre meetings',
  'parliament lunch/dinner meetings',
  'parliament lunch dinner meetings',
  'field performance',
  'ground ac grievance',
  'central party office grievance'
]);
const normActivity = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
const isLogEntriesActivity = (name) => {
  const n = normActivity(name);
  if (LOG_ACTIVITIES.has(n)) return true;
  // tolerate "Parliament Lunch / Dinner Meetings" spacing variants
  if (/^parliament\s+lunch\s*\/?\s*dinner\s+meetings?$/.test(n)) return true;
  return false;
};

const memberCardVariant = (activity) => {
  if (isCalendarMeetingsActivity(activity)) return 'calendar';
  if (isLogEntriesActivity(activity)) return 'log';
  return 'default';
};

export default function Programs({ roles = [], meetings = [] }) {
  const ref = useRef(null);
  const memberCardRef = useRef(null);
  const skipNextFocusRef = useRef(true); // the default row on mount needs no scroll/entrance of its own
  const [monthMode, setMonthMode] = useState('this');
  const [month, setMonth] = useState(thisMonth);
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null); // a program_id, despite the name
  const [roleSummary, setRoleSummary] = useState(null); // null = loading, [] = loaded and empty
  const [activitySummary, setActivitySummary] = useState(null);
  const [openRow, setOpenRow] = useState(null); // the activitySummary row the member card is showing
  const [leaders, setLeaders] = useState(null); // null = loading, [] = loaded and empty
  const [entriesByMid, setEntriesByMid] = useState({}); // Calendar Meetings Update rows (client-only)
  const [logEntriesByMid, setLogEntriesByMid] = useState({}); // date/files/remarks Update rows
  const [remarksByMid, setRemarksByMid] = useState({}); // other activities' remarks overlay
  const [uploadsByMid, setUploadsByMid] = useState({}); // other activities' attendance uploads
  const [countsByMid, setCountsByMid] = useState({}); // manual participated/completed overrides (client-only, no save endpoint yet)
  const [selectedAc, setSelectedAc] = useState(null); // narrows the member card to one Assembly within the open role/activity
  const [updateMid, setUpdateMid] = useState(null); // entries Update modal (calendar or log)
  const [remarkMid, setRemarkMid] = useState(null);
  const [remarkMode, setRemarkMode] = useState('view');
  const [uploadMid, setUploadMid] = useState(null);
  const [uploadMode, setUploadMode] = useState('upload');
  const roleSort = useSort();
  const activitySort = useSort();

  useAnim(ref, () => {
    gsap.from('.role-summary-card, .role-select, .activity-summary-card, .member-detail-card', {
      y: 14, autoAlpha: 0, duration: .4, stagger: .06
    });
  }, [month, roleSummary, activitySummary]);

  // The two role/activity cards share one month scope, so one fetch covers
  // both — refired whenever `month` picks a new calendar month.
  useEffect(() => {
    let cancelled = false;
    setRoleSummary(null);
    setActivitySummary(null);
    const year = month.getFullYear(), mo = month.getMonth() + 1;
    Promise.all([api.programRoleSummary(year, mo), api.programActivitySummary(year, mo)])
      .then(([roleRows, activityRows]) => {
        if (cancelled) return;
        setRoleSummary(roleRows);
        setActivitySummary(activityRows);
      })
      .catch(() => {
        if (cancelled) return;
        setRoleSummary([]);
        setActivitySummary([]);
      });
    return () => { cancelled = true; };
  }, [month]);

  // Switching rows — by click or by the filters narrowing to a new default —
  // scrolls the card into view and gives it a small entrance so the change is
  // noticeable, but not on the very first render: that row is already on
  // screen next to the other two cards and needs no scroll-jack on load.
  useEffect(() => {
    if (skipNextFocusRef.current) { skipNextFocusRef.current = false; return; }
    if (!openRow) return;
    memberCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!prefersReduced()) {
      gsap.from('.member-detail-card', { y: -12, autoAlpha: 0, duration: .35, ease: 'power2.out' });
    }
  }, [openRow]);

  // The open pairing's leaders, refetched whenever the pairing or the month
  // changes — `leader_program_activity` is counted server-side, never cached.
  useEffect(() => {
    if (!openRow) { setLeaders(null); return; }
    let cancelled = false;
    setLeaders(null);
    const year = month.getFullYear(), mo = month.getMonth() + 1;
    api.programLeaders(openRow.roleId, openRow.activityId, year, mo)
      .then((rows) => { if (!cancelled) setLeaders(rows); })
      .catch(() => { if (!cancelled) setLeaders([]); });
    return () => { cancelled = true; };
  }, [openRow, month]);

  const pickThis = () => { setMonthMode('this'); setMonth(thisMonth()); };
  const pickLast = () => { setMonthMode('last'); setMonth(lastMonth()); };
  const pickCustomMonth = (mo) => { setMonthMode('custom'); setMonth((d) => new Date(d.getFullYear(), +mo, 1)); };
  const pickCustomYear = (yr) => { setMonthMode('custom'); setMonth((d) => new Date(+yr, d.getMonth(), 1)); };
  const monthTitle = month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const roleRows = roleSummary ?? [];
  const activityRows = activitySummary ?? [];
  const filteredActivitySummary = activityRows.filter((r) =>
    (!selectedRole || r.roleId === selectedRole) &&
    (!selectedActivity || r.activityId === selectedActivity)
  );
  const sortedRoleRows = useMemo(
    () => sortRows(roleRows, roleSort.sortKey, roleSort.sortDir, ROLE_SORT_KEYS),
    [roleRows, roleSort.sortKey, roleSort.sortDir]
  );
  const sortedActivitySummary = useMemo(
    () => sortRows(filteredActivitySummary, activitySort.sortKey, activitySort.sortDir, ACTIVITY_SORT_KEYS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activityRows, selectedRole, selectedActivity, activitySort.sortKey, activitySort.sortDir]
  );

  // Role filter options come from the activity card's rows when present
  // (covers the static fixture's ids); otherwise the live roles roster.
  const roleOptions = useMemo(() => {
    if (activityRows.length) {
      const seen = new Map();
      for (const r of activityRows) seen.set(r.roleId, r.role);
      return [...seen].map(([value, label]) => ({ value, label }));
    }
    return roles.map((r) => ({ value: r.id, label: r.name }));
  }, [activityRows, roles]);

  // The Activity filter's own roster — every programme actually appearing in
  // (the unfiltered) activitySummary, not `party_track.activity`.
  const activityOptions = useMemo(() => {
    const seen = new Map();
    for (const r of activityRows) seen.set(r.activityId, r.activity);
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [activityRows]);

  const openMembers = (r) => {
    setOpenRow(r);
    setSelectedAc(null); // a new role/activity pairing has its own Assembly roster
  };

  // The shown row belongs to the filtered list; once that list changes, fall
  // back to its first row rather than going blank — the card should always
  // have something to show, the same way the first two cards do.
  useEffect(() => {
    if (!openRow || !filteredActivitySummary.some((r) => r.roleId === openRow.roleId && r.activityId === openRow.activityId)) {
      const next = filteredActivitySummary[0];
      if (next) openMembers(next); else setOpenRow(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityRows, selectedRole, selectedActivity]);

  const mergedLeaders = useMemo(
    () => (leaders || []).map((m) => {
      const override = countsByMid[m.mid];
      return {
        ...m,
        remarks: remarksByMid[m.mid] || '',
        participated: override?.participated ?? m.participated,
        completed: override?.completed ?? m.completed
      };
    }),
    [leaders, remarksByMid, countsByMid]
  );
  // No save endpoint exists yet for these counts — same client-only, resets-
  // on-reload contract as remarks/uploads above.
  const setCount = (mid, field, value) => {
    const n = Math.max(0, Math.trunc(Number(value)) || 0);
    setCountsByMid((cur) => ({ ...cur, [mid]: { ...cur[mid], [field]: n } }));
  };
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

  const totals = {
    total: sum(roleRows, 'total'),
    updated: sum(roleRows, 'updated'), notUpdated: sum(roleRows, 'notUpdated')
  };
  const activityTotals = {
    totalMembers: sum(filteredActivitySummary, 'totalMembers'),
    updated: sum(filteredActivitySummary, 'updated'),
    notUpdated: sum(filteredActivitySummary, 'notUpdated')
  };
  const activityFiltered = Boolean(selectedRole || selectedActivity);

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
          <button className="btn btn-sm" type="button" aria-pressed={monthMode === 'custom'} onClick={() => setMonthMode('custom')}>Custom</button>
        </div>
      </div>

      <div className="role-summary-card table-card">
        <div className="card-head">
          <h2>Programmes by role</h2>
          <span className="sub"><Icon name="calendar" sm />{monthTitle}</span>
        </div>
        <div className="table-scroll">
          <table className="role-summary">
            <caption className="sr-only">Programmes by role for {monthTitle}</caption>
            <colgroup>
              <col className="col-role" />
              <col className="col-num" />
              <col className="col-num" />
              <col className="col-num" />
            </colgroup>
            <thead>
              <tr>
                <SortHead label="Role" sortKey="role" active={roleSort.sortKey === 'role'} dir={roleSort.sortDir} onSort={roleSort.onSort} />
                <SortHead label="Total Members" sortKey="total" active={roleSort.sortKey === 'total'} dir={roleSort.sortDir} onSort={roleSort.onSort} className="n" />
                <SortHead label="Updated" sortKey="updated" active={roleSort.sortKey === 'updated'} dir={roleSort.sortDir} onSort={roleSort.onSort} className="n" />
                <SortHead label="Not updated" sortKey="notUpdated" active={roleSort.sortKey === 'notUpdated'} dir={roleSort.sortDir} onSort={roleSort.onSort} className="n" />
              </tr>
            </thead>
            <tbody>
              {sortedRoleRows.map((r) => (
                <tr key={r.role}>
                  <td><span className="role-chip" style={{ '--tint': roleTint(r.role) }}>{r.role}</span></td>
                  <td className="n num">{num(r.total)}</td>
                  <td className="n num" style={{ color: 'var(--ok)' }}>{num(r.updated)}</td>
                  <td className="n num" style={{ color: 'var(--bad)' }}>{num(r.notUpdated)}</td>
                </tr>
              ))}
            </tbody>
            {roleRows.length > 0 && (
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td className="n num">{num(totals.total)}</td>
                  <td className="n num">{num(totals.updated)}</td>
                  <td className="n num">{num(totals.notUpdated)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div className="empty" hidden={roleSummary !== null}>
          <div className="empty-title">Loading…</div>
        </div>
        <div className="empty" hidden={roleSummary === null || roleRows.length > 0}>
          <Icon name="inbox" />
          <div className="empty-title">No programmes reported for {monthTitle}</div>
          <div className="empty-hint">No roles in the leader roster for this month.</div>
        </div>
      </div>

      <div className="filter-row">
        <div className="role-select">
          <span className="role-select-label">Role</span>
          {roleOptions.length > 0 ? (
            <Dropdown
              id="programs-role" label="Filter by role"
              value={selectedRole ?? 'all'}
              onChange={(v) => setSelectedRole(v === 'all' ? null : v)}
              options={[{ value: 'all', label: 'All roles' }, ...roleOptions]}
            />
          ) : (
            <span className="muted">No roles to select yet</span>
          )}
        </div>

        <div className="role-select">
          <span className="role-select-label">Activity</span>
          {activityOptions.length > 0 ? (
            <Dropdown
              id="programs-activity" label="Filter by activity"
              value={selectedActivity ?? 'all'}
              onChange={(v) => setSelectedActivity(v === 'all' ? null : v)}
              options={[{ value: 'all', label: 'All activities' }, ...activityOptions]}
            />
          ) : (
            <span className="muted">No activities to select yet</span>
          )}
        </div>
      </div>

      <div className="activity-summary-card table-card">
        <div className="card-head">
          <h2>Programmes by role &amp; activity</h2>
          <span className="sub"><Icon name="calendar" sm />{monthTitle}</span>
        </div>
        <div className="table-scroll">
          <table className="role-summary">
            <caption className="sr-only">Programmes by role and activity for {monthTitle}</caption>
            <colgroup>
              <col className="col-role" />
              <col className="col-members" />
              <col className="col-activity" />
              <col className="col-stat" />
              <col className="col-stat" />
            </colgroup>
            <thead>
              <tr>
                <SortHead label="Role" sortKey="role" active={activitySort.sortKey === 'role'} dir={activitySort.sortDir} onSort={activitySort.onSort} />
                <SortHead label="Total members" sortKey="totalMembers" active={activitySort.sortKey === 'totalMembers'} dir={activitySort.sortDir} onSort={activitySort.onSort} className="n" />
                <SortHead label="Activity" sortKey="activity" active={activitySort.sortKey === 'activity'} dir={activitySort.sortDir} onSort={activitySort.onSort} />
                <SortHead label="Updated" sortKey="updated" active={activitySort.sortKey === 'updated'} dir={activitySort.sortDir} onSort={activitySort.onSort} className="n" />
                <SortHead label="Not updated" sortKey="notUpdated" active={activitySort.sortKey === 'notUpdated'} dir={activitySort.sortDir} onSort={activitySort.onSort} className="n" />
              </tr>
            </thead>
            <tbody>
              {sortedActivitySummary.map((r) => (
                <tr key={r.roleId + '_' + r.activityId}>
                  <td><span className="role-chip" style={{ '--tint': roleTint(r.role) }}>{r.role}</span></td>
                  <td className="n">
                    <button className="cell-count num" type="button" onClick={() => openMembers(r)}>
                      {num(r.totalMembers)}
                    </button>
                  </td>
                  <td><span className="activity-chip" style={{ '--tint': activityTint(r.activity) }}>{r.activity}</span></td>
                  <td className="n num" style={{ color: 'var(--ok)' }}>{num(r.updated)}</td>
                  <td className="n num" style={{ color: 'var(--bad)' }}>{num(r.notUpdated)}</td>
                </tr>
              ))}
            </tbody>
            {filteredActivitySummary.length > 0 && (
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td className="n num">{num(activityTotals.totalMembers)}</td>
                  <td aria-hidden="true" />
                  <td className="n num">{num(activityTotals.updated)}</td>
                  <td className="n num">{num(activityTotals.notUpdated)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div className="empty" hidden={activitySummary !== null}>
          <div className="empty-title">Loading…</div>
        </div>
        <div className="empty" hidden={activitySummary === null || filteredActivitySummary.length > 0}>
          <Icon name="inbox" />
          {activityFiltered ? (
            <>
              <div className="empty-title">No rows match this role/activity</div>
              <div className="empty-hint">Try a different combination, or clear the filters above.</div>
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
              onChangeParticipated={(mid, v) => setCount(mid, 'participated', v)}
              onChangeCompleted={(mid, v) => setCount(mid, 'completed', v)}
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
          entries={entriesByMid[updateMid] || []}
          meetings={meetings}
          onClose={() => setUpdateMid(null)}
          onChange={(rows) => setEntriesByMid((cur) => ({ ...cur, [updateMid]: rows }))}
        />
      )}

      {logActivity && updateMember && (
        <LeaderActivityEntriesModal
          member={updateMember}
          entries={logEntriesByMid[updateMid] || []}
          onClose={() => setUpdateMid(null)}
          onChange={(rows) => setLogEntriesByMid((cur) => ({ ...cur, [updateMid]: rows }))}
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
