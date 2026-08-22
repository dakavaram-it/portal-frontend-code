import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import Icon from '../Icon/Icon.jsx';
import Select from '../Select/Select.jsx';
import { initials } from '../../lib/format.js';
import { prefersReduced } from '../../lib/motion.js';
import '../RemarksModal/RemarksModal.css';
// `.field-error` and the head's `.drill-close` alignment live there, the same
// borrowing `LeaderActivityEntriesModal` does.
import '../LeaderMeetingEntriesModal/LeaderMeetingEntriesModal.css';

const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString('en-IN', { month: 'long' }));
const thisYear = new Date().getFullYear();
const YEARS = Array.from({ length: 7 }, (_, i) => thisYear - i);

/* Pedala Sevalo / Swatch Andhra / Pattadar Passbook's Update modal.

   One record for the whole month, not a dated list like
   `LeaderActivityEntriesModal`: these three are stored in
   `party_track.leader_program_activity`, which keys a row by `month_id` and
   carries no date column, so there is nowhere to file a second entry for the
   same leader, programme and month.

   `record` is `null` while the fetch is in flight, which is why the textarea
   is seeded from an effect rather than from `useState(record?.remarks)` — the
   first render happens before the saved remark has arrived. A local edit is
   not overwritten by a later load: `dirty` guards the seeding, so a slow
   response cannot swallow what the user has already typed. */
export default function LeaderMonthlyActivityModal({
  member,
  activity,
  monthTitle,
  year,
  monthIndex,
  onMonthChange,
  record,
  saving,
  saveError,
  uploadingFile,
  uploadError,
  onClose,
  onSave,
  onUploadFile,
  onViewFile
}) {
  const [text, setText] = useState('');
  const [dirty, setDirty] = useState(false);
  const [viewingFile, setViewingFile] = useState(false);
  const [viewFileError, setViewFileError] = useState('');
  const openerRef = useRef(document.activeElement);
  const backdropRef = useRef(null);
  const panelRef = useRef(null);
  const textRef = useRef(null);

  const loading = record === null;

  useEffect(() => {
    if (loading || dirty) return;
    setText(record.remarks || '');
  }, [record, loading, dirty]);

  useLayoutEffect(() => {
    if (prefersReduced()) return;
    // opacity, not autoAlpha: autoAlpha starts at visibility:hidden, which silently voids the focus below
    gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: .18 });
    gsap.from(panelRef.current, { y: 18, scale: .97, duration: .28, ease: 'power3.out' });
  }, []);

  // lock the page behind the dialog and hand focus back to whatever opened it
  useEffect(() => {
    const opener = openerRef.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  // declared after the lock effect so it wins the focus on mount
  useEffect(() => {
    if (loading) panelRef.current?.focus();
    else textRef.current?.focus();
  }, [loading]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;

      // keep Tab inside the dialog
      const stops = [...panelRef.current.querySelectorAll('button, textarea, input, select, a[href]')]
        .filter((el) => !el.hidden && !el.disabled);
      if (!stops.length) return;

      const first = stops[0];
      const last = stops[stops.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Clearing `dirty` lets the seeding effect above re-read the saved record,
  // which is what flips Status to Updated without a second fetch.
  const save = async () => {
    const ok = await onSave(text);
    if (!ok) return; // the error is already on screen; leave the dialog open
    setDirty(false);
  };

  // Switching months hands the effect above a genuinely different record —
  // clear `dirty` so its seeding isn't blocked by a leftover edit from the
  // month just left.
  const changeMonth = (nextYear, nextMonthIndex) => {
    setDirty(false);
    onMonthChange(nextYear, nextMonthIndex);
  };

  const pickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets picking the same filename again re-fire onChange
    if (file) onUploadFile(file);
  };

  // A fresh presigned link is fetched on every click rather than kept around
  // — the same reason the backend generates one per call instead of caching
  // it: a link left sitting in state would still work past whatever moment
  // it should have expired.
  const viewFile = async () => {
    setViewingFile(true);
    setViewFileError('');
    try {
      const url = await onViewFile();
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setViewFileError(err.message);
    } finally {
      setViewingFile(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      ref={backdropRef}
      onClick={(e) => { if (!saving && e.target === backdropRef.current) onClose(); }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="lma-modal-title" tabIndex={-1} ref={panelRef}>
        <div className="modal-head">
          <div className="avatar" aria-hidden="true">{initials(member.name)}</div>
          <div>
            <h3 id="lma-modal-title">{member.name}</h3>
            <div className="who-sub">{[member.parliament, member.assembly, activity].filter(Boolean).join(' · ')}</div>
          </div>
          <button className="icon-btn drill-close" type="button" aria-label="Close" onClick={onClose}>
            <Icon name="x" sm />
          </button>
        </div>

        <div className="modal-body">
          <div className="meta-grid">
            <div><div className="m-key">MID</div><div className="m-val mono">{member.mid}</div></div>
            <div>
              <div className="m-key">Month</div>
              <div className="m-val month-pick" role="group" aria-label="Select month and year">
                <Select
                  id="lma-month"
                  label="Month"
                  value={monthIndex}
                  disabled={saving || uploadingFile}
                  onChange={(v) => changeMonth(year, +v)}
                >
                  {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </Select>
                <Select
                  id="lma-year"
                  label="Year"
                  value={year}
                  disabled={saving || uploadingFile}
                  onChange={(v) => changeMonth(+v, monthIndex)}
                >
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </Select>
              </div>
            </div>
            <div>
              <div className="m-key">Status</div>
              <div className="m-val">
                {loading
                  ? '…'
                  : (record.recorded
                    ? <span className="pill pill-present"><i className="dot" />Updated</span>
                    : <span className="pill pill-absent"><i className="dot" />Not updated</span>)}
              </div>
            </div>
          </div>
          <div className="field">
            <label htmlFor="lma-remarks-text">Remarks for {monthTitle}</label>
            <textarea
              id="lma-remarks-text"
              ref={textRef}
              disabled={loading || saving}
              placeholder={loading ? 'Loading…' : 'Type this month’s update for the leader…'}
              value={text}
              onChange={(e) => { setDirty(true); setText(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !loading && !saving) save();
              }}
            />
            <div className="field-hint">{text.trim().length} characters · Ctrl + Enter saves</div>
            {saveError && <div className="field-error">{saveError}</div>}
          </div>

          <div className="field">
            <label>File for {monthTitle}</label>
            {!loading && record.filePath && (
              <button className="btn btn-sm" type="button" disabled={viewingFile} onClick={viewFile}>
                <Icon name="eye" sm /> {viewingFile ? 'Opening…' : 'View file'}
              </button>
            )}
            <label className="upload-drop">
              <Icon name="upload" />
              <span className="upload-drop-label">
                {uploadingFile ? 'Uploading…' : record?.filePath ? 'Replace file' : 'Choose a file to upload'}
              </span>
              <input
                type="file"
                accept="image/*,.pdf,application/pdf"
                disabled={loading || uploadingFile}
                onChange={pickFile}
              />
            </label>
            {uploadError && <div className="field-error">{uploadError}</div>}
            {viewFileError && <div className="field-error">{viewFileError}</div>}
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn" type="button" disabled={saving} onClick={onClose}>Close</button>
          <button className="btn btn-primary" type="button" disabled={loading || saving} onClick={save}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
