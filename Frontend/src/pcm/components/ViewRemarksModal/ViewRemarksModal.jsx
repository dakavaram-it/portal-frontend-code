import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import Icon from '../Icon/Icon.jsx';
import Select from '../Select/Select.jsx';
import { prefersReduced } from '../../lib/motion.js';
import '../RemarksModal/RemarksModal.css';
import './ViewRemarksModal.css';

export default function ViewRemarksModal({ meeting, row, mode = 'view', categories = [], onClose, onSave }) {
  const [category, setCategory] = useState(row.categoryId ? String(row.categoryId) : '');
  const [text, setText] = useState(row.remarks || '');
  const [saving, setSaving] = useState(false);
  const [editable, setEditable] = useState(mode === 'edit');
  const openerRef = useRef(document.activeElement);
  const backdropRef = useRef(null);
  const panelRef = useRef(null);
  const textRef = useRef(null);

  useLayoutEffect(() => {
    if (prefersReduced()) return;
    gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: .18 });
    gsap.from(panelRef.current, { y: 18, scale: .97, duration: .28, ease: 'power3.out' });
  }, []);

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
    if (editable) textRef.current.focus();
    else panelRef.current.focus();
  }, [editable]);

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

  const save = () => {
    if (saving) return;
    setSaving(true);
    Promise.resolve(onSave(row.conductedStatusId, category ? Number(category) : null, text.trim()))
      .finally(() => setSaving(false));
  };

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
        aria-labelledby="vr-title"
        tabIndex={-1}
        ref={panelRef}
      >
        <div className="modal-head">
          <div>
            <h3 id="vr-title">{mode === 'edit' ? 'Update Remarks' : 'View Remarks'}</h3>
            <div className="who-sub">{meeting.title}{row.location ? ' · ' + row.location : ''}</div>
          </div>
          <button className="icon-btn drill-close" type="button" aria-label="Close" onClick={onClose}>
            <Icon name="x" sm />
          </button>
        </div>
        <div className="modal-body">
          <div className="vr-row">
            <span className="vr-label">PC Status</span>
            <span className="vr-colon">:</span>
            <span className={'vr-status' + (row.pcConducted ? ' is-yes' : ' is-no')}>
              {row.pcConducted ? 'Conducted' : 'Not Conducted'}
            </span>
          </div>
          <div className="vr-row">
            <span className="vr-label">Category</span>
            <span className="vr-colon">:</span>
            <Select id="vr-category" label="Category" value={category} disabled={!editable} onChange={setCategory}>
              <option value=""></option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="field">
            <label htmlFor="vr-remarks">Remarks</label>
            <textarea
              id="vr-remarks"
              ref={textRef}
              readOnly={!editable}
              placeholder="Type the PC in-charge's remark for this location…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && editable) save();
              }}
            />
            {editable && <div className="field-hint">{text.trim().length} characters · Ctrl + Enter saves</div>}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" type="button" onClick={onClose}>Cancel</button>
          <button className="btn" type="button" hidden={editable} onClick={() => setEditable(true)}>
            <Icon name="pencil" sm /> Edit
          </button>
          <button className="btn btn-primary" type="button" hidden={!editable} disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save remarks'}
          </button>
        </div>
      </div>
    </div>
  );
}
