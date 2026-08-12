import { getToken } from './api.js'

// The Notes half of Cadre Search & Notes — four more mypartydashboard.com PSA endpoints,
// same service as cadreSearchApi.js's search call but a different resource, so they get
// their own small client rather than growing that file into two unrelated concerns.
// Called directly, not proxied — see the note in cadreSearchApi.js.
const BASE = 'https://www.mypartydashboard.com/PSA/WebService/Cadre'

// `signal` lets a caller abort a request whose result it no longer wants — the modal's
// load effect passes one so React 18 StrictMode's dev-only double-invoke (and a cadreId
// change while a request is still in flight) cancels the stale request outright rather
// than just discarding its result, which is what let both fire to completion.
const post = async (path, body, signal) => {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authToken: getToken() || '' },
    body: JSON.stringify(body),
    signal,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`${path} -> ${res.status}`)
  return data
}

export const getCadreNotes = (cadreId, signal) => post('/getCadreNotesByUser', { cadreId }, signal)

export const getNoteCategories = (signal) => post('/getCategoryNotes', {}, signal)

// Omit `cadreNotesId` for a new note; include it to edit one in place.
export const saveCadreNote = ({ cadreNotesId, cadreId, notes, visibility, impact, notesCategoryId, base64StrList }) =>
  post('/saveCadreNotesInformationDetails', {
    ...(cadreNotesId ? { cadreNotesId } : {}),
    cadreId,
    notes,
    visibility,
    impact,
    notesCategoryId,
    base64StrList: base64StrList || [''],
  })

export const deleteCadreNote = (cadreNotesId) => post('/deleteCadreNotesData', { cadreNotesId })
