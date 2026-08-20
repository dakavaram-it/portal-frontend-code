import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import AddMeetingEntryModal from '../AddMeetingEntryModal/AddMeetingEntryModal.jsx';
import Icon from '../Icon/Icon.jsx';
import { fmtDate, initials } from '../../lib/format.js';
import { prefersReduced } from '../../lib/motion.js';
import '../RemarksModal/RemarksModal.css';
import './LeaderMeetingEntriesModal.css';

function FilePreviewModal({ file, onClose }) {
  const backdropRef = useRef(null);
  const panelRef = useRef(null);
  const isPdf = Boolean(
    (file?.name && /\.pdf$/i.test(file.name)) || (file?.type || '').includes('pdf')
  );

  useLayoutEffect(() => {
    if (prefersReduced()) return;
    gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: .18 });
    gsap.from(panelRef.current, { y: 18, scale: .97, duration: .28, ease: 'power3.out' });
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="file-preview-title" tabIndex={-1} ref={panelRef}>
        <div className="modal-head">
          <div>
            <h3 id="file-preview-title">File</h3>
            <div className="who-sub">{file?.name}</div>
          </div>
          <button className="icon-btn drill-close" type="button" aria-label="Close" onClick={onClose}>
            <Icon name="x" sm />
          </button>
        </div>
        <div className="modal-body">
          <div className="upload-preview">
            {isPdf ? (
              <iframe title={file?.name || 'Attachment'} src={file?.url} />
            ) : (
              <img src={file?.url} alt={file?.name || 'Attachment'} />
            )}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function LeaderMeetingEntriesModal({
  member,
  entries = [],
  meetings = [],
  onClose,
  onChange
}) {
  const [adding, setAdding] = useState(false);
  const [preview, setPreview] = useState(null);
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

  useEffect(() => {
    if (adding || preview) return;
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
  }, [onClose, adding, preview]);

  const removeRow = (id) => {
    const row = entries.find((e) => e.id === id);
    if (row?.file?.url) URL.revokeObjectURL(row.file.url);
    onChange(entries.filter((e) => e.id !== id));
  };

  return (
    <>
      <div
        className="modal-backdrop"
        ref={backdropRef}
        onClick={(e) => { if (!adding && !preview && e.target === backdropRef.current) onClose(); }}
      >
        <div
          className="modal entries-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="entries-modal-title"
          tabIndex={-1}
          ref={panelRef}
        >
          <div className="modal-head">
            <div className="avatar" aria-hidden="true">{initials(member.name)}</div>
            <div>
              <h3 id="entries-modal-title">Update</h3>
              <div className="who-sub">{member.name + (member.mid ? ' · ' + member.mid : '')}</div>
            </div>
            <button className="icon-btn drill-close" type="button" aria-label="Close" onClick={onClose}>
              <Icon name="x" sm />
            </button>
          </div>

          <div className="modal-body">
            <div className="entries-toolbar">
              <button
                className="btn btn-sm"
                type="button"
                onClick={() => setAdding(true)}
              >
                Add
              </button>
            </div>

            <div className="table-card entries-table-card">
              <div className="table-scroll entries-scroll">
                <table>
                  <caption className="sr-only">Meeting entries for {member.name}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Meeting type</th>
                      <th scope="col">Date</th>
                      <th scope="col">Attendance status</th>
                      <th scope="col">Remarks</th>
                      <th scope="col" className="action-cell">Files</th>
                      <th scope="col" className="action-cell">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((row) => (
                      <tr key={row.id}>
                        <td>{row.meetingType}</td>
                        <td>{row.date ? fmtDate(row.date) : ''}</td>
                        <td>{row.attendance}</td>
                        <td className="entries-remarks">{row.remarks || ''}</td>
                        <td className="action-cell">
                          <button
                            className="icon-btn"
                            type="button"
                            disabled={!row.file}
                            title={row.file ? 'View file' : 'No file'}
                            aria-label="View file"
                            onClick={() => row.file && setPreview(row.file)}
                          >
                            <Icon name="eye" sm />
                          </button>
                        </td>
                        <td className="action-cell">
                          <button
                            className="icon-btn"
                            type="button"
                            title="Delete row"
                            aria-label="Delete row"
                            onClick={() => removeRow(row.id)}
                          >
                            <Icon name="trash" sm />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="empty" hidden={entries.length > 0}>
                <div className="empty-title">No entries yet</div>
                <div className="empty-hint">Use + to add a meeting entry.</div>
              </div>
            </div>
          </div>

          <div className="modal-foot">
            <button className="btn" type="button" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>

      {adding && (
        <AddMeetingEntryModal
          meetings={meetings}
          onClose={() => setAdding(false)}
          onSave={(row) => {
            onChange([...entries, row]);
            setAdding(false);
          }}
        />
      )}

      {preview && (
        <FilePreviewModal file={preview} onClose={() => setPreview(null)} />
      )}
    </>
  );
}
