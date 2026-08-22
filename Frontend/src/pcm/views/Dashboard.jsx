import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import './Dashboard.css';
import BlankTableModal from '../components/BlankTableModal/BlankTableModal.jsx';
import LevelCard from '../components/LevelCard/LevelCard.jsx';
import LevelTable, { meetingsInRange } from '../components/LevelTable/LevelTable.jsx';
import SummaryTable from '../components/SummaryTable/SummaryTable.jsx';
import ViewRemarksModal from '../components/ViewRemarksModal/ViewRemarksModal.jsx';
import { api } from '../lib/api.js';
import { useAnim } from '../lib/motion.js';
import { cancelActiveDrill } from '../lib/schedules.js';

export default function Dashboard({ meetings, remarksCategories, onToast, onSaveConductedRemark }) {
  const ref = useRef(null);
  const [range, setRange] = useState('lastMonth');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [picked, setPicked] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [summaryMeetingId, setSummaryMeetingId] = useState(null);
  const [summaryRows, setSummaryRows] = useState(null);
  const [remarkRow, setRemarkRow] = useState(null);
  const [remarkMode, setRemarkMode] = useState('view'); // which button opened the modal: 'edit' or 'view'

  // `onCount` takes a bare title for the still-unwired stub slices, or
  // { title, rows, columns } for a slice that now has real data behind it.
  const openSheet = (payload) => setSheet(typeof payload === 'string' ? { title: payload } : payload);

  const dated = useMemo(
    () => meetingsInRange(meetings, range, from, to),
    [meetings, range, from, to]
  );

  useAnim(ref, () => {
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    tl.from('.level-table', { y: 12, autoAlpha: 0, duration: .4 })
      .from('.level-card', { y: 18, autoAlpha: 0, duration: .45 }, .18);
  }, [picked, dated]);

  function pickLevel(lvl) {
    setPicked((cur) => (cur === lvl ? null : lvl));
    setSummaryMeetingId(null);
  }

  const pickedMeetings = picked ? dated.filter((m) => m.level === picked) : [];
  const summaryMeeting = summaryMeetingId ? pickedMeetings.find((m) => m.id === summaryMeetingId) : null;

  // The row in the summary table is patched in place so reopening the modal
  // shows what was just saved without a refetch of the whole panel.
  async function saveConductedRemark(conductedStatusId, categoryId, remarks) {
    try {
      const saved = await onSaveConductedRemark(summaryMeeting.id, conductedStatusId, categoryId, remarks);
      setSummaryRows((rows) => (rows || []).map((r) => (
        r.conductedStatusId === conductedStatusId ? { ...r, ...saved } : r
      )));
      setRemarkRow(null);
      onToast?.('Remarks saved');
    } catch (e) {
      onToast?.('Could not save remarks — ' + e.message);
    }
  }

  // The Assembly/Location/App/PC detail behind Total Meetings is real
  // per-location data — too much to pre-load. Unit meetings page the first
  // chunk so the table paints in ~1s, then fill the rest in the background.
  useEffect(() => {
    if (!summaryMeetingId) { setSummaryRows(null); return; }
    let cancelled = false;
    setSummaryRows(null);

    const pageSize = picked === 'Unit' ? 150 : null;

    (async () => {
      try {
        if (pageSize == null) {
          const data = await api.scheduleSummary(summaryMeetingId);
          if (!cancelled) setSummaryRows(data.rows);
          return;
        }
        const first = await api.scheduleSummary(summaryMeetingId, { limit: pageSize, offset: 0 });
        if (cancelled) return;
        setSummaryRows(first.rows);
        let offset = first.rows.length;
        const total = first.total || 0;
        while (!cancelled && offset < total) {
          const more = await api.scheduleSummary(summaryMeetingId, {
            limit: 500,
            offset
          });
          if (cancelled) return;
          setSummaryRows((prev) => [...(prev || []), ...more.rows]);
          offset += more.rows.length;
          if (!more.rows.length) break;
        }
      } catch {
        if (!cancelled) setSummaryRows([]);
      }
    })();

    return () => { cancelled = true; };
  }, [summaryMeetingId, picked]);

  return (
    <section className="view" aria-label="Meetings overview" ref={ref}>
      <div className="dashboard-table">
        <LevelTable
          meetings={meetings}
          range={range}
          from={from}
          to={to}
          onRange={setRange}
          onFrom={setFrom}
          onTo={setTo}
          picked={picked}
          onPick={pickLevel}
          onCount={openSheet}
        />
      </div>

      {picked && pickedMeetings.length > 0 && (
        <div className="level-card-grid">
          {pickedMeetings.map((meeting) => (
            <LevelCard
              key={meeting.id}
              level={picked}
              meeting={meeting}
              onCount={openSheet}
              onSummary={(id) => setSummaryMeetingId((cur) => (cur === id ? null : id))}
              expanded={summaryMeetingId === meeting.id}
            />
          ))}
        </div>
      )}

      {summaryMeeting && (
        <SummaryTable
          level={picked}
          rows={summaryRows}
          onUpdateRemarks={(row) => { setRemarkRow(row); setRemarkMode('edit'); }}
        />
      )}

      {sheet && (
        <BlankTableModal
          title={sheet.title}
          rows={sheet.rows}
          columns={sheet.columns}
          level={sheet.level}
          placeFilter={sheet.placeFilter !== false}
          loading={!!sheet.loading}
          total={sheet.total}
          onClose={() => { cancelActiveDrill(); setSheet(null); }}
        />
      )}
      {remarkRow && summaryMeeting && (
        <ViewRemarksModal
          meeting={summaryMeeting}
          row={remarkRow}
          mode={remarkMode}
          categories={remarksCategories}
          onClose={() => setRemarkRow(null)}
          onSave={saveConductedRemark}
        />
      )}
    </section>
  );
}
