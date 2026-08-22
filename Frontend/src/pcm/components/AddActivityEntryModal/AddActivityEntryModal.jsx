import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import Icon from '../Icon/Icon.jsx';
import { prefersReduced } from '../../lib/motion.js';
import '../RemarksModal/RemarksModal.css';
import '../LeaderMeetingEntriesModal/LeaderMeetingEntriesModal.css';

export default function AddActivityEntryModal({ onClose, onSave, saving, error }) {
  const [date, setDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [picked, setPicked] = useState(null);
  const [localUrl, setLocalUrl] = useState(null);
  const openerRef = useRef(document.activeElement);
  const backdropRef = useRef(null);
  const panelRef = useRef(null);

  useLayoutEffect(() => {
    if (prefersReduced()) return;
    gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: .18 });
    gsap.from(panelRef.current, { y: 18, scale: .97, duration: .28, ease: 'power3.out' });
  }, []);

  useEffect(() => {
    const opener = openerRef.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  useEffect(() => () => {
    if (localUrl) URL.revokeObjectURL(localUrl);
  }, [localUrl]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
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

  const canSave = Boolean(date);

  return (
    <div
      className="modal-backdrop"
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-activity-entry-title"
        tabIndex={-1}
        ref={panelRef}
      >
        <div className="modal-head">
          <div>
            <h3 id="add-activity-entry-title">Add entry</h3>
            <div className="who-sub">Fill in the details below</div>
          </div>
          <button className="icon-btn drill-close" type="button" aria-label="Close" onClick={onClose}>
            <Icon name="x" sm />
          </button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label htmlFor="add-activity-date">Date</label>
            <input
              id="add-activity-date"
              className="date-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onClick={(e) => {
                try { e.currentTarget.showPicker?.(); } catch { /* unsupported / already open */ }
              }}
              onFocus={(e) => {
                try { e.currentTarget.showPicker?.(); } catch { /* unsupported / already open */ }
              }}
              aria-label="Select date"
            />
          </div>

          <div className="field">
            <label htmlFor="add-activity-remarks">Remarks</label>
            <textarea
              id="add-activity-remarks"
              placeholder="Type remarks…"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Upload</label>
            <label className="upload-drop">
              <Icon name="upload" />
              <span className="upload-drop-label">{picked ? 'Replace file' : 'Choose a file to upload'}</span>
              {picked && <span className="upload-file-name">{picked.name}</span>}
              <input
                type="file"
                accept="image/*,.pdf,application/pdf"
                onChange={(e) => {
                  const next = e.target.files?.[0] || null;
                  setPicked(next);
                  setLocalUrl((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return next ? URL.createObjectURL(next) : null;
                  });
                }}
              />
            </label>
          </div>
          {error && <div className="field-error">{error}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn" type="button" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={!canSave || saving}
            onClick={() => {
              if (!date) return;
              onSave({
                date,
                remarks: remarks.trim(),
                file: picked
                  ? { name: picked.name, type: picked.type, url: URL.createObjectURL(picked) }
                  : null
              });
            }}
          >
            {saving ? 'Saving…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
