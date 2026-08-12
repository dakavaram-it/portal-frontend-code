import { useEffect, useRef, useState } from 'react'
import { getCadreNotes, getNoteCategories, saveCadreNote, deleteCadreNote } from '../cadreNotesApi.js'

const PAGE_SIZE = 5

const VISIBILITY_OPTIONS = [
  { value: 'Public', label: 'Public', icon: 'fa-earth-americas', tone: 'green' },
  { value: 'Private', label: 'Private', icon: 'fa-lock', tone: 'amber' },
]

const IMPACT_OPTIONS = [
  { value: 'Positive', label: 'Positive', icon: 'fa-arrow-trend-up', tone: 'green' },
  { value: 'Negative', label: 'Negative', icon: 'fa-arrow-trend-down', tone: 'red' },
]

// 5 MB is generous for a scanned nomination page or a short report and keeps a bad
// upload from turning into a multi-megabyte base64 string in the request body.
const MAX_PDF_BYTES = 5 * 1024 * 1024

// MySQL's own "YYYY-MM-DD HH:MM:SS" — Date() only parses that reliably once it looks ISO.
function formatWhen(mysqlDateTime) {
  if (!mysqlDateTime) return ''
  const d = new Date(mysqlDateTime.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return mysqlDateTime
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function initialsOf(first, last) {
  return [first, last].filter(Boolean).map((s) => s[0]).join('').toUpperCase() || '?'
}

// A small execCommand-based toolbar over a contentEditable div. execCommand is
// deprecated but still the only zero-dependency way to get bold/list/link editing
// without pulling in a rich-text package — the notes API stores the result as raw HTML
// (see the sample getCadreNotesByUser row), so a WYSIWYG surface is what it expects.
const TOOLBAR = [
  { cmd: 'bold', icon: 'fa-bold', title: 'Bold' },
  { cmd: 'italic', icon: 'fa-italic', title: 'Italic' },
  { cmd: 'underline', icon: 'fa-underline', title: 'Underline' },
  { cmd: 'strikeThrough', icon: 'fa-strikethrough', title: 'Strikethrough' },
  { sep: true },
  { cmd: 'insertUnorderedList', icon: 'fa-list-ul', title: 'Bulleted list' },
  { cmd: 'insertOrderedList', icon: 'fa-list-ol', title: 'Numbered list' },
  { sep: true },
  { cmd: 'justifyLeft', icon: 'fa-align-left', title: 'Align left' },
  { cmd: 'justifyCenter', icon: 'fa-align-center', title: 'Align center' },
  { cmd: 'justifyRight', icon: 'fa-align-right', title: 'Align right' },
  { sep: true },
  { cmd: 'removeFormat', icon: 'fa-eraser', title: 'Clear formatting' },
]

function RichTextEditor({ innerRef, invalid, onDirty }) {
  const link = () => {
    const url = window.prompt('Link URL')
    if (url) document.execCommand('createLink', false, url)
  }

  return (
    <div className={`leap-notes-editor ${invalid ? 'invalid' : ''}`}>
      <div className="leap-notes-toolbar">
        {TOOLBAR.map((btn, i) =>
          btn.sep ? (
            <span key={i} className="leap-notes-toolbar-sep" />
          ) : (
            <button
              key={btn.cmd}
              type="button"
              className="leap-notes-toolbar-btn"
              title={btn.title}
              onMouseDown={(e) => {
                e.preventDefault()
                document.execCommand(btn.cmd)
              }}
            >
              <i className={`fa-solid ${btn.icon}`} aria-hidden="true" />
            </button>
          )
        )}
        <button
          type="button"
          className="leap-notes-toolbar-btn"
          title="Insert link"
          onMouseDown={(e) => {
            e.preventDefault()
            link()
          }}
        >
          <i className="fa-solid fa-link" aria-hidden="true" />
        </button>
      </div>
      <div
        ref={innerRef}
        className="leap-notes-editor-area"
        contentEditable
        suppressContentEditableWarning
        onInput={onDirty}
      />
    </div>
  )
}

export default function CadreNotesModal({ cadreId, cadreName, onClose }) {
  const editorRef = useRef(null)

  const [categories, setCategories] = useState([])
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [page, setPage] = useState(1)

  const [editingId, setEditingId] = useState(null)
  const [visibility, setVisibility] = useState('Private')
  const [impact, setImpact] = useState('Positive')
  const [categoryId, setCategoryId] = useState('')
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  // Which required field failed on the last save attempt, so the field itself can show
  // a red outline rather than only a banner the reader has to match back to a control.
  const [invalid, setInvalid] = useState({ note: false, category: false })

  useEffect(() => {
    document.body.classList.add('leap-notes-modal-open')
    return () => document.body.classList.remove('leap-notes-modal-open')
  }, [])

  useEffect(() => {
    // Aborting the in-flight requests (rather than only ignoring their result via a
    // `cancelled` flag) is what stops StrictMode's dev-only double-invoke — and a fast
    // reloadKey bump in production — from letting a stale request run to completion
    // alongside the current one.
    const controller = new AbortController()
    setLoading(true)
    setLoadError(null)
    Promise.all([getCadreNotes(cadreId, controller.signal), getNoteCategories(controller.signal)])
      .then(([notesRes, categoriesRes]) => {
        setNotes(
          [...(notesRes || [])].sort((a, b) => new Date(b.insertedTime) - new Date(a.insertedTime))
        )
        setCategories(categoriesRes || [])
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        console.error(err)
        setLoadError(err.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [cadreId, reloadKey])

  const resetForm = () => {
    setEditingId(null)
    setVisibility('Private')
    setImpact('Positive')
    setCategoryId('')
    setFile(null)
    setFileError(null)
    setInvalid({ note: false, category: false })
    if (editorRef.current) editorRef.current.innerHTML = ''
  }

  const startEdit = (note) => {
    setEditingId(note.cadreNotesId)
    setVisibility(note.visibility || 'Private')
    setImpact(note.impact || 'Positive')
    setCategoryId(note.notesCategoryId ? String(note.notesCategoryId) : '')
    setFile(null)
    setFileError(null)
    setInvalid({ note: false, category: false })
    if (editorRef.current) editorRef.current.innerHTML = note.notes || ''
    window.scrollTo?.(0, 0)
  }

  const pickFile = (f) => {
    if (!f) {
      setFile(null)
      setFileError(null)
      return
    }
    if (f.type !== 'application/pdf') {
      setFile(null)
      setFileError('Only PDF files are accepted.')
      return
    }
    if (f.size > MAX_PDF_BYTES) {
      setFile(null)
      setFileError('That PDF is over 5 MB — attach a smaller file.')
      return
    }
    setFile(f)
    setFileError(null)
  }

  const fileToBase64 = (f) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result).split(',').pop())
      reader.onerror = reject
      reader.readAsDataURL(f)
    })

  const handleSave = async () => {
    const html = editorRef.current?.innerHTML?.trim() || ''
    const noteMissing = !html
    const categoryMissing = !categoryId
    if (noteMissing || categoryMissing) {
      setInvalid({ note: noteMissing, category: categoryMissing })
      setSaveError(
        noteMissing && categoryMissing
          ? 'Write a note and choose a category before saving.'
          : noteMissing
            ? 'Write a note before saving.'
            : 'Choose a category before saving.'
      )
      return
    }
    setInvalid({ note: false, category: false })
    setSaving(true)
    setSaveError(null)
    try {
      // The attachment is optional — an empty list is "no PDF", not a missing field.
      const base64StrList = file ? [await fileToBase64(file)] : []
      await saveCadreNote({
        cadreNotesId: editingId || undefined,
        cadreId,
        notes: html,
        visibility,
        impact,
        notesCategoryId: Number(categoryId),
        base64StrList,
      })
      resetForm()
      setReloadKey((k) => k + 1)
    } catch (err) {
      console.error(err)
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (note) => {
    if (!window.confirm('Delete this note?')) return
    try {
      await deleteCadreNote(note.cadreNotesId)
      if (editingId === note.cadreNotesId) resetForm()
      setReloadKey((k) => k + 1)
    } catch (err) {
      console.error(err)
      window.alert(err.message)
    }
  }

  const totalPages = Math.max(1, Math.ceil(notes.length / PAGE_SIZE))
  const pageNotes = notes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="leap-notes-overlay" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="leap-notes-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="leap-notes-modal-header">
          <h5 className="leap-notes-modal-title">
            <i className="fa-solid fa-note-sticky" aria-hidden="true" /> Notes on {cadreName}
          </h5>
          <button type="button" className="leap-notes-close" aria-label="Close" onClick={onClose}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <div className="leap-notes-modal-body">
          <RichTextEditor
            innerRef={editorRef}
            invalid={invalid.note}
            onDirty={() => invalid.note && setInvalid((v) => ({ ...v, note: false }))}
          />

          <div className="leap-notes-form-row">
            <div className="leap-notes-form-group">
              <span className="leap-notes-form-label">
                <i className="fa-solid fa-eye" aria-hidden="true" /> Visibility <span className="leap-notes-required">*</span>
              </span>
              <div className="leap-notes-toggle" role="group">
                {VISIBILITY_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className={`leap-notes-toggle-btn ${o.tone} ${visibility === o.value ? 'active' : ''}`}
                    onClick={() => setVisibility(o.value)}
                  >
                    <i className={`fa-solid ${visibility === o.value ? 'fa-circle-check' : o.icon}`} aria-hidden="true" /> {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="leap-notes-form-group">
              <span className="leap-notes-form-label">
                <i className="fa-solid fa-chart-line" aria-hidden="true" /> Impact <span className="leap-notes-required">*</span>
              </span>
              <div className="leap-notes-toggle" role="group">
                {IMPACT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className={`leap-notes-toggle-btn ${o.tone} ${impact === o.value ? 'active' : ''}`}
                    onClick={() => setImpact(o.value)}
                  >
                    <i className={`fa-solid ${impact === o.value ? 'fa-circle-check' : o.icon}`} aria-hidden="true" /> {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="leap-notes-form-row">
            <div className="leap-notes-form-group leap-notes-form-group-wide">
              <label className="leap-notes-form-label" htmlFor="notes-category">
                <i className="fa-solid fa-tag" aria-hidden="true" /> Category <span className="leap-notes-required">*</span>
              </label>
              <select
                id="notes-category"
                className={`leap-notes-select ${invalid.category ? 'invalid' : ''}`}
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value)
                  if (e.target.value) setInvalid((v) => ({ ...v, category: false }))
                }}
              >
                <option value="">-- Select Category --</option>
                {categories.map((c) => (
                  <option key={c.categoryId} value={c.categoryId}>{c.categoryName}</option>
                ))}
              </select>
            </div>

            <div className="leap-notes-form-group leap-notes-form-group-wide">
              <label className="leap-notes-form-label" htmlFor="notes-pdf">
                <i className="fa-solid fa-file-pdf" aria-hidden="true" /> PDF Attachment <span className="leap-notes-optional">(optional)</span>
              </label>
              <input
                id="notes-pdf"
                type="file"
                accept="application/pdf"
                className={`leap-notes-file-input ${fileError ? 'invalid' : ''}`}
                onChange={(e) => pickFile(e.target.files?.[0] || null)}
              />
              {fileError && <div className="leap-notes-field-error">{fileError}</div>}
              {file && !fileError && (
                <div className="leap-notes-field-hint">
                  <i className="fa-solid fa-paperclip" aria-hidden="true" /> {file.name} ({(file.size / 1024).toFixed(0)} KB)
                </div>
              )}
            </div>
          </div>

          {saveError && (
            <div className="leap-notes-error">
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {saveError}
            </div>
          )}

          <div className="leap-notes-save-row">
            {editingId && (
              <button type="button" className="leap-notes-btn leap-notes-btn-ghost" onClick={resetForm}>
                Cancel edit
              </button>
            )}
            <button type="button" className="leap-notes-btn leap-notes-btn-primary" onClick={handleSave} disabled={saving}>
              <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : editingId ? 'fa-check' : 'fa-plus'}`} aria-hidden="true" />
              {saving ? ' Saving…' : editingId ? ' Update Note' : ' Add Note'}
            </button>
          </div>

          <div className="leap-notes-divider" />

          <div className="leap-notes-prev-head">
            <span><i className="fa-solid fa-clock-rotate-left" aria-hidden="true" /> Previous Notes</span>
            <button type="button" className="leap-notes-refresh" title="Refresh" onClick={() => setReloadKey((k) => k + 1)}>
              <i className="fa-solid fa-rotate" aria-hidden="true" />
            </button>
          </div>

          {loading ? (
            <div className="leap-notes-empty">Loading…</div>
          ) : loadError ? (
            <div className="leap-notes-empty leap-notes-empty-error">Could not load notes ({loadError}).</div>
          ) : notes.length === 0 ? (
            <div className="leap-notes-empty">No notes yet on this cadre.</div>
          ) : (
            <>
              {pageNotes.map((n) => (
                <div key={n.cadreNotesId} className="leap-notes-item">
                  <div className="leap-notes-item-head">
                    <span className="leap-notes-item-avatar">{initialsOf(n.firstName, n.lastName)}</span>
                    <div className="leap-notes-item-who">
                      <div className="leap-notes-item-name">{[n.firstName, n.lastName].filter(Boolean).join(' ') || 'Unknown'}</div>
                      <div className="leap-notes-item-when">
                        <i className="fa-regular fa-clock" aria-hidden="true" /> {formatWhen(n.insertedTime)}
                      </div>
                    </div>
                    <span className={`leap-notes-badge ${n.visibility === 'Public' ? 'public' : 'private'}`}>
                      <i className={`fa-solid ${n.visibility === 'Public' ? 'fa-earth-americas' : 'fa-lock'}`} aria-hidden="true" />{' '}
                      {n.visibility || 'Private'}
                    </span>
                    {n.isEditable === 'Y' && (
                      <div className="leap-notes-item-actions">
                        <button type="button" title="Edit" onClick={() => startEdit(n)}>
                          <i className="fa-solid fa-pen" aria-hidden="true" />
                        </button>
                        <button type="button" title="Delete" onClick={() => handleDelete(n)}>
                          <i className="fa-solid fa-trash" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>
                  {(n.notesCategory || n.impact) && (
                    <div className="leap-notes-item-meta">
                      {n.notesCategory && <span className="leap-notes-tag">{n.notesCategory}</span>}
                      {n.impact && (
                        <span className={`leap-notes-impact-badge ${n.impact === 'Positive' ? 'positive' : 'negative'}`}>
                          <i className={`fa-solid ${n.impact === 'Positive' ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}`} aria-hidden="true" />{' '}
                          {n.impact}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="leap-notes-item-body" dangerouslySetInnerHTML={{ __html: n.notes }} />
                </div>
              ))}

              {totalPages > 1 && (
                <div className="leap-notes-pagination">
                  <button type="button" className="leap-notes-btn leap-notes-btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Prev
                  </button>
                  <span className="leap-notes-pagination-page">{page}</span>
                  <button type="button" className="leap-notes-btn leap-notes-btn-ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
