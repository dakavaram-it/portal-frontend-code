import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import AddActivityEntryModal from '../AddActivityEntryModal/AddActivityEntryModal.jsx';
import Icon from '../Icon/Icon.jsx';
import { fmtDate, initials } from '../../lib/format.js';
import { prefersReduced } from '../../lib/motion.js';
import '../RemarksModal/RemarksModal.css';
import '../LeaderMeetingEntriesModal/LeaderMeetingEntriesModal.css';

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

export default function LeaderActivityEntriesModal({
  member,
  entries,
  adding: saving,
  addError,
  onClose,
  onAdd,
  onDelete
}) {
  const [adding, setAdding] = useState(false);
  const [preview, setPreview] = useState(null);
  // Session-only, same posture as `LeaderMeetingEntriesModal`'s own file map:
  // there is no upload endpoint yet, so a picked file lives here for this
  // visit — keyed by the real row id the server just handed back — and is
  // never sent anywhere.
  const [filesById, setFilesById] = useState({});
  const openerRef = useRef(document.activeElement);
  const backdropRef = useRef(null);
  const panelRef = useRef(null);

  const loading = entries === null;
  const rows = entries || [];

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

  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const removeRow = async (id) => {
    setDeletingId(id);
    setDeleteError(null);
    try {
      await onDelete(id);
      setFilesById((cur) => {
        const { [id]: gone, ...rest } = cur;
        if (gone?.url) URL.revokeObjectURL(gone.url);
        return rest;
      });
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeletingId(null);
    }
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
          aria-labelledby="activity-entries-title"
          tabIndex={-1}
          ref={panelRef}
        >
          <div className="modal-head">
            <div className="avatar" aria-hidden="true">{initials(member.name)}</div>
            <div>
              <h3 id="activity-entries-title">Update</h3>
              <div className="who-sub">{member.name + (member.mid ? ' · ' + member.mid : '')}</div>
            </div>
            <button className="icon-btn drill-close" type="button" aria-label="Close" onClick={onClose}>
              <Icon name="x" sm />
            </button>
          </div>

          <div className="modal-body">
            <div className="entries-toolbar">
              <button className="btn btn-sm" type="button" onClick={() => setAdding(true)}>
                Add
              </button>
            </div>

            <div className="table-card entries-table-card">
              <div className="table-scroll entries-scroll">
                <table>
                  <caption className="sr-only">Entries for {member.name}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col" className="action-cell">Files</th>
                      <th scope="col">Remarks</th>
                      <th scope="col" className="action-cell">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const file = filesById[row.id];
                      return (
                        <tr key={row.id}>
                          <td>{row.date ? fmtDate(row.date) : ''}</td>
                          <td className="action-cell">
                            <button
                              className="icon-btn"
                              type="button"
                              disabled={!file}
                              title={file ? 'View file' : 'No file'}
                              aria-label="View file"
                              onClick={() => file && setPreview(file)}
                            >
                              <Icon name="eye" sm />
                            </button>
                          </td>
                          <td className="entries-remarks">{row.remarks || ''}</td>
                          <td className="action-cell">
                            <button
                              className="icon-btn"
                              type="button"
                              disabled={deletingId === row.id}
                              title="Delete row"
                              aria-label="Delete row"
                              onClick={() => removeRow(row.id)}
                            >
                              <Icon name="trash" sm />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="empty" hidden={!loading}>
                <div className="empty-title">Loading…</div>
              </div>
              <div className="empty" hidden={loading || rows.length > 0}>
                <div className="empty-title">No entries yet</div>
                <div className="empty-hint">Use Add to create an entry.</div>
              </div>
              {deleteError && <div className="field-error">{deleteError}</div>}
            </div>
          </div>

          <div className="modal-foot">
            <button className="btn" type="button" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>

      {adding && (
        <AddActivityEntryModal
          saving={saving}
          error={addError}
          onClose={() => setAdding(false)}
          onSave={async ({ date, remarks, file }) => {
            const saved = await onAdd(date, remarks);
            if (!saved) return; // onAdd surfaces the error itself; leave the form open
            if (file) setFilesById((cur) => ({ ...cur, [saved.id]: file }));
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
