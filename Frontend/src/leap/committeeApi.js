import { getToken } from './api.js'

// Committees Assign talks to two more mypartydashboard.com services beyond Cadre Search &
// Notes' PSA/Cadre resource (cadreSearchApi.js / cadreNotesApi.js): PSA's own Committee
// resource, which is what the KSS/CUBS screen in the legacy build
// (committessBlockSection.js) calls directly via fetch — every function below with a
// `Committee/...` path is copied from that file's own `getPSAAPICall` calls, so the path
// and payload shape are taken verbatim from working code, not guessed. The
// PartyAnalyst/WebService/CommitteeWebService resource is the second: the legacy
// booth/unit/cluster picklists (cadreCommittee.js) called those as Struts `.action`
// endpoints, and committee_webservices(2).txt documents their migrated replacements as
// living under that different service — same mypartydashboard.com host, different app
// context, so it gets its own base URL.
const PSA_BASE = 'https://www.mypartydashboard.com/PSA/WebService'
const PARTY_ANALYST_BASE = 'https://www.mypartydashboard.com/PartyAnalyst/WebService/CommitteeWebService'

const post = async (base, path, body) => {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authToken: getToken() || '' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`${path} -> ${res.status}`)
  return data
}

const committee = (path, body) => post(PSA_BASE, `/Committee${path}`, body)
const partyAnalyst = (path, body) => post(PARTY_ANALYST_BASE, `/${path}`, body)

// ---------- KSS (Kutumba Sadikara Saradulu) ----------
// The five overview tiles: totalBooth / totalSections / minSections / totalKssAssigned /
// minKssRequired.
export const getKSSCommitteeOverview = (constituencyId) =>
  committee('/Constituency/getKSSCommitteeOverview', { constituencyId })

// Booth-by-booth fill counts, behind the "Total Booths" tile.
export const getBoothWiseKssFillCount = (constituencyId) =>
  committee('/getBoothWiseKssFillCountInAConstituency', { constituencyId })

// Sections created so far, behind the "Total KSS — Sections Created" tile.
export const getKSSSectionDetails = (constituencyId) =>
  committee('/Constituency/getSectionDetails', { constituencyId })

// Members assigned so far, behind the "Total KSS Members Assigned" tile.
export const getKSSAssignedMembers = (constituencyId) =>
  committee('/Constituency/getKSSCommitteeDetails', { constituencyId })

// Every booth's serial-no ranges, filled or "Pending" — the "Click To KSS Complete
// Overview" table, which can also create a pending section in place.
export const getCompleteKssOverview = (constituencyId) =>
  committee('/getCompleteKssOverview', { constituencyId })

// The next unused serial-no range for a booth, used to prefill "From Serial No" when a
// booth is picked in the Create KSS forms.
export const getNextSectionSerialNo = (boothId) =>
  committee('/getNextSectionSerialNo', { boothId })

// Creates one KSS section (a serial-no range within a booth), optionally with up to two
// members staged onto it in the same call. `kssCadres` is `[{cadreId, casteId, mobileNo}]`
// — empty for a plain Create KSS, populated for Create KSS & Assign Members.
export const saveKssSection = ({ boothId, fromSerialNo, toSerialNo, kssCadres }) =>
  committee('/saveSection', { boothId, fromSerialNo, toSerialNo, kssCadres: kssCadres || [] })

export const deleteKssSection = (sectionId) => committee('/deleteKssSectionCommittee', { sectionId })

// The legacy caller also sends the acting user's id here (`loginUserId`, off the JSP
// session) — this app's session-carried `user.user_id` is the closest equivalent, so
// callers should pass it through as `userId` when they have it.
export const deleteCommitteeMember = (tdpCommitteeMemberId, userId) =>
  committee('/deleteCommitteeMember', { tdpCommitteeMemberId, userId })

// Existing, not-yet-fully-staffed KSS sections in a booth — the picklist behind the
// standalone "Assign Members" flow (as opposed to creating a new section).
export const getUnassignedKssSectionsByBooth = (boothId) =>
  committee('/getCommitteeSectionsByBoothId', { boothId })

// Adds one member to an existing section. `kssCadres` is the same
// `[{cadreId, casteId, mobileNo}]` shape saveKssSection takes.
export const addKSSMember = ({ boothId, committeeRoleId, kssCadres }) =>
  committee('/Section/addKSSMember', { boothId, committeeRoleId, kssCadres })

// ---------- CUBS (Booth / Unit / Cluster convenor tracking) ----------
// committeeLevelId: 15 Booth, 16 Unit, 17 Cluster — same ids the KSS/Booth/Unit/Cluster
// radio group in the legacy screen used.
export const getCUBSConvenorCount = (committeeLevelId, constituencyId) =>
  committee('/getCUBSConvenorCount', { committeeLevelId, constituencyId })

export const getCUBSConvenorDetails = (committeeLevelId, constituencyId) =>
  committee('/getCUBSConvenorDetails', { committeeLevelId, constituencyId })

// ---------- Booth / Unit / Cluster picklists ----------
// The KSS flow's own booth picklist (committee_webservices(2).txt item 12) — a different
// endpoint, and a different response shape (`optionId`/`optionName`), than the CUBS one
// below, because the legacy JS calls two different services for what looks like the same
// dropdown.
export const getKssBooths = async (constituencyId) => {
  const rows = await partyAnalyst('getBoothsByConstituencyIdInAPublication', { constituencyId })
  return (rows || []).map((r) => ({ value: String(r.optionId), label: `Booth ${r.optionName}` }))
}

// The CUBS Booth/Unit/Cluster radio's own location lists (committee_webservices(2).txt
// items 18/19/20) — `locationId`/`locationName`, and take `enrollmentId: 4` the way every
// call in the legacy JS does without explaining why.
const cubsLocations = async (path, constituencyId) => {
  const rows = await partyAnalyst(path, { constituencyId, enrollmentId: 4 })
  return (rows || []).map((r) => ({ value: String(r.locationId), label: r.locationName }))
}
export const getCubsBooths = (constituencyId) =>
  cubsLocations('getTdpCommitteeBoothsByConstituencyId', constituencyId)
export const getCubsUnits = (constituencyId) =>
  cubsLocations('getTdpCommitteeUnitsByConstituencyId', constituencyId)
export const getCubsClusters = (constituencyId) =>
  cubsLocations('getTdpCommitteeClustersByConstituencyId', constituencyId)

// ---------- Main / Affiliated Committee (Village-Ward / Mandal-Town / Constituency) ----------
// The second, older paradigm (cadreCommittee.txt's own inline script, which is what
// actually drives the current JSP's "Committees" tab — cadreCommittee.js's top half
// targets element ids that no longer exist in that markup and is dead). Every function
// here is taken from that inline script's own field usage, not the webservice doc's
// sample payloads, where the two disagree (the doc's sample responses for some of these
// items look copy-pasted from an unrelated endpoint).

// Village/Ward radio's own Mandal/Municipality/Corporation picklist.
export const getMainCommitteeMandals = async (constituencyId) => {
  const rows = await partyAnalyst('getTdpCommitteeMandalByConstituency', {
    locationId: constituencyId, enrollmentId: 4, committeeType: 'PartyCommittee',
  })
  return (rows || []).map((r) => ({ value: String(r.id), label: r.name }))
}

// Village/Ward radio's second dropdown — the panchayats/wards under the chosen mandal.
export const getMainCommitteeLocationsByMandal = async (mandalId, constituencyId) => {
  const rows = await partyAnalyst('getTdpCommitteePanchayatWardByMandal', {
    mandalId, constituencyId, enrollmentId: 4,
  })
  return (rows || []).map((r) => ({ value: String(r.locationId), label: r.locationName }))
}

// Mandal/Town/Division radio's own (single-step) location picklist.
export const getMainCommitteeLocations = async (constituencyId) => {
  const rows = await partyAnalyst('getCommitteLocations', { locationType: 'mandal', locationId: constituencyId })
  return (rows || []).map((r) => ({ value: String(r.locationId), label: r.locationName }))
}

// The Affiliated Committee picklist, once Committee Type is set to Affiliated.
export const getAffiliatedCommittees = async (locationType, locationValue) => {
  const rows = await partyAnalyst('getAllAffiliatedCommitties', { locationType, locValue: locationValue })
  return (rows || []).map((r) => ({ value: String(r.locationId), label: r.locationName }))
}

// Empty string means open, non-empty is the reason it's not (e.g. already confirmed) —
// checked before a designation's search box is offered. The legacy call's response was
// plain text rather than JSON; if the migrated endpoint still answers that way, `post`'s
// `res.json().catch(() => null)` swallows the parse failure into `null` — which the
// caller reads as "no problem" rather than surfacing the mismatch. Worth checking first
// if a designation search box opens when it shouldn't.
export const checkDesignationVacancy = (designationId) =>
  partyAnalyst('checkIsVacancyForDesignationNew', { designationId })

// The Main/Affiliated Committee's one real data call: `result` is the designation list
// (with per-role total/proposed/finalized/vacancy counts, and what View's role summary
// carousel and Add's designation dropdown both read from), `hamletsOfTownship` is the
// member list for whichever location/type/affiliated-committee was picked.
export const getMainCommitteeSnapshot = (locationType, locationValue, committeeType) =>
  partyAnalyst('getCommitteMembersInfo', { locationType, locationValue, committeeType })

// Committee Type "View All Committee Info" — every designation's member across a
// location in one flat list, no role breakdown.
export const getAllCommitteeMembersInALocation = (locationType, locationValue) =>
  partyAnalyst('getAllCommitteeMembersInfoInALoc', { locationType, locValue: locationValue })

// Drops a member from their committee designation.
export const deleteMainCommitteeMember = (tdpCommitteeMemberId) =>
  partyAnalyst('getCommitteeDetailsByStatusPopUp', {
    tdpcommitteeMemberId: tdpCommitteeMemberId,
    committeeEnrollmentId: ['4'],
    fromDate: '01/01/2018',
    toDate: new Date().toLocaleDateString('en-US'),
    task: 'deleterole',
  })

// Assigns a searched cadre to a committee designation — the one write the legacy
// screen's full profile-edit page (cadreProfileDetailsAction.action) eventually made,
// simplified to what the migrated webservice actually takes.
export const assignMainCommitteeMember = (committeeRoleId, cadreId, userId) =>
  partyAnalyst('committeTdpCadreSaveRegistration', { committeeRoleId, cadreId, userId })
