import { useCallback, useEffect, useMemo, useState } from 'react';
// The design system (tokens, type, the primitives every view shares) then this
// module's own shell — the standalone console loaded the first from its main.jsx,
// which the portal's does not.
import './styles.css';
import './pcm.css';
import Icon from './components/Icon/Icon.jsx';
import IconSprite from './components/IconSprite/IconSprite.jsx';
import RemarksModal from './components/RemarksModal/RemarksModal.jsx';
import Toast from './components/Toast/Toast.jsx';
import Topbar from './components/Topbar/Topbar.jsx';
import CalendarView from './views/Calendar.jsx';
import Dashboard from './views/Dashboard.jsx';
import Detail from './views/Detail.jsx';
import Programs from './views/Programs.jsx';
import { api } from './lib/api.js';
import { latestDay } from './lib/calendar.js';
import { prefersReduced } from './lib/motion.js';

/* The sidebar is the portal's, so this module is handed the view it should be
   on rather than owning a nav: Leap's `pcmMeetings`/`pcmPrograms`/`pcmCalendar`
   map onto the three the standalone console had. */
export const PCM_VIEWS = {
  pcmMeetings: { name: 'dashboard', title: 'CALENDAR MEETINGS' },
  pcmPrograms: { name: 'programs', title: 'PROGRAMS' },
  pcmCalendar: { name: 'calendar', title: 'MEETING CALENDAR' }
};

/* The service counts a meeting's split in SQL over the whole invitee list. The
   client does no arithmetic of its own on it, so the two cannot disagree. */
const fromRollup = (r) => ({
  invitees: r.totals.invited,
  attendees: r.totals.attended,
  absent: r.totals.absent,
  feedbackTaken: r.totals.captured,
  feedbackPending: r.totals.pending,
  completion: r.totals.completion
});

// The services take a period; a calendar year covers every meeting they hold.
const YEAR = new Date().getFullYear();
const FROM = YEAR + '-01-01';
const TO = YEAR + '-12-31';

// matches the service's MAX_PAGE_SIZE — the most rows the table will hold
const MEMBER_PAGE = 3000;

// a meeting's own page, and an AC slice of it, are cached apart
const memberKey = (id, ac) => (ac && ac !== 'all' ? id + '|' + ac : id);

export default function PcMeetings({ view: navView }) {
  /* Leap keeps this module mounted while another screen is on top and goes on
     handing it whatever view is current, so anything outside its own three is
     ignored rather than treated as a navigation — otherwise stepping out to
     the election Dashboard and back would land on a different screen than the
     one left open. */
  const [nav, setNav] = useState(() => (PCM_VIEWS[navView] ? navView : 'pcmMeetings'));
  useEffect(() => { if (PCM_VIEWS[navView]) setNav(navView); }, [navView]);
  const view = PCM_VIEWS[nav].name;

  const [meetings, setMeetings] = useState([]);
  const [remarksCategories, setRemarksCategories] = useState([]); // roster for ViewRemarksModal's Category selector
  const [programRoles, setProgramRoles] = useState([]); // roster for the Programmes role filter
  const [members, setMembers] = useState({}); // meeting id -> rows, fetched when a meeting is opened
  const [rollups, setRollups] = useState({}); // meeting id -> PC/AC posture over that whole list
  const [acsById, setAcsById] = useState({}); // every AC in a meeting; the page in memory may not hold them all
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [meetingId, setMeetingId] = useState(null);

  // calendar
  const [calMode, setCalMode] = useState('month');
  const [calAnchor, setCalAnchor] = useState(() => new Date()); // moved to the latest meeting once loaded
  const [calLevel, setCalLevel] = useState('all');

  // member list filters, reset every time a meeting is opened
  const [memberQuery, setMemberQuery] = useState('');
  const [fb, setFb] = useState('all');
  const [att, setAtt] = useState('all');
  const [ac, setAc] = useState('all');
  const [mpc, setMpc] = useState('all'); // the member's PC, not the meeting-type filter above
  const [day, setDay] = useState('all'); // 'all' or a 0-based index into a multi-day meeting

  const [modalMid, setModalMid] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => setToast({ id: Date.now(), msg });

  const loadMeetings = useCallback(() => {
    setLoading(true);
    setError(null);
    // Programmes and the remarks-category roster come from their own
    // sources; letting either reject would blank the meetings view, which
    // loads fine without them.
    Promise.allSettled([
      api.meetings(FROM, TO), api.remarksCategories(), api.programRoles()
    ])
      .then(([meetingsRes, remarksCategoriesRes, programRolesRes]) => {
        if (meetingsRes.status === 'rejected') throw meetingsRes.reason;
        const rows = meetingsRes.value;
        setMeetings(rows);
        setRemarksCategories(remarksCategoriesRes.status === 'fulfilled' ? remarksCategoriesRes.value : []);
        setProgramRoles(programRolesRes.status === 'fulfilled' ? programRolesRes.value : []);
        if (rows.some((m) => m.date)) setCalAnchor(latestDay(rows.filter((m) => m.date)));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(loadMeetings, [loadMeetings]);

  /* A sidebar click is a view change, and an open meeting belongs to the view
     it was opened from — the standalone console cleared it in its own
     navigate(); here the nav lives a level up, so the prop is what says so. */
  useEffect(() => { setMeetingId(null); }, [nav]);

  const meeting = meetingId ? meetings.find((m) => m.id === meetingId) : null;
  /* A meeting's page is the first MAX_PAGE_SIZE rows of the whole invitee list;
     picking an AC fetches that constituency instead, so it is cached apart. */
  const meetingMembers = meetingId ? (members[memberKey(meetingId, ac)] || []) : [];

  // from the service, so the filter lists every AC in the meeting rather than
  // only the ones that happened to land in the page held in memory
  const acOptions = (meetingId && acsById[meetingId]) || [];

  const memberRows = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    return meetingMembers.filter((r) => {
      const attended = day === 'all' ? r.present : r.presentOn[day];
      if (fb === 'yes' && !r.feedback) return false;
      // only absentees can be missing feedback — attendees are never asked for it
      if (fb === 'no' && (r.present || r.feedback)) return false;
      if (att === 'present' && !attended) return false;
      if (att === 'absent' && attended) return false;
      if (ac !== 'all' && r.ac !== ac) return false;
      if (mpc !== 'all' && r.pc !== mpc) return false;
      if (q && !(r.name + ' ' + r.mid + ' ' + r.mobile + ' ' + r.designation + ' ' + r.committee).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [meetingMembers, memberQuery, fb, att, ac, mpc, day]);

  /* Every entry point into the member list — a stat tile, a rollup cell — goes
     through here, so the table can only ever show one stated slice. */
  function pickMembers(p = {}) {
    setAtt(p.att || 'all');
    setFb(p.fb || 'all');
    chooseAc(p.ac || 'all');
    setMpc(p.pc || 'all');
    setMemberQuery('');
    // the list only mounts once a slice is picked, so wait for that commit before scrolling
    requestAnimationFrame(() => document.getElementById('member-section')
      ?.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'start' }));
  }

  /* Picking a constituency re-reads that slice from the service instead of
     filtering the page already in memory — the page is the first rows of the
     whole meeting, so a deep AC would otherwise show only part of itself. */
  function chooseAc(next) {
    setAc(next);
    if (!meetingId || next === 'all') return;

    const key = memberKey(meetingId, next);
    if (members[key]) return;
    setLoading(true);
    api.members(meetingId, MEMBER_PAGE, next)
      .then((page) => setMembers((prev) => ({ ...prev, [key]: page.rows })))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  async function openDetail(id) {
    setMeetingId(id);
    setMemberQuery(''); setFb('all'); setAtt('all'); setAc('all'); setMpc('all'); setDay('all');
    window.scrollTo({ top: 0, behavior: prefersReduced() ? 'auto' : 'smooth' });

    if (members[id]) return; // already fetched this session
    setLoading(true);
    try {
      /* Both calls wait on the same one-per-meeting upstream pull, so opening a
         meeting still costs a single fetch. The page is what the table can
         render; the rollup is counted over all of it. */
      const [page, roll] = await Promise.all([api.members(id), api.rollup(id)]);
      setMembers((prev) => ({ ...prev, [id]: page.rows }));
      setAcsById((prev) => ({ ...prev, [id]: page.acs }));
      setRollups((prev) => ({ ...prev, [id]: roll }));
      setMeetings((all) => all.map((m) => (m.id === id ? { ...m, ...fromRollup(roll) } : m)));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveRemarks(text) {
    const id = meetingId;
    const mid = modalMid;
    const prev = (members[memberKey(id, ac)] || []).find((r) => r.mid === mid);
    if (!prev) return;

    try {
      // the service recomputes the meeting's counters from the member rows, so
      // both come back together and neither can drift
      const { member, meeting: updated } = await api.saveRemarks(
        id, mid, text.trim(), prev.capturedBy || 'a.dhanunjay'
      );
      // every cached slice of *this* meeting holds the row; leave other meetings
      // alone, where the same membership id is a different invitee record
      setMembers((all) => Object.fromEntries(
        Object.entries(all).map(([k, rows]) => [
          k,
          k === id || k.startsWith(id + '|')
            ? rows.map((r) => (r.mid === mid ? member : r))
            : rows
        ])
      ));
      setMeetings((all) => all.map((m) => (m.id === id ? updated : m)));
      setModalMid(null);
      showToast('Remarks saved for ' + member.name);
    } catch (e) {
      showToast('Could not save remarks — ' + e.message);
      return;
    }

    /* The constituency breakdown is counted service-side, so it has to be
       re-read. The save itself has already succeeded by here — a failure makes
       the panel stale, not the record wrong, and it says so. */
    try {
      const roll = await api.rollup(id);
      setRollups((all) => ({ ...all, [id]: roll }));
    } catch {
      showToast('Saved — reopen the meeting to refresh the constituency breakdown');
    }
  }

  /* Saved against the row's own `meeting_conducted_status_id`, then the meeting
     is re-read so `pcRemarks` — summed in SQL, never in the browser — moves
     with the save instead of going stale until the next load. */
  async function saveConductedRemark(id, conductedStatusId, categoryId, remarks) {
    const saved = await api.saveConductedRemark(conductedStatusId, categoryId, remarks);
    try {
      const updated = await api.meeting(id);
      setMeetings((all) => all.map((m) => (m.id === id ? updated : m)));
    } catch {
      // the remark itself is saved; only this meeting's PC Remarks count is stale until the next load
    }
    return saved;
  }

  const crumb = meeting ? 'Meetings / ' + meeting.id : null;
  const title = meeting ? meeting.title : PCM_VIEWS[nav].title;
  const modalMember = modalMid ? meetingMembers.find((r) => r.mid === modalMid) : null;

  return (
    <div className="pcm-root">
      <IconSprite />
      <Topbar crumb={crumb} title={title} />

      <div className="content">
        {/* Programmes reads none of the meetings state — it fetches its own
            role and activity summaries — so it renders straight away instead of
            sitting behind the meetings list, which is seconds of counting over
            half a million invitee rows. Its own roster (`roles`, the filter
            dropdown) fills in when it lands; the screen does not wait for it. */}
        {view === 'programs' ? (
          <Programs roles={programRoles} meetings={meetings} />
        ) : error ? (
          <div className="empty">
            <Icon name="inbox" />
            <div className="empty-title">Could not reach the meetings service</div>
            <div className="empty-hint">{error}</div>
            <button className="btn" type="button" onClick={loadMeetings}>Try again</button>
          </div>
        ) : loading ? (
          <div className="empty">
            <div className="empty-title">Loading…</div>
          </div>
        ) : meeting ? (
          <Detail
            meeting={meeting}
            rows={memberRows}
            allRows={meetingMembers}
            acOptions={acOptions}
            rollup={rollups[meetingId]}
            query={memberQuery}
            onQuery={setMemberQuery}
            fb={fb}
            onFb={setFb}
            att={att}
            onAtt={setAtt}
            ac={ac}
            onAc={chooseAc}
            pc={mpc}
            onPc={setMpc}
            onPick={pickMembers}
            day={day}
            onDay={setDay}
            onBack={() => setMeetingId(null)}
            onRemark={setModalMid}
          />
        ) : view === 'calendar' ? (
          <CalendarView
            meetings={meetings.filter((m) => m.date)}
            mode={calMode}
            onMode={setCalMode}
            anchor={calAnchor}
            onAnchor={setCalAnchor}
            level={calLevel}
            onLevel={setCalLevel}
            onOpen={openDetail}
          />
        ) : (
          <Dashboard
            key={view}
            meetings={meetings}
            remarksCategories={remarksCategories}
            onToast={showToast}
            onSaveConductedRemark={saveConductedRemark}
          />
        )}
      </div>

      {modalMember && (
        <RemarksModal
          key={modalMember.mid}
          member={modalMember}
          onClose={() => setModalMid(null)}
          onSave={saveRemarks}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}
