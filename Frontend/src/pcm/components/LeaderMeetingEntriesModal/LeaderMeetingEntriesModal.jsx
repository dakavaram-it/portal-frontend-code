import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import AttendanceUploadModal from '../AttendanceUploadModal/AttendanceUploadModal.jsx';
import Dropdown from '../Dropdown/Dropdown.jsx';
import Icon from '../Icon/Icon.jsx';
import { api } from '../../lib/api.js';
import { fmtDate, initials } from '../../lib/format.js';
import { prefersReduced } from '../../lib/motion.js';
import '../RemarksModal/RemarksModal.css';
import './LeaderMeetingEntriesModal.css';

const toIsoDate = (d) => d.toISOString().slice(0, 10);

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
  filesByMeetingId,
  onClose,
  onSave,
  onPickFile
}) {
  const [text, setText] = useState(row.remarks || '');
  const [editable, setEditable] = useState(!row.remarks);
  const [selectedId, setSelectedId] = useState(row.meetingId);
  const [dateValue, setDateValue] = useState(row.date ? row.date.slice(0, 10) : toIsoDate(new Date()));
  const [options, setOptions] = useState(monthMeetings);
  const [loadedMonth, setLoadedMonth] = useState(row.date ? row.date.slice(0, 7) : dateValue.slice(0, 7));
  const [optionsLoading, setOptionsLoading] = useState(false);
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
  const file = selected != null ? filesByMeetingId[selected.meetingId] : null;

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
                <label>Attendance status</label>
                <div>
                  {selected == null ? <span className="muted">—</span> : selected.attended
                    ? <span className="pill pill-present"><i className="dot" />Attended</span>
                    : <span className="pill pill-absent"><i className="dot" />Not attended</span>}
                </div>
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
              <label>Upload</label>
              <label className="upload-drop">
                <Icon name="upload" />
                <span className="upload-drop-label">{file ? 'Replace file' : 'Choose a file to upload'}</span>
                {file && <span className="upload-file-name">{file.name}</span>}
                <input
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  onChange={(e) => {
                    const next = e.target.files?.[0] || null;
                    if (!next || !selected) return;
                    onPickFile(selected.meetingId, { name: next.name, type: next.type, url: URL.createObjectURL(next) });
                  }}
                />
              </label>
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
// Delete outright.
export default function LeaderMeetingEntriesModal({
  member,
  meetings,
  savingRemarksFor,
  remarksError,
  onClose,
  onSaveRemarks
}) {
  const [remarksMeetingId, setRemarksMeetingId] = useState(null);
  const [uploadMeetingId, setUploadMeetingId] = useState(null);
  const [uploadMode, setUploadMode] = useState('upload');
  // Session-only: there is no upload endpoint yet, so a picked file lives
  // here for this visit and is never sent anywhere — same posture the
  // default variant's own AttendanceUploadModal already has.
  const [filesByMeetingId, setFilesByMeetingId] = useState({});
  const openerRef = useRef(document.activeElement);
  const backdropRef = useRef(null);
  const panelRef = useRef(null);

  const loading = meetings === null;
  const rows = meetings || [];
  const remarksRow = remarksMeetingId !== null ? rows.find((r) => r.meetingId === remarksMeetingId) : null;
  const uploadRow = uploadMeetingId !== null ? rows.find((r) => r.meetingId === uploadMeetingId) : null;

  const stageFile = (meetingId, file) => {
    setFilesByMeetingId((cur) => {
      const prev = cur[meetingId];
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return { ...cur, [meetingId]: file };
    });
  };

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
    if (remarksRow || uploadRow) return;
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
  }, [onClose, remarksRow, uploadRow]);

  return (
    <>
      <div
        className="modal-backdrop"
        ref={backdropRef}
        onClick={(e) => { if (!remarksRow && !uploadRow && e.target === backdropRef.current) onClose(); }}
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
                      <th scope="col">Attendance status</th>
                      <th scope="col">Remarks</th>
                      <th scope="col" className="action-cell">Files</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const file = filesByMeetingId[row.meetingId];
                      const hasFile = Boolean(file || row.filePath);
                      return (
                        <tr key={row.meetingId}>
                          <td>{row.meetingType}</td>
                          <td>{row.date ? fmtDate(row.date) : ''}</td>
                          <td>
                            {row.attended
                              ? <span className="pill pill-present"><i className="dot" />Attended</span>
                              : <span className="pill pill-absent"><i className="dot" />Not attended</span>}
                          </td>
                          <td className="entries-remarks">
                            <button className="cell-count" type="button" onClick={() => setRemarksMeetingId(row.meetingId)}>
                              {row.remarks || 'No remarks has been provided'}
                            </button>
                          </td>
                          <td className="action-cell">
                            {hasFile ? (
                              <button
                                className="icon-btn"
                                type="button"
                                title="View file"
                                aria-label="View file"
                                onClick={() => { setUploadMode('view'); setUploadMeetingId(row.meetingId); }}
                              >
                                <Icon name="eye" sm />
                              </button>
                            ) : (
                              <button className="cell-count" type="button" onClick={() => { setUploadMode('upload'); setUploadMeetingId(row.meetingId); }}>
                                Files has not been updated
                              </button>
                            )}
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

      {remarksRow && (
        <MeetingRemarksEditor
          leaderId={member.mid}
          row={remarksRow}
          canPickMeeting={!remarksRow.attended}
          monthMeetings={rows}
          filesByMeetingId={filesByMeetingId}
          savingMeetingId={savingRemarksFor}
          remarksError={remarksError}
          onClose={() => setRemarksMeetingId(null)}
          onSave={(meetingId, text) => onSaveRemarks(meetingId, text)}
          onPickFile={stageFile}
        />
      )}

      {uploadRow && (
        <AttendanceUploadModal
          member={{ name: uploadRow.meetingType }}
          mode={uploadMode}
          file={filesByMeetingId[uploadRow.meetingId]}
          onClose={() => setUploadMeetingId(null)}
          onSave={(file) => {
            stageFile(uploadRow.meetingId, file);
            setUploadMeetingId(null);
          }}
        />
      )}
    </>
  );
}
