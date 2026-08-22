import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import Icon from '../Icon/Icon.jsx';
import { fmtDate, initials } from '../../lib/format.js';
import { prefersReduced } from '../../lib/motion.js';
import '../RemarksModal/RemarksModal.css';
import '../LeaderMeetingEntriesModal/LeaderMeetingEntriesModal.css';

// Grievance / Cadre / Central Party Office Grievance / PC Lunch-Dinner /
// Press Meets / Field Performance's Update modal: a leader's own dated log
// for one programme/month, off `party_track.leader_meetings`. Remarks and
// files both persist — a row's file is a separate call from creating the
// row itself (`onUploadFile`, into the same `leader_meetings_id`), since
// Add only ever collects date/remarks/file together as a convenience; the
// same Upload/View pair works standalone on any existing row too.
export default function LeaderActivityEntriesModal({
  member,
  entries,
  adding: saving,
  addError,
  uploadingFileFor,
  uploadFileError,
  onClose,
  onAdd,
  onDelete,
  onUploadFile,
  onViewFile
}) {
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [picked, setPicked] = useState(null);
  const [viewingFileId, setViewingFileId] = useState(null);
  const [viewFileError, setViewFileError] = useState(null); // { id, message }
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const openerRef = useRef(document.activeElement);
  const backdropRef = useRef(null);
  const panelRef = useRef(null);
  const fileInputRef = useRef(null);
  const uploadTargetId = useRef(null);

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
    const onKey = (e) => {
      if (e.key === 'Escape') { adding ? closeAdd() : onClose(); return; }
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
  }, [onClose, adding]);

  const removeRow = async (id) => {
    setDeletingId(id);
    setDeleteError(null);
    try {
      await onDelete(id);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const openAdd = () => {
    setDate('');
    setRemarks('');
    setPicked(null);
    setAdding(true);
  };

  const closeAdd = () => setAdding(false);

  const submitAdd = async () => {
    if (!date) return;
    const savedEntry = await onAdd(date, remarks.trim());
    if (!savedEntry) return; // onAdd surfaces the error itself; leave the form open
    // Fired, not awaited: the entry is already saved, and a failed upload
    // here should not reopen the Add form — it shows on the row itself, the
    // same as clicking Upload there directly would.
    if (picked) onUploadFile(savedEntry.id, picked);
    setAdding(false);
  };

  const triggerUpload = (id) => {
    uploadTargetId.current = id;
    fileInputRef.current?.click();
  };

  const viewFile = async (id) => {
    setViewingFileId(id);
    setViewFileError(null);
    try {
      const url = await onViewFile(id);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setViewFileError({ id, message: err.message });
    } finally {
      setViewingFileId(null);
    }
  };

  return (
    <>
      <div
        className="modal-backdrop"
        ref={backdropRef}
        onClick={(e) => { if (e.target === backdropRef.current) (adding ? closeAdd() : onClose()); }}
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
              <h3 id="activity-entries-title">{adding ? 'Add entry' : 'Update'}</h3>
              <div className="who-sub">
                {adding ? 'Fill in the details below' : member.name + (member.mid ? ' · ' + member.mid : '')}
              </div>
            </div>
            <button
              className="icon-btn drill-close"
              type="button"
              aria-label="Close"
              onClick={() => (adding ? closeAdd() : onClose())}
            >
              <Icon name="x" sm />
            </button>
          </div>

          {adding ? (
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
                    onChange={(e) => setPicked(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
              {addError && <div className="field-error">{addError}</div>}
            </div>
          ) : (
            <div className="modal-body">
              <div className="entries-toolbar">
                <button className="btn btn-sm" type="button" onClick={openAdd}>
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
                      {rows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.date ? fmtDate(row.date) : ''}</td>
                          <td className="action-cell">
                            {row.filePath && (
                              <button
                                className="icon-btn"
                                type="button"
                                title="View file"
                                aria-label="View file"
                                disabled={viewingFileId === row.id}
                                onClick={() => viewFile(row.id)}
                              >
                                <Icon name="eye" sm />
                              </button>
                            )}
                            <button
                              className="icon-btn"
                              type="button"
                              title={row.filePath ? 'Replace file' : 'Upload file'}
                              aria-label={row.filePath ? 'Replace file' : 'Upload file'}
                              disabled={uploadingFileFor === row.id}
                              onClick={() => triggerUpload(row.id)}
                            >
                              <Icon name="upload" sm />
                            </button>
                            {uploadFileError?.id === row.id && <div className="field-error">{uploadFileError.message}</div>}
                            {viewFileError?.id === row.id && <div className="field-error">{viewFileError.message}</div>}
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
                      ))}
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
          )}

          <div className="modal-foot">
            {adding ? (
              <>
                <button className="btn" type="button" onClick={closeAdd}>Cancel</button>
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={!date || saving}
                  onClick={submitAdd}
                >
                  {saving ? 'Saving…' : 'Submit'}
                </button>
              </>
            ) : (
              <button className="btn" type="button" onClick={onClose}>Close</button>
            )}
          </div>
        </div>
      </div>

      {/* One shared, hidden input for every row's Upload/Replace button —
          see `LeaderMeetingEntriesModal`'s own copy of this pattern. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file && uploadTargetId.current != null) onUploadFile(uploadTargetId.current, file);
        }}
      />
    </>
  );
}
