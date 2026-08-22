import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import Dropdown from '../Dropdown/Dropdown.jsx';
import Icon from '../Icon/Icon.jsx';
import { api } from '../../lib/api.js';
import { fmtDate, initials } from '../../lib/format.js';
import { prefersReduced } from '../../lib/motion.js';
import '../RemarksModal/RemarksModal.css';
import './LeaderMeetingEntriesModal.css';

const toIsoDate = (d) => d.toISOString().slice(0, 10);

const PC_STATUS_UNSET = '';

// PC status is a PC user's own classification, off `party_track.attendance_type`
// (`attendanceTypes`, fetched once by the parent) — not derived the way App
// status (`attended`, real check-in data) is. `status` is the row's own
// `{id, name}` or `null` when nobody has set one yet.
function PcStatusPicker({ meetingId, status, attendanceTypes, saving, onSave }) {
  const options = [
    { value: PC_STATUS_UNSET, label: 'Not set' },
    ...attendanceTypes.map((t) => ({ value: t.id, label: t.name }))
  ];
  return (
    <Dropdown
      id={`pc-status-${meetingId}`}
      label="PC status"
      value={status?.id ?? PC_STATUS_UNSET}
      disabled={saving}
      onChange={(v) => { if (v !== PC_STATUS_UNSET) onSave(meetingId, v); }}
      options={options}
    />
  );
}

// One meeting row's remarks, edited in place — starts in edit mode when there
// is nothing recorded yet, otherwise opens read-only with an Edit button, the
// same posture LeaderRemarksModal uses for a leader's own remarks.
//
// For a Not-Attended row only (`canPickMeeting`), this also lets the leader
// pick a different real meeting to record against — a date field narrows
// which month's invite list the Meeting dropdown offers, refetched from
// `programLeaderMeetings` whenever it points at a month not already on
// screen. Attendance status is never editable here (it stays whatever
// `meeting_attendance` says for the picked meeting) — only which meeting
// the remark/file are saved against, and the remark text itself.
function MeetingRemarksEditor({
  leaderId,
  row,
  canPickMeeting,
  monthMeetings,
  savingMeetingId,
  remarksError,
  uploadingFileFor,
  uploadFileError,
  attendanceTypes,
  savingPcStatusFor,
  pcStatusError,
  onClose,
  onSave,
  onUploadFile,
  onViewFile,
  onSavePcStatus
}) {
  const [text, setText] = useState(row.remarks || '');
  const [editable, setEditable] = useState(!row.remarks);
  const [selectedId, setSelectedId] = useState(row.meetingId);
  const [dateValue, setDateValue] = useState(row.date ? row.date.slice(0, 10) : toIsoDate(new Date()));
  const [options, setOptions] = useState(monthMeetings);
  const [loadedMonth, setLoadedMonth] = useState(row.date ? row.date.slice(0, 7) : dateValue.slice(0, 7));
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [viewingFile, setViewingFile] = useState(false);
  const [viewFileError, setViewFileError] = useState('');
  const backdropRef = useRef(null);
  const panelRef = useRef(null);
  const textRef = useRef(null);

  // Once the leader can browse other months, "no selection" (an empty month)
  // is a real state — falling back to `row` here would let Save silently
  // record against the original month's meeting while the form claims none
  // exist for the one on screen.
  const selected = canPickMeeting ? options.find((m) => m.meetingId === selectedId) || null : row;
  const saving = selected != null && savingMeetingId === selected.meetingId;
  const error = selected != null && remarksError?.meetingId === selected.meetingId ? remarksError.message : '';
  const uploadingFile = selected != null && uploadingFileFor === selected.meetingId;
  const fileError = selected != null && uploadFileError?.meetingId === selected.meetingId ? uploadFileError.message : '';

  useLayoutEffect(() => {
    if (prefersReduced()) return;
    gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: .18 });
    gsap.from(panelRef.current, { y: 18, scale: .97, duration: .28, ease: 'power3.out' });
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  useEffect(() => {
    if (editable) textRef.current?.focus();
    else panelRef.current?.focus();
  }, [editable]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Refetches the Meeting dropdown's options when the date field moves to a
  // month not already loaded — the initial month came free with `row`, so
  // this only fires once the leader actually changes the date.
  useEffect(() => {
    if (!canPickMeeting || !dateValue) return;
    const month = dateValue.slice(0, 7);
    if (month === loadedMonth) return;
    const [y, m] = month.split('-').map(Number);
    let cancelled = false;
    setOptionsLoading(true);
    api.programLeaderMeetings(leaderId, y, m)
      .then((rows) => {
        if (cancelled) return;
        setOptions(rows);
        setLoadedMonth(month);
        setSelectedId(rows[0]?.meetingId ?? null);
      })
      .catch(() => { if (!cancelled) setOptions([]); })
      .finally(() => { if (!cancelled) setOptionsLoading(false); });
    return () => { cancelled = true; };
  }, [canPickMeeting, dateValue, loadedMonth, leaderId]);

  const meetingOptions = options.map((m) => ({
    value: m.meetingId,
    label: m.meetingType + (m.date ? ' · ' + fmtDate(m.date) : '')
  }));

  const viewFile = async () => {
    if (!selected) return;
    setViewingFile(true);
    setViewFileError('');
    try {
      const url = await onViewFile(selected.meetingId);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setViewFileError(err.message);
    } finally {
      setViewingFile(false);
    }
  };

  return (
    <div className="modal-backdrop" ref={backdropRef} onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="meeting-remarks-title" tabIndex={-1} ref={panelRef}>
        <div className="modal-head">
          <div>
            <h3 id="meeting-remarks-title">{canPickMeeting ? 'Update' : 'Remarks'}</h3>
            <div className="who-sub">{canPickMeeting ? (selected?.meetingType || '—') : row.meetingType}</div>
          </div>
          <button className="icon-btn drill-close" type="button" aria-label="Close" onClick={onClose}>
            <Icon name="x" sm />
          </button>
        </div>

        <div className="modal-body">
          {canPickMeeting && editable && (
            <>
              <div className="field">
                <label htmlFor="meeting-update-date">Date</label>
                <input
                  id="meeting-update-date"
                  className="date-input"
                  type="date"
                  value={dateValue}
                  onChange={(e) => setDateValue(e.target.value)}
                  onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch { /* unsupported */ } }}
                  onFocus={(e) => { try { e.currentTarget.showPicker?.(); } catch { /* unsupported */ } }}
                />
              </div>

              <div className="field">
                <label id="meeting-update-meeting-label">Meeting</label>
                {optionsLoading ? (
                  <div className="field-hint">Loading meetings for this month…</div>
                ) : meetingOptions.length ? (
                  <Dropdown
                    id="meeting-update-meeting"
                    label="Select meeting"
                    value={selectedId}
                    onChange={setSelectedId}
                    options={meetingOptions}
                  />
                ) : (
                  <div className="field-hint">No meetings invited to in this month.</div>
                )}
              </div>

              <div className="field">
                <label>App status</label>
                <div>
                  {selected == null ? <span className="muted">—</span> : selected.attended
                    ? <span className="pill pill-present"><i className="dot" />Attended</span>
                    : <span className="pill pill-absent"><i className="dot" />Not attended</span>}
                </div>
              </div>

              <div className="field">
                <label>PC status</label>
                {selected == null ? (
                  <div><span className="muted">—</span></div>
                ) : (
                  <PcStatusPicker
                    meetingId={selected.meetingId}
                    status={selected.pcStatus}
                    attendanceTypes={attendanceTypes}
                    saving={savingPcStatusFor === selected.meetingId}
                    onSave={onSavePcStatus}
                  />
                )}
                {selected != null && pcStatusError?.meetingId === selected.meetingId && (
                  <div className="field-error">{pcStatusError.message}</div>
                )}
              </div>
            </>
          )}

          {canPickMeeting && !editable && (
            <div className="field">
              <label>Meeting</label>
              <div>{row.meetingType}{row.date ? ' · ' + fmtDate(row.date) : ''}</div>
            </div>
          )}

          <div className="field">
            <label htmlFor="meeting-remarks-text">Remarks</label>
            <textarea
              id="meeting-remarks-text"
              ref={textRef}
              readOnly={!editable}
              placeholder="Type the remark for this meeting…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && editable && selected) onSave(selected.meetingId, text.trim());
              }}
            />
            {editable && <div className="field-hint">{text.trim().length} characters · Ctrl + Enter saves</div>}
          </div>

          {canPickMeeting && editable && (
            <div className="field">
              <label>File</label>
              {selected?.filePath && (
                <button className="btn btn-sm" type="button" disabled={viewingFile} onClick={viewFile}>
                  <Icon name="eye" sm /> {viewingFile ? 'Opening…' : 'View file'}
                </button>
              )}
              <label className="upload-drop">
                <Icon name="upload" />
                <span className="upload-drop-label">
                  {uploadingFile ? 'Uploading…' : selected?.filePath ? 'Replace file' : 'Choose a file to upload'}
                </span>
                <input
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  disabled={uploadingFile}
                  onChange={(e) => {
                    const next = e.target.files?.[0] || null;
                    e.target.value = '';
                    if (next && selected) onUploadFile(selected.meetingId, next);
                  }}
                />
              </label>
              {fileError && <div className="field-error">{fileError}</div>}
              {viewFileError && <div className="field-error">{viewFileError}</div>}
            </div>
          )}

          {error && <div className="field-error">{error}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn" type="button" onClick={onClose}>Cancel</button>
          <button className="btn" type="button" hidden={editable} onClick={() => setEditable(true)}>
            <Icon name="pencil" sm /> Edit
          </button>
          <button
            className="btn btn-primary"
            type="button"
            hidden={!editable}
            disabled={saving || !selected}
            onClick={() => selected && onSave(selected.meetingId, text.trim())}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// The Calendar Meetings Update modal: one row per real meeting this leader
// was invited to this month (`meetings`, from GET
// /api/programs/leaders/{id}/meetings — `null` while loading, `[]` once
// loaded and genuinely empty). A Not-Attended row's Remarks button also lets
// the leader pick a different real meeting from that month (or an earlier
// one) to record the remark/file against — see `MeetingRemarksEditor` above
// — everything else here is fill-in-place, there is nothing to Add or
// Delete outright. Remarks and files both persist into
// `leader_meeting_attendance` — see `onSaveRemarks`/`onUploadFile` below.
export default function LeaderMeetingEntriesModal({
  member,
  meetings,
  savingRemarksFor,
  remarksError,
  uploadingFileFor,
  uploadFileError,
  attendanceTypes,
  savingPcStatusFor,
  pcStatusError,
  onClose,
  onSaveRemarks,
  onUploadFile,
  onViewFile,
  onSavePcStatus
}) {
  const [remarksMeetingId, setRemarksMeetingId] = useState(null);
  const [viewingFileId, setViewingFileId] = useState(null);
  const [viewFileError, setViewFileError] = useState(null); // { meetingId, message }
  const openerRef = useRef(document.activeElement);
  const backdropRef = useRef(null);
  const panelRef = useRef(null);
  const fileInputRef = useRef(null);
  const uploadTargetId = useRef(null);

  const loading = meetings === null;
  const rows = meetings || [];
  const remarksRow = remarksMeetingId !== null ? rows.find((r) => r.meetingId === remarksMeetingId) : null;

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
    if (remarksRow) return;
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
  }, [onClose, remarksRow]);

  const triggerUpload = (meetingId) => {
    uploadTargetId.current = meetingId;
    fileInputRef.current?.click();
  };

  const viewFile = async (meetingId) => {
    setViewingFileId(meetingId);
    setViewFileError(null);
    try {
      const url = await onViewFile(meetingId);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setViewFileError({ meetingId, message: err.message });
    } finally {
      setViewingFileId(null);
    }
  };

  return (
    <>
      <div
        className="modal-backdrop"
        ref={backdropRef}
        onClick={(e) => { if (!remarksRow && e.target === backdropRef.current) onClose(); }}
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
              <h3 id="entries-modal-title">Calendar Meetings</h3>
              <div className="who-sub">{member.name + (member.mid ? ' · ' + member.mid : '')}</div>
            </div>
            <button className="icon-btn drill-close" type="button" aria-label="Close" onClick={onClose}>
              <Icon name="x" sm />
            </button>
          </div>

          <div className="modal-body">
            <div className="table-card entries-table-card">
              <div className="table-scroll entries-scroll">
                <table>
                  <caption className="sr-only">Meetings {member.name} was invited to this month</caption>
                  <thead>
                    <tr>
                      <th scope="col">Meeting type</th>
                      <th scope="col">Date</th>
                      <th scope="col">App status</th>
                      <th scope="col">PC status</th>
                      <th scope="col">Remarks</th>
                      <th scope="col" className="action-cell">Files</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.meetingId}>
                        <td>{row.meetingType}</td>
                        <td>{row.date ? fmtDate(row.date) : ''}</td>
                        <td>
                          {row.attended
                            ? <span className="pill pill-present"><i className="dot" />Attended</span>
                            : <span className="pill pill-absent"><i className="dot" />Not attended</span>}
                        </td>
                        <td>
                          <PcStatusPicker
                            meetingId={row.meetingId}
                            status={row.pcStatus}
                            attendanceTypes={attendanceTypes}
                            saving={savingPcStatusFor === row.meetingId}
                            onSave={onSavePcStatus}
                          />
                          {pcStatusError?.meetingId === row.meetingId && (
                            <div className="field-error">{pcStatusError.message}</div>
                          )}
                        </td>
                        <td className="entries-remarks">
                          <button className="cell-count" type="button" onClick={() => setRemarksMeetingId(row.meetingId)}>
                            {row.remarks || 'No remarks has been provided'}
                          </button>
                        </td>
                        <td className="action-cell">
                          {row.filePath && (
                            <button
                              className="icon-btn"
                              type="button"
                              title="View file"
                              aria-label="View file"
                              disabled={viewingFileId === row.meetingId}
                              onClick={() => viewFile(row.meetingId)}
                            >
                              <Icon name="eye" sm />
                            </button>
                          )}
                          <button
                            className="icon-btn"
                            type="button"
                            title={row.filePath ? 'Replace file' : 'Upload file'}
                            aria-label={row.filePath ? 'Replace file' : 'Upload file'}
                            disabled={uploadingFileFor === row.meetingId}
                            onClick={() => triggerUpload(row.meetingId)}
                          >
                            <Icon name="upload" sm />
                          </button>
                          {uploadFileError?.meetingId === row.meetingId && (
                            <div className="field-error">{uploadFileError.message}</div>
                          )}
                          {viewFileError?.meetingId === row.meetingId && (
                            <div className="field-error">{viewFileError.message}</div>
                          )}
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
                <div className="empty-title">No meetings this month</div>
                <div className="empty-hint">{member.name} was not invited to a Calendar Meeting in this period.</div>
              </div>
            </div>
          </div>

          <div className="modal-foot">
            <button className="btn" type="button" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>

      {/* One shared, hidden input for every row's Upload/Replace button —
          `uploadTargetId` (a ref, not state: picking a file must not
          re-render the whole table) says which meeting the next picked
          file belongs to. */}
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

      {remarksRow && (
        <MeetingRemarksEditor
          leaderId={member.mid}
          row={remarksRow}
          canPickMeeting={!remarksRow.attended}
          monthMeetings={rows}
          savingMeetingId={savingRemarksFor}
          remarksError={remarksError}
          uploadingFileFor={uploadingFileFor}
          uploadFileError={uploadFileError}
          attendanceTypes={attendanceTypes}
          savingPcStatusFor={savingPcStatusFor}
          pcStatusError={pcStatusError}
          onClose={() => setRemarksMeetingId(null)}
          onSave={(meetingId, text) => onSaveRemarks(meetingId, text)}
          onUploadFile={onUploadFile}
          onViewFile={onViewFile}
          onSavePcStatus={onSavePcStatus}
        />
      )}
    </>
  );
}
