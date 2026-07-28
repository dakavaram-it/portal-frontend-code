// Static, fully fictional sample data for the CENP nomination-workflow demo.
// Names, phone numbers, IDs and organisations below are invented for illustration only.

export const STAGES = [
  { key: 'profiles', label: 'Profiles', full: 'Add Profiles', team: 'State Office · Regional Team · Research Cell' },
  { key: 'approval', label: 'Approval', full: 'Review / Approval', team: 'Core Committee · State President · Regional MLAs' },
]

export const STAGE_COLORS = ['#3b82f6', '#f59e0b']

export const STATE_NAME = 'Krishna Pradesh'
export const PARTY_NAME = 'Praja Vikas Party'
export const PARTY_SHORT = 'TDP'
export const TERM_LABEL = '2026 Term'

// Static reference data — real Andhra Pradesh administrative names, used only as illustrative picklists.
export const AP_ASSEMBLIES = [
  'Srikakulam', 'Icchapuram', 'Palasa', 'Tekkali', 'Narasannapeta', 'Amadalavalasa',
  'Vizianagaram', 'Bobbili', 'Cheepurupalli', 'Parvathipuram', 'Salur',
  'Visakhapatnam East', 'Visakhapatnam West', 'Visakhapatnam North', 'Visakhapatnam South',
  'Gajuwaka', 'Bhimili', 'Pendurthi', 'Anakapalle', 'Chodavaram',
  'Kakinada Rural', 'Kakinada City', 'Pithapuram', 'Peddapuram', 'Rajahmundry City',
  'Rajahmundry Rural', 'Amalapuram', 'Ramachandrapuram', 'Tuni',
  'Eluru', 'Denduluru', 'Bhimavaram', 'Palakollu', 'Narasapuram', 'Tanuku', 'Tadepalligudem', 'Kovvur',
  'Vijayawada Central', 'Vijayawada West', 'Vijayawada East', 'Machilipatnam', 'Gudivada',
  'Mylavaram', 'Nandigama', 'Jaggayyapeta', 'Penamaluru', 'Avanigadda', 'Pedana',
  'Guntur East', 'Guntur West', 'Mangalagiri', 'Tenali', 'Ponnur', 'Chilakaluripet',
  'Narasaraopet', 'Vinukonda', 'Sattenapalle', 'Bapatla', 'Repalle', 'Tadikonda',
  'Ongole', 'Chirala', 'Addanki', 'Kandukur', 'Kanigiri', 'Markapur', 'Darsi',
  'Nellore City', 'Nellore Rural', 'Kavali', 'Atmakur', 'Gudur', 'Sullurpeta', 'Venkatagiri',
  'Kurnool', 'Nandyal', 'Adoni', 'Yemmiganur', 'Panyam', 'Dhone', 'Pattikonda', 'Banaganapalle',
  'Anantapur Urban', 'Anantapur Rural', 'Dharmavaram', 'Hindupur', 'Kadiri', 'Rayadurg',
  'Guntakal', 'Tadipatri', 'Uravakonda', 'Kalyandurg', 'Penukonda', 'Puttaparthi',
  'Kadapa', 'Pulivendla', 'Jammalamadugu', 'Proddatur', 'Badvel', 'Rajampet', 'Rayachoti',
  'Chittoor', 'Tirupati', 'Srikalahasti', 'Puttur', 'Nagari', 'Punganur', 'Madanapalle', 'Palamaner', 'Kuppam',
]

export const AP_MANDAL_TOWNS = [
  'Tirupati', 'Chittoor', 'Madanapalle', 'Punganur', 'Palamaner', 'Srikalahasti', 'Nagari', 'Puttur', 'Kuppam',
  'Kadapa', 'Proddatur', 'Pulivendla', 'Rajampet', 'Badvel', 'Jammalamadugu',
  'Kurnool', 'Nandyal', 'Adoni', 'Yemmiganur', 'Dhone', 'Banaganapalle',
  'Anantapur', 'Dharmavaram', 'Hindupur', 'Kadiri', 'Guntakal', 'Rayadurg', 'Tadipatri',
  'Guntur', 'Tenali', 'Mangalagiri', 'Narasaraopet', 'Chilakaluripet', 'Bapatla', 'Ponnur', 'Vinukonda', 'Sattenapalle',
  'Ongole', 'Chirala', 'Kandukur', 'Markapur', 'Addanki',
  'Nellore', 'Kavali', 'Gudur', 'Sullurpeta', 'Atmakur', 'Venkatagiri',
  'Vijayawada', 'Machilipatnam', 'Gudivada', 'Nandigama', 'Jaggayyapeta', 'Avanigadda', 'Pedana',
  'Eluru', 'Bhimavaram', 'Palakollu', 'Tanuku', 'Narasapuram', 'Tadepalligudem', 'Kovvur',
  'Rajahmundry', 'Kakinada', 'Pithapuram', 'Peddapuram', 'Amalapuram', 'Ramachandrapuram', 'Tuni',
  'Visakhapatnam', 'Anakapalle', 'Bhimili', 'Gajuwaka',
  'Vizianagaram', 'Bobbili', 'Srikakulam', 'Palasa', 'Tekkali', 'Icchapuram',
]

function candidate(overrides) {
  return {
    id: overrides.id,
    name: overrides.name,
    score: overrides.score,
    status: overrides.status || null, // e.g. 'Assigned for GO Issue', 'Shortlisted', 'Finalized'
    idNo: overrides.idNo,
    phone: overrides.phone,
    gender: overrides.gender || 'Male',
    age: overrides.age,
    dob: overrides.dob,
    caste: overrides.caste,
    occupation: overrides.occupation || 'Politician',
    education: overrides.education || 'Graduate',
    parliament: overrides.parliament,
    assembly: overrides.assembly,
    mandal: overrides.mandal,
    casteCommunityPct: overrides.casteCommunityPct,
    memberSince: overrides.memberSince,
    renewals: overrides.renewals,
    appPoints: overrides.appPoints,
    stateRank: overrides.stateRank,
    constituencyRank: overrides.constituencyRank,
    totalCount: overrides.totalCount,
    totalPosts: overrides.totalPosts,
    totalEvents: overrides.totalEvents,
  }
}

let _cid = 100
function nextCid() {
  _cid += 1
  return `CDR-${_cid}`
}
let _phone = 90000000
function nextPhone() {
  _phone += 11
  return `9${String(_phone).slice(-9)}`
}

const NAMES = [
  'K. Ramesh Babu', 'P. Lakshmi Devi', 'M. Suresh Kumar', 'V. Anitha Reddy',
  'G. Narayana Rao', 'S. Padma Priya', 'T. Venkata Rao', 'D. Kavitha',
  'B. Chandra Sekhar', 'N. Rajeswari', 'A. Srinivasa Rao', 'C. Manjula',
  'R. Prasada Rao', 'L. Haritha', 'J. Bhaskar Reddy', 'Y. Sujatha',
]
let _nameIdx = 0
function nextName() {
  const n = NAMES[_nameIdx % NAMES.length]
  const gender = _nameIdx % 2 === 0 ? 'Male' : 'Female'
  _nameIdx += 1
  return { name: n, gender }
}

const MANDALS = ['Riverside', 'Northgate', 'Lakeview', 'Old Town', 'Hilltop', 'Southbank', 'East Cross', 'Millpet']
const CASTES = ['BC · Weaver community', 'OC · General', 'SC · Mala', 'ST · Konda Reddy', 'BC · Fisherman community']

function makeCandidate(i, opts = {}) {
  const mandal = MANDALS[i % MANDALS.length]
  const { name, gender } = nextName()
  return candidate({
    id: nextCid(),
    name,
    gender,
    score: Math.round((40 + Math.random() * 45) * 100) / 100,
    idNo: `MEM-${100000 + i * 37}`,
    phone: nextPhone(),
    age: 34 + (i % 20),
    dob: `${10 + (i % 18)} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i % 12]} ${1970 + (i % 20)}`,
    caste: CASTES[i % CASTES.length],
    parliament: mandal,
    assembly: mandal,
    mandal: `${mandal} Town`,
    casteCommunityPct: Math.round(Math.random() * 8 * 10) / 10,
    memberSince: 2010 + (i % 14),
    renewals: 1 + (i % 6),
    appPoints: Math.round(Math.random() * 6000 * 10) / 10,
    stateRank: 500 + i * 73,
    constituencyRank: 5 + (i % 40),
    totalCount: i % 4,
    totalPosts: i % 3,
    totalEvents: i % 5,
    ...opts,
  })
}

const NOMINATED_DEFS = [
  { dept: 'Urban Development', title: 'State Urban Development Authority (Riverside Zone)', role: 'CHAIRMAN', seats: 1, stage: 5, cands: 1 },
  { dept: 'Minorities Welfare', title: 'State Minorities Welfare Commission', role: 'CHAIRMAN', seats: 1, stage: 2, cands: 8 },
  { dept: 'Backward Classes Welfare', title: 'State Backward Classes Corporation', role: 'CHAIRMAN', seats: 1, stage: 2, cands: 14 },
  { dept: 'Fisheries', title: 'State Fisheries Welfare Board', role: 'CHAIRMAN', seats: 1, stage: 2, cands: 3 },
  { dept: 'Handlooms & Textiles', title: 'State Handloom & Textiles Corporation', role: 'CHAIRMAN', seats: 1, stage: 0, cands: 0 },
  { dept: 'Skill Development', title: 'State Skill Development Mission', role: 'VICE CHAIRMAN', seats: 1, stage: 0, cands: 0 },
  { dept: 'Sports & Youth Services', title: 'State Sports Authority', role: 'CHAIRMAN', seats: 1, stage: 0, cands: 0 },
  { dept: 'Housing', title: 'State Cooperative Housing Board', role: 'MEMBER', seats: 3, stage: 2, cands: 6 },
]

const COMMITTEE_DEFS = [
  { dept: 'Affiliated Wing', title: `${STATE_NAME} State Youth Wing Committee`, role: 'PRESIDENT', seats: 1, stage: 4, cands: 6, finalized: 1 },
  { dept: 'Affiliated Wing', title: `${STATE_NAME} State Women's Wing Committee`, role: 'PRESIDENT', seats: 1, stage: 4, cands: 8, finalized: 1 },
  { dept: 'Affiliated Wing', title: `${STATE_NAME} State Farmers Cell Committee`, role: 'PRESIDENT', seats: 1, stage: 4, cands: 5, finalized: 1 },
  { dept: 'Affiliated Wing', title: `${STATE_NAME} State ST Welfare Cell`, role: 'PRESIDENT', seats: 1, stage: 3, cands: 7 },
  { dept: 'Affiliated Wing', title: `${STATE_NAME} State Trade & Commerce Cell`, role: 'PRESIDENT', seats: 1, stage: 3, cands: 4 },
  { dept: 'Affiliated Wing', title: `${STATE_NAME} State Teachers & Employees Wing`, role: 'PRESIDENT', seats: 1, stage: 3, cands: 9 },
  { dept: 'Affiliated Wing', title: `${STATE_NAME} State Legal Cell Committee`, role: 'PRESIDENT', seats: 1, stage: 1, cands: 3 },
  { dept: 'Affiliated Wing', title: `${STATE_NAME} State Cultural & Arts Wing`, role: 'PRESIDENT', seats: 1, stage: 0, cands: 0 },
]

let _pid = 0
function buildPositions(defs, kind) {
  return defs.map((d) => {
    _pid += 1
    const candidates = []
    for (let i = 0; i < d.cands; i++) {
      const isFinal = d.finalized ? i < d.finalized : false
      candidates.push(makeCandidate(_pid * 10 + i, isFinal ? { status: 'Finalized' } : {}))
    }
    if (kind === 'nominated' && d.stage === 5 && candidates.length) {
      candidates[0].status = 'Assigned for GO Issue'
    }
    return {
      id: `pos-${_pid}`,
      kind,
      dept: d.dept,
      state: STATE_NAME,
      level: 'State',
      title: d.title,
      role: d.role,
      seats: d.seats,
      seatsFilled: d.finalized || 0,
      stageIndex: d.stage,
      candidates,
    }
  })
}

export const POSITIONS = [
  ...buildPositions(NOMINATED_DEFS, 'nominated'),
  ...buildPositions(COMMITTEE_DEFS, 'committee'),
]

export function stagesFor(kind) {
  return kind === 'nominated' ? STAGES : STAGES.slice(0, 5)
}

export function stageCounts(positions) {
  const counts = STAGES.map(() => 0)
  positions.forEach((p) => {
    counts[p.stageIndex] += 1
  })
  return counts
}

export function summary(positions) {
  const committees = positions.filter((p) => p.kind === 'committee')
  const nominated = positions.filter((p) => p.kind === 'nominated')
  const finalizedCommittees = committees.filter((p) => p.stageIndex >= 4).length
  const finalizedNominated = nominated.filter((p) => p.stageIndex >= 4).length
  const shortlisted = positions.filter((p) => p.stageIndex === 4 && p.seatsFilled < p.seats).length
  const goIssued = nominated.filter((p) => p.stageIndex === 6).length
  return {
    total: positions.length,
    committees: committees.length,
    nominated: nominated.length,
    shortlisted,
    finalized: finalizedCommittees + finalizedNominated,
    goIssued,
    committeeStats: {
      positions: committees.length,
      candidates: committees.reduce((a, p) => a + p.candidates.length, 0),
      finalized: finalizedCommittees,
      complete: committees.length ? Math.round((finalizedCommittees / committees.length) * 100) : 0,
    },
    nominatedStats: {
      positions: nominated.length,
      candidates: nominated.reduce((a, p) => a + p.candidates.length, 0),
      finalized: finalizedNominated,
      complete: nominated.length ? Math.round((finalizedNominated / nominated.length) * 100) : 0,
    },
  }
}
