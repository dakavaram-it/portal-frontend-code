// The Notes half of Cadre Search & Notes — four more mypartydashboard.com PSA endpoints,
// same service as cadreSearchApi.js's search call but a different resource, so they get
// their own small client rather than growing that file into two unrelated concerns.
const BASE = '/psaapi/WebService/Cadre'

// No `authToken` header, matching the search call — no token source has been settled yet.
const post = async (path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`${path} -> ${res.status}`)
  return data
}

export const getCadreNotes = (cadreId) => post('/getCadreNotesByUser', { cadreId })

export const getNoteCategories = () => post('/getCategoryNotes', {})

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
