import { useState } from 'react'

// Dashboard 2 — a static, mock-data preview of an alternate dashboard layout.
// Ported directly from a standalone design mockup (fixed sample data, no
// /leapapi calls). It intentionally keeps the mockup's own visual language
// (fonts, colors, spacing) rather than Leap.css's `leap-` classes, so it
// looks distinct from the rest of the app — this is a design reference, not
// a production screen wired to the backend.

// ---- inline "CSS text" -> React style object, so the JSX below can keep
// the mockup's original style strings almost verbatim. ----
function sx(css) {
  const style = {}
  css.split(';').forEach((decl) => {
    const i = decl.indexOf(':')
    if (i < 0) return
    const prop = decl.slice(0, i).trim()
    if (!prop) return
    const value = decl.slice(i + 1).trim()
    const key = prop.startsWith('--') ? prop : prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    style[key] = value
  })
  return style
}

const DASH2_CSS = `
.leap-dash2{background:#f1f3f2;font-family:'IBM Plex Sans',system-ui,sans-serif;color:#1a2422;-webkit-font-smoothing:antialiased}
.leap-dash2 *{box-sizing:border-box}
.leap-dash2 button{font-family:inherit}
.d2-btn{transition:background .12s,border-color .12s,color .12s}
.d2-btn:hover{background:#f1f7f6;border-color:#0d7a6f;color:#0d7a6f}
.d2-link:hover{color:#0a5b53}
.d2-card{transition:border-color .12s}
.d2-card:hover{border-color:#0d7a6f}
.d2-row:hover{background:#fafbfb}
.d2-geo-row:hover{background:#f4f8f7}
`

// ---- static mock data (verbatim from the design mockup) ----
const T = { ink: '#1a2422', mute: '#6b7873', teal: '#0d7a6f', red: '#c0392b', amber: '#b06f0a', green: '#1c7a45', purple: '#5b4bbd', crim: '#b3123b', blue: '#1d5fbd' }
const n = (v) => v.toLocaleString('en-IN')
const pc = (a, b) => (b ? Math.round((a / b) * 100) : 0)

const D = [
  ['Mandal Parishad', '#0d7a6f', [['MPP', 'Mandal Parishad President', 660, 604, 470, 388], ['MPTC', 'Territorial constituency', 9698, 8410, 6912, 5204], ['Vice MPP', 'Vice President', 660, 596, 452, 366]]],
  ['Zilla Parishad', '#0d7a6f', [['ZP Chairman', 'District chairperson', 26, 24, 18, 15], ['ZPTC', 'Territorial constituency', 660, 612, 478, 402], ['Vice Chairman', 'District vice chairperson', 26, 23, 17, 14]]],
  ['Gram Panchayat', '#b3123b', [['Ward Member', 'Village ward member', 129000, 112300, 88200, 71500], ['Sarpanch', 'Village head', 13326, 12010, 9180, 7420], ['Upa Sarpanch', 'Deputy village head', 13326, 11760, 8890, 7110]]],
  ['Municipality', '#b3123b', [['Ward Councillor', 'Municipal ward', 2712, 2480, 1960, 1610], ['Chairperson', 'Municipal chairperson', 87, 82, 61, 52], ['Vice Chairperson', 'Municipal vice chairperson', 87, 80, 58, 49]]],
  ['Municipal Corporation', '#7a5b0d', [['Mayor', 'Corporation mayor', 17, 16, 12, 10], ['Corporator', 'Corporation division', 812, 742, 588, 470], ['Deputy Mayor', 'Corporation deputy mayor', 17, 15, 11, 9]]],
]
const ROWS = D.map(([body, accent, rs]) => ({
  body,
  accent,
  rows: rs.map(([name, sub, total, proposed, confirmed, noms]) => {
    const houses = total * 180, visited = Math.round(houses * 0.62)
    const vloc = Math.round(noms * (visited / houses))
    const visited2 = Math.round(houses * 0.48), vloc2 = Math.round(vloc * 0.79)
    const declared = Math.round(vloc2 * 0.88), won = Math.round(declared * 0.57)
    return { name, sub, total, proposed, confirmed, noms, houses, visited, hPending: houses - visited, vloc, visited2, hPending2: houses - visited2, vloc2, declared, won, lost: declared - won }
  }),
}))
const ALL = []
ROWS.forEach((g) => g.rows.forEach((r) => ALL.push(Object.assign({ body: g.body }, r))))

const STEPS = [
  ['Proposal', 'Which locations have names put forward, and which are still empty. Several names on one location is normal.'],
  ['Confirmation', 'Compare the names on a location side by side and confirm exactly one.'],
  ['Nomination', 'Confirmed candidates who filed their papers before the deadline.'],
  ['Door to door', 'First round of field coverage against the voter list.'],
  ['Door to door 2', 'Second round of visits. Same process as round 1, counted from its own field source.'],
  ['Result', 'Declared outcomes as mandal users enter them.'],
]
const STAGES = ['Not started', 'Proposal received', 'Confirmed', 'Nomination filed', 'Door to Door done', 'Door to Door - 2 done', 'Result declared']
const SS = { 'Not started': ['#fdecec', '#a52a1f'], 'Proposal received': ['#fdf3e3', '#8a5a05'], Confirmed: ['#eaf6ef', '#1c7a45'], 'Nomination filed': ['#e9f3f2', '#0a5b53'], 'Door to Door done': ['#e8f0fb', '#1d5fbd'], 'Door to Door - 2 done': ['#e4ecfa', '#164a9e'], 'Result declared': ['#f0eefc', '#4a3bb0'] }
const CHIPS = [
  ['Total locations', 'total', 0, 0, T.ink, 'every location in this position'],
  ['Started', 'proposed', 1, 0, T.green, 'at least one name received'],
  ['Confirmed', 'confirmed', 2, 1, T.green, 'one name settled'],
  ['Nomination filed', 'noms', 3, 2, T.teal, 'papers submitted'],
  ['Door to Door', 'vloc', 4, 3, T.blue, 'first round covered'],
  ['Door to Door - 2', 'vloc2', 5, 4, '#164a9e', 'second round covered'],
  ['Result declared', 'declared', 6, 5, T.purple, 'outcome entered'],
]
const PCS = [
  ['Araku', ['Palakonda', 'Kurupam', 'Parvathipuram', 'Salur']],
  ['Srikakulam', ['Palasa', 'Tekkali', 'Narasannapeta', 'Srikakulam']],
  ['Vizianagaram', ['Rajam', 'Bobbili', 'Cheepurupalli', 'Gajapathinagaram']],
  ['Visakhapatnam', ['Bheemili', 'Vizag North', 'Vizag South', 'Vizag East']],
  ['Anakapalli', ['Chodavaram', 'Madugula', 'Anakapalli', 'Pendurthi']],
  ['Kakinada', ['Peddapuram', 'Pithapuram', 'Kakinada City', 'Tuni']],
  ['Rajahmundry', ['Rajanagaram', 'Rajahmundry City', 'Kovvur', 'Nidadavole']],
  ['Eluru', ['Eluru', 'Denduluru', 'Unguturu', 'Nuzvid']],
]
const QUOTAS = [['All', 1, T.mute], ['SC', 0.15, T.purple], ['ST', 0.08, T.teal], ['BC', 0.33, T.amber], ['General', 0.44, '#3d4a46'], ['Women', 0.5, T.crim]]
const LOCS = [
  ['Kotabommali (Ward 1)', 'SC · Woman', 6], ['Naupada', 'General', 1], ['Ponduru (Ward 3)', 'BC', 3],
  ['Burja', 'ST', 0], ['Laveru (Ward 5)', 'General · Woman', 2], ['Ranasthalam', 'BC · Woman', 5],
  ['Etcherla (Ward 7)', 'General', 6], ['Rajam', 'SC', 4],
  ['Santhakaviti', 'BC', 3], ['Pathapatnam (Ward 2)', 'General · Woman', 5],
  ['Meliaputti', 'ST · Woman', 1], ['Hiramandalam', 'BC', 6],
  ['Kotturu (Ward 4)', 'SC', 2], ['Palakonda', 'General', 4],
  ['Veeraghattam', 'ST', 0], ['Regidi (Ward 6)', 'BC · Woman', 3],
  ['Saravakota', 'General', 5], ['Jalumuru (Ward 8)', 'SC · Woman', 2],
  ['Polaki', 'BC', 4], ['Gara (Ward 9)', 'General', 1],
]
// name, phone, gender, age, casteGroup, sub-caste, occupation, education, since, score, houses, past, cases, proposedBy
const POOL = [
  ['K. Ramesh Babu', '+91 94000 73405', 'Male', 49, 'SC', 'Mala', 'Business', 'Intermediate', 2019, 65, 186, '1 win · 1 loss', 'None', 'Mandal in-charge'],
  ['P. Lakshmi Devi', '+91 93910 82210', 'Female', 41, 'BC', 'Gouda', 'Teacher', 'Degree', 2016, 72, 154, '1 win', 'None', 'AC president'],
  ['M. Srinivas Rao', '+91 98480 66874', 'Male', 53, 'General', '—', 'Agriculture', 'SSC', 2014, 58, 97, '2 losses', '1 civil', 'District committee'],
  ['T. Sujatha', '+91 90140 55219', 'Female', 38, 'ST', 'Savara', 'Anganwadi worker', 'Intermediate', 2018, 69, 203, 'First time', 'None', 'Mandal in-charge'],
  ['B. Anil Kumar', '+91 97010 34882', 'Male', 45, 'BC', 'Yadava', 'Contractor', 'Degree', 2015, 61, 142, '1 loss', 'None', 'Mandal in-charge'],
  ['S. Padma Sri', '+91 99590 71160', 'Female', 36, 'SC', 'Madiga', 'Self-employed', 'Degree', 2017, 74, 168, 'First time', 'None', 'AC president'],
  ['G. Venkata Rao', '+91 91770 22945', 'Male', 57, 'General', '—', 'Retired teacher', 'PG', 2011, 66, 88, '2 wins', 'None', 'District committee'],
  ['N. Kavitha', '+91 96520 60731', 'Female', 33, 'BC', 'Setti Balija', 'Shop owner', 'Intermediate', 2020, 55, 121, 'First time', 'None', 'Mandal in-charge'],
  ['D. Prasad Reddy', '+91 93470 18604', 'Male', 47, 'General', '—', 'Agriculture', 'Degree', 2013, 70, 133, '1 win · 1 loss', 'None', 'AC president'],
  ['V. Sirisha', '+91 98663 90512', 'Female', 39, 'BC', 'Turpu Kapu', 'Tailoring unit', 'SSC', 2019, 63, 175, 'First time', 'None', 'Mandal in-charge'],
  ['R. Chandra Sekhar', '+91 94910 44127', 'Male', 51, 'SC', 'Mala', 'Transport', 'Intermediate', 2012, 68, 110, '1 win', '1 criminal', 'District committee'],
  ['A. Vijaya Lakshmi', '+91 90000 61338', 'Female', 44, 'ST', 'Konda Dora', 'Farming', 'SSC', 2020, 60, 192, 'First time', 'None', 'Mandal in-charge'],
  ['J. Satyanarayana', '+91 94409 15772', 'Male', 46, 'BC', 'Gouda', 'Rice mill', 'Degree', 2016, 64, 129, '1 loss', 'None', 'Mandal in-charge'],
  ['Ch. Annapurna', '+91 90523 44810', 'Female', 42, 'SC', 'Madiga', 'Tailoring unit', 'Intermediate', 2018, 67, 181, 'First time', 'None', 'AC president'],
  ['K. Bhaskar Rao', '+91 97045 33261', 'Male', 55, 'General', '—', 'Contractor', 'Degree', 2010, 62, 104, '1 win · 2 losses', 'None', 'District committee'],
  ['M. Suvarna', '+91 96401 78539', 'Female', 35, 'ST', 'Savara', 'Dairy unit', 'SSC', 2021, 58, 166, 'First time', 'None', 'Mandal in-charge'],
  ['Y. Nageswara Rao', '+91 93912 60417', 'Male', 50, 'BC', 'Turpu Kapu', 'Agriculture', 'Intermediate', 2013, 71, 147, '1 win', 'None', 'AC president'],
  ['L. Rajeswari', '+91 98857 20936', 'Female', 37, 'General', '—', 'Medical shop', 'PG', 2019, 69, 158, 'First time', 'None', 'District committee'],
  ['P. Ravi Kumar', '+91 94931 55208', 'Male', 43, 'BC', 'Gouda', 'Poultry farm', 'Degree', 2017, 66, 138, 'First time', 'None', 'Mandal in-charge'],
  ['S. Manjula', '+91 90107 66413', 'Female', 40, 'SC', 'Mala', 'Teacher', 'PG', 2015, 73, 174, '1 win', 'None', 'AC president'],
  ['V. Ramana Murthy', '+91 98494 30852', 'Male', 52, 'General', '—', 'Advocate', 'LLB', 2009, 70, 112, '1 win · 1 loss', 'None', 'District committee'],
  ['K. Sarojini', '+91 93924 71065', 'Female', 34, 'ST', 'Konda Dora', 'Self-help group', 'Intermediate', 2020, 61, 189, 'First time', 'None', 'Mandal in-charge'],
  ['B. Srinivasulu', '+91 97046 28317', 'Male', 48, 'BC', 'Turpu Kapu', 'Hardware shop', 'SSC', 2014, 63, 126, '1 loss', 'None', 'Mandal in-charge'],
  ['N. Aruna Kumari', '+91 96183 40729', 'Female', 39, 'SC', 'Madiga', 'Anganwadi worker', 'Intermediate', 2018, 68, 183, 'First time', 'None', 'AC president'],
  ['G. Prakash Rao', '+91 94408 91574', 'Male', 56, 'General', '—', 'Retired bank staff', 'PG', 2008, 64, 95, '2 wins', 'None', 'District committee'],
  ['T. Lalitha', '+91 90005 27846', 'Female', 36, 'BC', 'Setti Balija', 'Kirana store', 'Degree', 2019, 67, 161, 'First time', 'None', 'Mandal in-charge'],
  ['M. Bhaskar', '+91 98661 13490', 'Male', 44, 'ST', 'Savara', 'Agriculture', 'SSC', 2016, 59, 151, 'First time', 'None', 'Mandal in-charge'],
  ['D. Swarna Latha', '+91 93481 60275', 'Female', 42, 'General', '—', 'Private school', 'PG', 2013, 71, 143, '1 win', 'None', 'AC president'],
  ['R. Naga Raju', '+91 97014 85632', 'Male', 47, 'SC', 'Mala', 'Auto union', 'Intermediate', 2012, 65, 167, '1 loss', '1 civil', 'District committee'],
  ['Ch. Padmavathi', '+91 90523 91408', 'Female', 38, 'BC', 'Yadava', 'Dairy unit', 'SSC', 2021, 62, 178, 'First time', 'None', 'Mandal in-charge'],
  ['A. Suresh Babu', '+91 94900 34718', 'Male', 45, 'BC', 'Gouda', 'Fertiliser shop', 'Degree', 2016, 64, 132, '1 loss', 'None', 'Mandal in-charge'],
  ['K. Vijaya Kumari', '+91 93915 82640', 'Female', 41, 'SC', 'Madiga', 'Government teacher', 'PG', 2014, 72, 171, '1 win', 'None', 'AC president'],
  ['S. Gopala Krishna', '+91 98485 27093', 'Male', 50, 'General', '—', 'Civil contractor', 'Degree', 2011, 67, 118, '1 win', 'None', 'District committee'],
  ['T. Kanaka Durga', '+91 90144 61385', 'Female', 37, 'ST', 'Savara', 'Self-help group', 'Intermediate', 2019, 63, 186, 'First time', 'None', 'Mandal in-charge'],
  ['M. Venkatesh', '+91 97018 49250', 'Male', 46, 'BC', 'Turpu Kapu', 'Transport', 'SSC', 2015, 65, 141, 'First time', 'None', 'Mandal in-charge'],
  ['P. Sridevi', '+91 99598 13476', 'Female', 35, 'SC', 'Mala', 'Tailoring unit', 'Degree', 2020, 69, 179, 'First time', 'None', 'AC president'],
  ['B. Ranga Rao', '+91 91773 50829', 'Male', 54, 'General', '—', 'Retired officer', 'PG', 2010, 66, 101, '2 wins', 'None', 'District committee'],
  ['V. Hymavathi', '+91 96524 07138', 'Female', 39, 'BC', 'Setti Balija', 'Medical shop', 'Degree', 2018, 70, 164, 'First time', 'None', 'Mandal in-charge'],
  ['N. Ramakrishna', '+91 93472 91560', 'Male', 48, 'ST', 'Konda Dora', 'Agriculture', 'Intermediate', 2013, 60, 148, '1 loss', 'None', 'AC president'],
  ['G. Sunitha', '+91 98668 42017', 'Female', 43, 'General', '—', 'Private college', 'PG', 2012, 71, 139, '1 win', 'None', 'District committee'],
  ['Y. Satish Kumar', '+91 94916 73084', 'Male', 42, 'SC', 'Madiga', 'Electrical works', 'SSC', 2017, 62, 159, 'First time', 'None', 'Mandal in-charge'],
  ['L. Bhavani', '+91 90006 25791', 'Female', 36, 'BC', 'Yadava', 'Dairy unit', 'Intermediate', 2021, 64, 182, 'First time', 'None', 'Mandal in-charge'],
  ['J. Harinath', '+91 94402 68135', 'Male', 51, 'General', '—', 'Rice trader', 'Degree', 2009, 68, 107, '1 win · 1 loss', '1 civil', 'District committee'],
  ['Ch. Sridhar', '+91 90528 71943', 'Male', 44, 'BC', 'Gouda', 'Cement dealer', 'SSC', 2015, 61, 124, 'First time', 'None', 'Mandal in-charge'],
  ['R. Padmaja', '+91 97012 34860', 'Female', 38, 'ST', 'Savara', 'Anganwadi worker', 'Intermediate', 2018, 66, 192, 'First time', 'None', 'AC president'],
  ['D. Kishore Babu', '+91 93918 40572', 'Male', 49, 'SC', 'Mala', 'Auto union', 'Intermediate', 2011, 63, 155, '1 loss', 'None', 'Mandal in-charge'],
  ['S. Gowri Devi', '+91 94933 71508', 'Female', 36, 'ST', 'Savara', 'Self-help group', 'Intermediate', 2020, 65, 177, 'First time', 'None', 'Mandal in-charge'],
  ['K. Ramulu Dora', '+91 90142 63819', 'Male', 47, 'ST', 'Konda Dora', 'Agriculture', 'SSC', 2014, 62, 143, 'First time', 'None', 'AC president'],
  ['M. Jayanthi', '+91 97046 91352', 'Female', 33, 'ST', 'Savara', 'Anganwadi worker', 'Intermediate', 2021, 64, 195, 'First time', 'None', 'Mandal in-charge'],
  ['T. Bhadraiah', '+91 98487 20614', 'Male', 51, 'ST', 'Konda Dora', 'Forest produce trade', 'SSC', 2012, 60, 131, '1 loss', 'None', 'District committee'],
  ['V. Ratnamala', '+91 93476 85029', 'Female', 38, 'ST', 'Savara', 'Dairy unit', 'SSC', 2018, 66, 169, 'First time', 'None', 'AC president'],
  ['G. Chinna Rao', '+91 96181 47530', 'Male', 44, 'ST', 'Konda Dora', 'Farming', 'Intermediate', 2016, 61, 154, 'First time', 'None', 'Mandal in-charge'],
  ['B. Kumari Devi', '+91 90527 39418', 'Female', 35, 'ST', 'Savara', 'Tailoring unit', 'Degree', 2019, 68, 188, 'First time', 'None', 'Mandal in-charge'],
  ['N. Simhachalam', '+91 97015 62873', 'Male', 49, 'ST', 'Konda Dora', 'Transport', 'SSC', 2013, 59, 127, '1 loss', 'None', 'AC president'],
]
const DOCS = [
  ['Form-1 · Nomination paper', 'Signed by candidate and proposer', true],
  ['Form-26 · Affidavit', 'Assets, liabilities and cases', true],
  ['Caste certificate', 'Needed for reserved seats only', false],
  ['Security deposit receipt', "Paid at the returning officer's counter", true],
]
const WORKERS = [['B. Anil Kumar', '2 hrs ago', 186], ['S. Padma', 'today', 154], ['T. Naresh', 'yesterday', 97]]
const NEXT = [['Add a name', true], ['Review & confirm', true], ['Upload nomination', true], ['Update Door to Door', true], ['Add win / loss', true], ['Add win / loss', true], ['View result', false]]
const nm = (k) => k + (k === 1 ? ' name' : ' names')
const lc = (k) => k + (k === 1 ? ' location' : ' locations')
// Each location carries the date its stage last moved, so "updated" reads as real activity.
const TODAY = new Date('2026-08-20T00:00:00')
const pad2 = (k) => (k < 10 ? '0' : '') + k
const iso = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
const addDays = (d, k) => new Date(d.getTime() + k * 86400000)
const fmtDate = (s) => {
  const d = new Date(s + 'T00:00:00')
  return d.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] + ' ' + d.getFullYear()
}
const LOC_DATE = (i) => iso(addDays(TODAY, -((i * 7 + (i % 5) * 3) % 74)))
// Each pending column names its own baseline, since the baseline stage itself isn't shown.
const PENDING_LABEL = ['', 'Not started', 'Started, not confirmed', 'Confirmed, not filed', 'Door to Door pending', 'Door to Door - 2 pending', 'Visited, result pending']
// The location-list filter speaks the stage's own language: done here / still pending here.
const FILTER_WORDS = [
  ['All locations', '', ''],
  ['All locations', 'Name received', 'Not started'],
  ['All locations', 'Confirmed', 'Awaiting confirmation'],
  ['All locations', 'Nomination filed', 'Papers pending'],
  ['All locations', 'Door to Door done', 'Door to Door pending'],
  ['All locations', 'Door to Door - 2 done', 'Door to Door - 2 pending'],
  ['All locations', 'Result declared', 'Result pending'],
]
// Who may put a name forward depends on the body and the tier of the post.
// Ward / member posts are proposed one level below the seat; chief and deputy posts at the seat's own level.
const WARD_POSTS = ['MPTC', 'ZPTC', 'Ward Member', 'Ward Councillor', 'Corporator']
const PROPOSERS = {
  'Gram Panchayat': { ward: ['Ward in-charge', 'Village committee president'], chief: ['Village committee president', 'Mandal president'] },
  'Mandal Parishad': { ward: ['Village committee president', 'Mandal president'], chief: ['Mandal president', 'Constituency in-charge'] },
  'Zilla Parishad': { ward: ['Mandal president', 'Constituency in-charge'], chief: ['District president', 'State committee'] },
  Municipality: { ward: ['Ward in-charge', 'Town president'], chief: ['Town president', 'Constituency in-charge'] },
  'Municipal Corporation': { ward: ['Division in-charge', 'City president'], chief: ['City president', 'District president'] },
}
const proposerFor = (body, position, seed) => {
  const set = PROPOSERS[body] || PROPOSERS['Mandal Parishad']
  const pair = WARD_POSTS.indexOf(position) >= 0 ? set.ward : set.chief
  return pair[seed % 2]
}
// The proposer belongs to the NAME, not the location: seeded once per (location, candidate)
// so the list and the comparison table always read the same value.
const propSeed = (li, c) => (li + POOL.indexOf(c)) % 2
// Exact integer partition — parts always sum back to the total, so PC and AC
// summaries never drift from the position total they were derived from.
const splitInt = (total, weights) => {
  const sum = weights.reduce((a, b) => a + b, 0)
  const raw = weights.map((w) => (total * w) / sum)
  const out = raw.map(Math.floor)
  let left = total - out.reduce((a, b) => a + b, 0)
  raw.map((v, i) => [v - out[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { out[i] += 1; left -= 1 } })
  return out
}
const PC_W = [9, 14, 11, 16, 12, 13, 12, 13]
const AC_W = [27, 24, 26, 23]
const fitsQ = (c, quota) => {
  const grp = quota.split(' · ')[0], woman = quota.indexOf('Woman') >= 0
  return (grp === 'General' || c[4] === grp) && (!woman || c[2] === 'Female')
}
// Names are allocated exclusively: one aspirant belongs to exactly one location.
const SEATS = (() => {
  const claimed = [], out = LOCS.map(() => [])
  const active = []
  LOCS.forEach((l, i) => { if (l[2] > 0) active.push(i) })
  const take = (i) => {
    const c = POOL.filter((x) => claimed.indexOf(x) < 0 && fitsQ(x, LOCS[i][1])).sort((a, b) => b[9] - a[9])[0]
    if (c) { claimed.push(c); out[i].push(c) }
    return !!c
  }
  const bad = POOL.filter((c) => !fitsQ(c, LOCS[2][1]))[0]
  if (bad && LOCS[2][2] > 0) { claimed.push(bad); out[2].push(bad) }
  active.slice()
    .sort((a, b) => POOL.filter((c) => fitsQ(c, LOCS[a][1])).length - POOL.filter((c) => fitsQ(c, LOCS[b][1])).length)
    .forEach(take)
  active.forEach((i) => { if (out[i].filter((c) => fitsQ(c, LOCS[i][1])).length < 2) take(i) })
  active.forEach((i) => { if (out[i].length < 3) take(i) })
  return out.map((cands, i) => cands.sort((a, b) => (fitsQ(b, LOCS[i][1]) ? 1 : 0) - (fitsQ(a, LOCS[i][1]) ? 1 : 0) || b[9] - a[9]))
})()

const ACCENT = T.teal

export default function Dashboard2() {
  const [state, setStateRaw] = useState({
    step: 0, detail: null, chip: 1, pc: 1, ac: 0, quota: 'All',
    drawer: null, compare: null, pick: null, chosen: {}, stages: {}, toast: null,
    extra: {}, docs: {}, results: {}, dates: {},
  })
  const setState = (patch) => setStateRaw((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }))

  const sum = (k) => ALL.reduce((s, r) => s + r[k], 0)
  const flash = (msg) => {
    setState({ toast: msg })
    setTimeout(() => setState({ toast: null }), 3000)
  }
  const openDetail = (r, body, chip) => setState({ detail: { r, body }, chip, step: CHIPS[chip][3], drawer: null, compare: null })
  const setStep = (i) => {
    const c = CHIPS.filter((x) => x[3] === i && x[2] > 0)[0]
    setState({ step: i, chip: c ? c[2] : 1, drawer: null, compare: null })
  }
  const key = (li) => state.pc + '-' + state.ac + '-' + li
  const stageOf = (li) => { const k = key(li); return state.stages[k] === undefined ? LOCS[li][2] : state.stages[k] }
  const candsFor = (li) => (SEATS[li] || []).concat(state.extra[key(li)] || [])
  // Any action stamps the location's "updated" date, so the range picker never hides fresh work.
  const dateOf = (li) => state.dates[key(li)] || LOC_DATE(li)
  const stamp = (k) => {
    const dates = Object.assign({}, state.dates)
    dates[k] = iso(TODAY)
    return dates
  }
  // Single source for a location's outcome: what the user recorded, else the seeded value.
  const resultOf = (li) => {
    const v = state.results[key(li)]
    if (v) return v
    return stageOf(li) >= 6 ? (li % 3 === 2 ? 'lost' : 'won') : null
  }

  const advance = (li, to, msg) => {
    const k = key(li)
    setState((prev) => {
      const stages = Object.assign({}, prev.stages)
      stages[k] = to
      const dates = Object.assign({}, prev.dates)
      dates[k] = iso(TODAY)
      return { stages, dates, drawer: null }
    })
    flash(msg + ' — ' + LOCS[li][0])
  }

  const proposeNames = (li) => {
    const k = key(li), quota = LOCS[li][1]
    const used = [].concat.apply([], Object.keys(state.extra).map((x) => state.extra[x]))
    const pickArr = POOL.filter((c) => used.indexOf(c) < 0 && SEATS.every((s) => s.indexOf(c) < 0) && fitsQ(c, quota))
      .sort((a, b) => b[9] - a[9]).slice(0, 2)
    if (!pickArr.length) {
      setState({ drawer: null })
      flash('No unassigned ' + quota + ' aspirant left — add one to the pool first')
      return
    }
    const extra = Object.assign({}, state.extra)
    extra[k] = (extra[k] || []).concat(pickArr)
    const stages = Object.assign({}, state.stages)
    stages[k] = 1
    setState({ extra, stages, dates: stamp(k), drawer: null })
    flash(nm(pickArr.length) + ' sent for review — ' + LOCS[li][0])
  }

  const docState = (li) => {
    const saved = state.docs[key(li)]
    if (saved) return saved
    return DOCS.map((d) => (stageOf(li) >= 3 ? true : d[2]))
  }
  const toggleDoc = (li, i) => {
    const k = key(li), cur = docState(li).slice()
    cur[i] = !cur[i]
    const docs = Object.assign({}, state.docs)
    docs[k] = cur
    setState({ docs })
  }
  const setResult = (li, win) => {
    const results = Object.assign({}, state.results)
    results[key(li)] = win ? 'won' : 'lost'
    setState({ results })
  }
  const chosenIdx = (li) => {
    const v = state.chosen[key(li)]
    if (v !== undefined) return v
    return stageOf(li) >= 2 && candsFor(li).length ? 0 : null
  }
  const leadOf = (li) => {
    const cands = candsFor(li), quota = LOCS[li][1], chosen = chosenIdx(li)
    if (!cands.length) return { c: null, tag: 'Empty', eligible: false }
    if (chosen !== null) return { c: cands[chosen], tag: 'Confirmed', eligible: fitsQ(cands[chosen], quota) }
    const el = cands.filter((c) => fitsQ(c, quota))
    if (el.length) return { c: el[0], tag: 'Top eligible · ' + el[0][9], eligible: true }
    return { c: cands[0], tag: 'No eligible name', eligible: false }
  }
  const confirmPick = () => {
    const li = state.compare, ci = state.pick
    if (li === null || ci === null) return
    const k = key(li), stage = Math.max(stageOf(li), 2)
    const chosen = Object.assign({}, state.chosen); chosen[k] = ci
    const stages = Object.assign({}, state.stages); stages[k] = stage
    setState({ chosen, stages, dates: stamp(k), compare: null, pick: null })
    flash(candsFor(li)[ci][0] + ' confirmed for ' + LOCS[li][0])
  }
  const closeDetail = () => setState({ detail: null, drawer: null, compare: null })
  const closeCompare = () => setState({ compare: null, pick: null })
  const closeDrawer = () => setState({ drawer: null })

  const st = state
  const step = st.step
  const accent = ACCENT

  const PROG = [['proposed', 'total'], ['confirmed', 'proposed'], ['noms', 'confirmed'], ['vloc', 'noms'], ['vloc2', 'vloc'], ['declared', 'vloc2']]

  const steps = STEPS.map(([name], i) => {
    const p = pc(sum(PROG[i][0]), sum(PROG[i][1])), cur = i === step, past = i < step
    return {
      name, mark: past ? '✓' : String(i + 1), barW: p + '%',
      barFg: cur ? accent : past ? '#9fc0bb' : '#c9d2cf',
      ring: cur || past ? accent : '#d7dedc', dotBg: cur ? accent : past ? '#e2efed' : '#fff',
      dotFg: cur ? '#fff' : past ? accent : '#a6b1ad', labelFg: cur ? T.ink : '#7d8a86',
      leftLine: i === 0 ? 'transparent' : i <= step ? accent : '#e2e7e5',
      rightLine: i === STEPS.length - 1 ? 'transparent' : i < step ? accent : '#e2e7e5',
      go: () => setStep(i),
    }
  })

  const colDefs = [
    [['Locations', 'total', T.ink, 0], ['Started', 'proposed', T.green, 1], ['Not started', '_np', T.red, 0], ['Proposal (names)', '_prop', T.amber, 1]],
    [['Started', 'proposed', T.amber, 1], ['Confirmed', 'confirmed', T.green, 2], ['Pending', '_cp', T.purple, 2]],
    [['Confirmed', 'confirmed', T.green, 2], ['Nomination filed', 'noms', T.teal, 3], ['Pending', '_fp', T.red, 3]],
    [['Total houses', 'houses', T.ink, 4], ['Visits', 'visited', T.blue, 4], ['Pending', 'hPending', T.red, 4]],
    [['Total houses', 'houses', T.ink, 5], ['Visits', 'visited2', '#164a9e', 5], ['Pending', 'hPending2', T.red, 5]],
    [['Declared', 'declared', T.purple, 6], ['Won', 'won', T.green, 6], ['Lost', 'lost', T.crim, 6]],
  ][step]

  const val = (r, k) => (k === '_np' ? r.total - r.proposed : k === '_cp' ? r.proposed - r.confirmed : k === '_fp' ? r.confirmed - r.noms : r[k])
  const show = (r, k) => (k === '_prop' ? n(Math.round(r.proposed * 2.4)) : n(val(r, k)))
  const mkRow = (r, body) => ({
    name: r.name, sub: r.sub,
    open: () => openDetail(r, body, CHIPS.filter((c) => c[3] === step && c[2] > 0)[0][2]),
    cells: colDefs.map(([label, k, tone, chip]) => ({
      v: show(r, k), tone,
      line: chip > 0 ? 'underline' : 'none', hint: 'Open ' + r.name + ' · ' + label,
      go: () => openDetail(r, body, chip || 1),
    })),
  })
  const groups = ROWS.map((g) => ({ title: g.body, accent: g.accent, firstCol: 'Position', meta: g.rows.length + ' positions', rows: g.rows.map((r) => mkRow(r, g.body)) }))
  const cnt = (names) => { let s = 0; ALL.forEach((r) => { if (names.indexOf(r.body) >= 0) s += r.proposed }); return n(s) }
  const PR = ['Mandal Parishad', 'Zilla Parishad'], LB = ['Gram Panchayat', 'Municipality', 'Municipal Corporation']
  const sections = [
    { title: 'A · Panchayat Raj elections', sub: 'Mandal & district tier', accent: T.teal, border: '#d3e5e2', headBorder: '#bcdcd7', bg: '#f6fbfa', count: cnt(PR), countLabel: 'candidates proposed', groups: groups.filter((g) => PR.indexOf(g.title) >= 0) },
    { title: 'B · Local body elections', sub: 'Panchayat / municipality / corporation', accent: T.crim, border: '#eed6dc', headBorder: '#e8c6ce', bg: '#fdf7f8', count: cnt(LB), countLabel: 'candidates proposed', groups: groups.filter((g) => LB.indexOf(g.title) >= 0) },
  ]

  // ---- detail-view derived state ----
  let chips = [], resCards = [], geoCols = [], pcRows = [], acRows = [], rows = []
  let cmp = { cands: [], attrs: [] }
  let dw = { timeline: [], facts: [] }
  let hasDrawer = false, hasCompare = false, listEmpty = false
  let dName = '', dBody = '', dPc = '', dAc = '', chipName = '', listTitle = '', listFoot = ''
  let showMetric = false, metricCol = '', docsList = [], resObj = {}, lfilters = []
  let d2d = { houses: '0', visited: '0', pct: 0, barW: '0%', workers: [] }
  let pcTotal = '', acTotal = '', geoNote = '', geoFoot = ''

  const d = st.detail
  if (d) {
    const r = d.r, pcName = PCS[st.pc][0], acName = PCS[st.pc][1][st.ac], chipDef = CHIPS[st.chip]

    chips = CHIPS.map(([label, k, , si, tone, note], i) => {
      const on = i === st.chip, isVisit = k === 'vloc' || k === 'vloc2'
      return {
        label, tone,
        value: n(r[k] === undefined ? r.total : r[k]),
        note: isVisit ? pc(k === 'vloc2' ? r.visited2 : r.visited, r.houses) + '% of houses covered' : note,
        border: on ? accent : '#e9edeb', bg: on ? '#f4faf9' : '#fff', labelFg: on ? accent : '#8a9793',
        arrow: i === CHIPS.length - 1 ? '' : '›', arrowFg: i < st.chip ? accent : '#cfd8d5',
        go: () => setState({ chip: i, step: si, drawer: null, compare: null }),
      }
    })

    resCards = QUOTAS.map(([label, share, tone]) => {
      const total = label === 'All' ? r.total : Math.max(1, Math.round(r.total * share))
      const isAll = label === 'All'
      const confirmed = label === 'All' ? r.confirmed : Math.round(total * 0.71)
      const on = st.quota === label
      return {
        label: isAll ? 'All locations' : label, tone, total: n(total),
        confirmed: n(confirmed), pending: n(total - confirmed),
        share: label === 'All' ? '100%' : Math.round(share * 100) + '%',
        barW: pc(confirmed, total) + '%',
        border: on ? accent : '#e9edeb', bg: on ? '#f4faf9' : '#fff',
        go: () => setState({ quota: label, drawer: null, compare: null }),
      }
    })

    const KEYS = CHIPS.map((c) => c[1])
    const SPL = {}
    KEYS.forEach((k) => { SPL[k] = splitInt(r[k] === undefined ? r.total : r[k], PC_W) })
    // Total, plus the stage being viewed — intermediate stages are noise here.
    const keepIdx = st.chip === 0 ? [0] : [0, st.chip]
    const visitStep = st.chip === 4 || st.chip === 5
    // Visit steps count houses, not locations, so the split is re-run on the house totals.
    if (visitStep) {
      SPL.total = splitInt(r.houses, PC_W)
      SPL[KEYS[st.chip]] = splitInt(st.chip === 4 ? r.visited : r.visited2, PC_W)
    }
    geoCols = keepIdx.map((i) => ({ label: i === 0 && visitStep ? 'Total houses' : CHIPS[i][0], fg: i === st.chip ? accent : '#8a9793' }))
      .concat(st.chip > 0 ? [{ label: visitStep ? 'Houses pending' : PENDING_LABEL[st.chip], fg: T.red }] : [])
    const geoCells = (spl, i) => {
      const cells = keepIdx.map((ki) => ({ v: n(spl[KEYS[ki]][i]), fg: ki === st.chip ? accent : T.ink, w: ki === st.chip ? '700' : '600' }))
      if (st.chip > 0) cells.push({ v: n(spl[KEYS[visitStep ? 0 : st.chip - 1]][i] - spl[KEYS[st.chip]][i]), fg: T.red, w: '600' })
      return cells
    }
    pcRows = PCS.map(([name, acs], i) => {
      const on = i === st.pc
      return {
        name: 'PC · ' + name, sub: acs.length + ' assembly segments',
        bg: on ? '#f4faf9' : '#fff', nameFg: on ? accent : T.ink,
        mark: on ? '▸' : '', cells: geoCells(SPL, i),
        go: () => setState({ pc: i, ac: 0, drawer: null, compare: null }),
      }
    })
    const acSpl = {}
    KEYS.forEach((k) => { acSpl[k] = splitInt(SPL[k][st.pc], AC_W) })
    acRows = PCS[st.pc][1].map((an, j) => {
      const on = j === st.ac
      return {
        name: 'AC · ' + an, sub: 'in PC · ' + PCS[st.pc][0],
        bg: on ? '#f4faf9' : '#fff', nameFg: on ? accent : T.ink,
        mark: on ? '▸' : '', cells: geoCells(acSpl, j),
        go: () => setState({ ac: j, drawer: null, compare: null }),
      }
    })
    geoNote = 'Highlighted column = ' + chipDef[0]
    geoFoot = visitStep
      ? 'House counts come from the field app; Total houses = visits + pending.'
      : 'Each column adds up down the eight rows to the position total.'
    const unit = visitStep ? ' houses' : ' locations'
    pcTotal = n(visitStep ? r.houses : r.total) + unit + ' across 8 parliament constituencies'
    acTotal = n(SPL.total[st.pc]) + unit + ' in PC · ' + PCS[st.pc][0]

    const level = chipDef[2]
    const lf = st.lfilter || 'all'
    const idxs = []
    LOCS.forEach((l, i) => {
      const q = st.quota === 'All' || l[1].indexOf(st.quota) >= 0
      if (!q) return
      const s = stageOf(i)
      // Scoped to the stage being viewed: nothing already past it.
      if (level > 0 && s > level) return
      // "pending" = waiting AT this stage (its immediate predecessor), not the whole backlog.
      if (lf === 'done' && s < level) return
      if (lf === 'pending' && s !== level - 1) return
      if (lf === 'behind' && s >= level - 1) return
      idxs.push(i)
    })
    const words = FILTER_WORDS[level]
    const tally = { all: 0, done: 0, pending: 0, behind: 0 }
    LOCS.forEach((l, i) => {
      if (st.quota !== 'All' && l[1].indexOf(st.quota) < 0) return
      const s = stageOf(i)
      if (level > 0 && s > level) return
      tally.all += 1
      if (s >= level) tally.done += 1
      else if (s === level - 1) tally.pending += 1
      else tally.behind += 1
    })
    const cur = lf
    const chipDefs = level === 0
      ? [['all', words[0]]]
      : [['all', words[0]], ['done', words[1]], ['pending', words[2]]].concat(level > 1 && tally.behind ? [['behind', 'Not yet at this stage']] : [])
    lfilters = chipDefs.map(([fkey, label]) => ({
      label: label + ' (' + tally[fkey] + ')',
      go: () => setState({ lfilter: fkey, drawer: null, compare: null }),
      border: cur === fkey ? accent : '#dfe4e2',
      bg: cur === fkey ? '#f1f7f6' : '#fff',
      fg: cur === fkey ? accent : T.mute,
    }))
    const terminal = level === CHIPS.length - 1

    rows = idxs.map((i) => {
      const l = LOCS[i], stage = stageOf(i), sty = SS[STAGES[stage]], cands = candsFor(i), nx = NEXT[stage]
      const chosen = chosenIdx(i), ld = leadOf(i), lead = ld.c
      const named = !!lead, warn = named && !ld.eligible, rr = resultOf(i)
      const houses = 1180 + i * 140, part = Math.round(houses * (0.52 + (i % 4) * 0.08))
      const v1 = stage >= 4 ? houses : stage === 3 ? part : 0
      const v2 = stage >= 5 ? houses : stage === 4 ? Math.round(houses * 0.48) : 0
      return {
        name: l[0], sub: 'Mandal · ' + l[0].split(' (')[0] + ' · updated ' + fmtDate(dateOf(i)), quota: l[1],
        namesLabel: !named ? 'No name yet' : chosen !== null ? nm(cands.length) + ' · 1 confirmed' : nm(cands.length),
        idleDays: Math.round((TODAY - new Date(dateOf(i) + 'T00:00:00')) / 86400000) + ' days idle',
        owner: proposerFor(d.body, r.name, propSeed(i, POOL[i % POOL.length])),
        leadTag: ld.tag,
        leadBg: chosen !== null ? SS.Confirmed[0] : warn ? SS['Not started'][0] : stage === 0 ? SS['Not started'][0] : '#f1f4f3',
        leadFg: chosen !== null ? SS.Confirmed[1] : warn ? SS['Not started'][1] : stage === 0 ? SS['Not started'][1] : T.mute,
        leadName: !named ? 'Assign a name to start' : (chosen !== null ? 'Confirmed candidate: ' : 'Leading: ') + lead[0] + ' · ' + lead[4] + ' · ' + lead[2],
        stage: STAGES[stage], pillBg: sty[0], pillFg: sty[1],
        metric: step === 3 || step === 4
          ? n(step === 4 ? v2 : v1) + ' / ' + n(houses)
          : step === 5 ? (rr ? (rr === 'won' ? 'WON · +' : 'LOSS · −') + n(640 + i * 55) : '—')
          : named ? String(cands.length) : '—',
        metricTone: step === 5 && rr ? (rr === 'won' ? T.green : T.crim) : T.mute,
        // Viewing the optional second-visit step offers that action directly from the list.
        btn: stage === 0 ? '—' : (step === 4 && stage === 4 ? 'Update Door to Door - 2' : nx[0]),
        btnBorder: stage === 0 ? 'transparent' : nx[1] ? accent : '#dfe4e2',
        btnBg: stage === 0 ? 'transparent' : nx[1] ? accent : '#fff',
        btnFg: stage === 0 ? '#c9d2cf' : nx[1] ? '#fff' : T.mute,
        compare: () => (cands.length ? setState({ compare: i, pick: chosenIdx(i) }) : setState({ drawer: i })),
        go: () => (stage === 1 && cands.length
          ? setState({ compare: i, pick: chosenIdx(i) })
          : (step === 4 && stage === 4 ? advance(i, 5, 'Door to Door - 2 marked complete') : setState({ drawer: i }))),
      }
    })

    const ci = st.compare
    if (ci !== null && ci !== undefined) {
      const l = LOCS[ci], cands = candsFor(ci), stage = stageOf(ci), chosen = chosenIdx(ci)
      const elig = cands.filter((c) => fitsQ(c, l[1]))
      const many = elig.length > 1
      const best = (k) => Math.max.apply(null, elig.map((c) => c[k]))
      const oldest = (k) => Math.min.apply(null, elig.map((c) => c[k]))
      const top = (c, k) => fitsQ(c, l[1]) && c[k] === best(k)
      const cell = (v, tone, isBest) => ({ v, tone: tone || T.ink, best: many && isBest ? 'BEST' : '' })
      const locked = stage >= 2
      cmp = {
        crumb: r.name + ' · ' + d.body + ' · AC ' + acName,
        title: l[0] + ' — ' + nm(cands.length) + ' proposed',
        help: locked
          ? 'Location reserved for ' + l[1] + '. A candidate is already confirmed — this comparison is read-only.'
          : 'Location reserved for ' + l[1] + '. Pick one name; the others stay on record as not selected.',
        cands: cands.map((c, j) => {
          const on = (st.pick === j && !locked) || (locked && chosen === j), fit = fitsQ(c, l[1])
          return {
            name: c[0], phone: c[1], score: c[9],
            border: on ? accent : '#e9edeb', bg: on ? '#f4faf9' : '#fff',
            dotRing: on ? accent : '#cfd8d5', dotFill: on ? accent : '#fff',
            fit: fit ? 'Eligible for ' + l[1] : 'Does not fit ' + l[1],
            fitBg: fit ? SS.Confirmed[0] : SS['Not started'][0], fitFg: fit ? SS.Confirmed[1] : SS['Not started'][1],
            state: chosen === j ? 'Currently confirmed' : chosen === null ? 'Proposed' : 'Not selected',
            stateBg: chosen === j ? '#e9f3f2' : '#f1f4f3', stateFg: chosen === j ? '#0a5b53' : T.mute,
            pick: () => { if (!locked) setState({ pick: j }) },
          }
        }),
        attrs: [
          { label: 'Reservation fit', cells: cands.map((c) => cell(fitsQ(c, l[1]) ? '✓ Eligible' : '✕ Not eligible', fitsQ(c, l[1]) ? T.green : T.red, false)) },
          { label: 'Party score', cells: cands.map((c) => cell(String(c[9]), T.ink, top(c, 9))) },
          { label: 'Caste / sub-caste', cells: cands.map((c) => cell(c[4] + ' · ' + c[5])) },
          { label: 'Gender · age', cells: cands.map((c) => cell(c[2] + ' · ' + c[3])) },
          { label: 'Occupation', cells: cands.map((c) => cell(c[6])) },
          { label: 'Education', cells: cands.map((c) => cell(c[7])) },
          { label: 'Member since', cells: cands.map((c) => cell(String(c[8]), T.ink, fitsQ(c, l[1]) && c[8] === oldest(8))) },
          { label: 'Booth work (houses)', cells: cands.map((c) => cell(n(c[10]), T.ink, top(c, 10))) },
          { label: 'Past contests', cells: cands.map((c) => cell(c[11])) },
          { label: 'Pending cases', cells: cands.map((c) => cell(c[12], c[12] === 'None' ? T.green : T.red)) },
        ].map((a, i2) => Object.assign(a, { rowBg: i2 % 2 ? '#fbfcfc' : '#fff' })),
        foot: locked
          ? cands[chosen][0] + ' is confirmed for this location. Changing the candidate needs a district approval request.'
          : st.pick === null || st.pick === undefined
            ? 'Select one name above to enable confirmation.'
            : (fitsQ(cands[st.pick], l[1]) ? '' : '⚠ ') + cands[st.pick][0] + (fitsQ(cands[st.pick], l[1]) ? ' will be confirmed for this location.' : " does not match this location's reservation — confirming needs district approval."),
        btnLabel: locked ? 'Already confirmed' : 'Confirm candidate',
        btnBg: locked || st.pick === null || st.pick === undefined ? '#e6ebe9' : accent,
        btnFg: locked || st.pick === null || st.pick === undefined ? '#7d8a86' : '#fff',
        btnCursor: locked || st.pick === null || st.pick === undefined ? 'default' : 'pointer',
        confirmGo: () => { if (!locked) confirmPick() },
      }
    }
    hasCompare = ci !== null && ci !== undefined

    const di = st.drawer
    const li = di === null || di === undefined ? null : di
    if (li !== null) {
      const l = LOCS[li], stage = stageOf(li), cands = candsFor(li), chosen = chosenIdx(li)
      const c = leadOf(li).c || ['—', '—', '—', '—', '—', '—', '—', '—', '—', 0, 0, '—', '—']
      const ACTS = [
        ['Add a name for this location', 'No name has gone up for this location yet. Add aspirants, then compare them.', 'Send name for review', 'Name sent for review — '],
        ['Review the names and confirm one', 'More than one name is on this location. Compare them side by side before confirming.', 'Compare the names', 'Comparison opened — '],
        ['Upload the nomination papers', 'Candidate is confirmed. Upload the filed papers so the district office can verify before the deadline.', 'Save as nomination filed', 'Nomination marked as filed — '],
        ['Update Door to Door progress', 'Papers are filed. Door to Door visits are the live work on this location now.', 'Mark Door to Door complete', 'Door to Door marked complete — '],
        ['Add the win or loss', 'Visits are covered. Record the outcome, or run the optional second visit first.', 'Save win / loss', 'Result saved — '],
        ['Add the win or loss', 'Visits are covered. Record the declared outcome — mandal-level users only.', 'Save win / loss', 'Result saved — '],
        ['Everything is complete', 'Result is declared for this location. Nothing further to do here.', 'View result sheet', 'Result sheet opened — '],
      ]
      const act = ACTS[stage]
      const note = stage > step + 1 ? 'This location is already past step ' + (step + 1) + '. ' : stage < step ? 'This location has not reached step ' + (step + 1) + ' yet. ' : ''
      dw = {
        loc: l[0] + ' · AC ' + acName, name: stage === 0 ? 'No candidate yet' : c[0],
        role: r.name + ' · ' + d.body + ' · location reserved for ' + l[1], phone: stage === 0 ? '—' : c[1],
        stage: STAGES[stage], pillBg: SS[STAGES[stage]][0], pillFg: SS[STAGES[stage]][1],
        compareLabel: cands.length ? (cands.length === 1 ? 'View the 1 name on this location' : 'Compare all ' + cands.length + ' names on this location') : 'No names on this location yet',
        compareGo: () => { if (cands.length) setState({ compare: li, pick: chosen, drawer: null }) },
        timeline: STAGES.slice(1).map((label, i) => {
          const done = i < stage - 1, cur = i === stage - 1
          return {
            label, mark: done ? '✓' : '', ring: done || cur ? accent : '#d7dedc',
            fill: done ? accent : cur ? '#e2efed' : '#fff', line: i < stage - 1 ? accent : '#e2e7e5',
            fg: cur ? T.ink : done ? '#3d4a46' : '#a6b1ad',
            note: done ? 'Done' : cur ? 'Current stage' : 'Not reached yet',
          }
        }),
        facts: [['Profile', c[2] + ' · ' + c[3] + ' · ' + c[4]], ['Occupation', c[6]], ['Education', c[7]], ['Member since', String(c[8])], ['Reserved for', l[1]], ['Names on location', String(cands.length)]].map(([k, v]) => ({ k, v })),
        actionStep: stage === 6 ? 'Complete' : 'Next · step ' + (stage + 1),
        actionTitle: act[0], actionHelp: note + act[1],
        isDocs: stage === 2, isD2d: stage === 3 || stage === 4, isResult: stage >= 5,
        primary: act[2], primaryBg: stage === 6 ? '#e6ebe9' : accent, primaryFg: stage === 6 ? '#7d8a86' : '#fff',
        primaryGo: () => {
          if (stage === 0) { proposeNames(li); return }
          if (stage === 1) { setState({ compare: li, pick: chosen, drawer: null }); return }
          if (stage === 2) {
            if (docState(li).indexOf(false) >= 0) { flash('Upload the pending papers first — ' + l[0]); return }
            advance(li, 3, 'Nomination marked as filed'); return
          }
          if (stage === 3) { advance(li, 4, 'Door to Door marked complete'); return }
          if (stage === 4 || stage === 5) {
            const rr = state.results[key(li)]
            if (!rr) { flash('Pick won or lost first — ' + l[0]); return }
            advance(li, 6, rr === 'won' ? 'Recorded as WON' : 'Recorded as LOSS'); return
          }
          setState({ drawer: null }); flash(act[3] + l[0])
        },
      }
    }
    hasDrawer = li !== null

    const dStage = li === null ? 0 : stageOf(li)
    const dRound = dStage >= 4 ? 2 : 1
    const houses2 = 1180 + (li || 0) * 140
    const visited2v = dRound === 2 ? (dStage >= 5 ? houses2 : Math.round(houses2 * 0.48)) : (dStage >= 4 ? houses2 : Math.round(houses2 * 0.62))

    dName = r.name; dBody = d.body; dPc = pcName; dAc = acName; chipName = chipDef[0]
    listTitle = r.name + ' · PC ' + pcName + ' · AC ' + acName
    listFoot = (level === 0
      ? 'Every location in this position, whatever stage it has reached.'
      : cur === 'done'
        ? (terminal
            ? 'Locations whose result is already declared — nothing further to do on these.'
            : 'Locations that have completed “' + CHIPS[level][0] + '”.')
        : cur === 'pending'
          ? (level === 5
              ? 'Locations pending the second visit round. Counts come from a separate field source, so they differ from round 1.'
              : 'Locations waiting at this stage — next action “' + NEXT[level - 1][0] + '”.')
          : cur === 'behind'
            ? 'Locations still short of this stage, each with its own next action.'
            : 'Every location up to this stage, with its own next action. Locations already past it are hidden.')
      + ' AC · ' + acName + ', reservation ' + st.quota + '.'
    listEmpty = rows.length === 0
    showMetric = step >= 3
    metricCol = step === 3 || step === 4 ? 'Visits / total houses' : 'Margin'
    docsList = li === null ? [] : DOCS.map(([name, note], i) => {
      const ok = docState(li)[i]
      return { name, note, mark: ok ? '✓' : '!', state: ok ? 'Uploaded' : 'Upload', tone: ok ? T.green : T.red, go: () => toggleDoc(li, i) }
    })
    resObj = li === null ? {} : (() => {
      const rr = resultOf(li), locked = stageOf(li) >= 6
      const on = (k, c) => ({ border: rr === k ? c : '#e2e7e5', bg: rr === k ? (k === 'won' ? '#f3faf5' : '#fdf3f5') : '#fff', fg: rr === k ? c : '#9aa5a1', w: rr === k ? '1.5px' : '1px' })
      return {
        won: on('won', '#1c7a45'), lost: on('lost', '#b3123b'),
        note: locked
          ? (rr === 'won' ? 'Recorded as WON — declared result, read-only.' : 'Recorded as LOSS — declared result, read-only.')
          : 'Pick one, then save.',
        wonGo: () => { if (!locked) setResult(li, true) },
        lostGo: () => { if (!locked) setResult(li, false) },
      }
    })()
    d2d = { houses: n(houses2), visited: n(visited2v), pct: pc(visited2v, houses2), barW: pc(visited2v, houses2) + '%', workers: WORKERS.map(([wn, last, hh]) => ({ name: wn, last, houses: n(hh) })) }
  }

  return (
    <div className="leap-dash2">
      <style>{DASH2_CSS}</style>
      <div style={sx('max-width:1440px;margin:0 auto;padding:0 0 70px;font-variant-numeric:tabular-nums;position:relative')}>

        <div style={sx('padding:24px 40px 20px;background:#fff;border-bottom:1px solid #dfe4e2')}>
          <div style={sx('display:flex;align-items:flex-end;justify-content:space-between;gap:32px;flex-wrap:wrap')}>
            <div>
              <div style={sx(`font:600 11px/1 'IBM Plex Sans';letter-spacing:.16em;text-transform:uppercase;color:#8a9793;margin-bottom:8px`)}>Party Core Dashboard</div>
              <h1 style={sx(`margin:0;font:700 29px/1.1 'Bitter',Georgia,serif`)}>Local Body Election</h1>
              <div style={sx(`margin-top:7px;font:400 13px/1.4 'IBM Plex Sans';color:#6b7873`)}>One location per row, all its names compared side by side. Steps, numbers and reservation all filter the same list.</div>
            </div>
            <div style={sx('display:flex;align-items:center;gap:10px')}>
              <div style={sx(`font:500 11.5px/1 'IBM Plex Sans';color:#8a9793;padding:10px 12px;border:1px solid #dfe4e2;border-radius:7px;white-space:nowrap`)}>Andhra Pradesh · 2026</div>
            </div>
          </div>
        </div>

        <div style={sx('padding:22px 40px 0')}>
          <div style={sx('background:#fff;border:1px solid #dfe4e2;border-radius:10px;padding:20px 24px 18px')}>
            <div style={sx('display:flex;align-items:flex-start;flex-wrap:wrap;gap:8px')}>
              {steps.map((s, i) => (
                <div key={i} style={sx('flex:1;display:flex;flex-direction:column;min-width:110px')}>
                  <div style={sx('display:flex;align-items:center;height:30px')}>
                    <div style={sx(`flex:1;height:2px;background:${s.leftLine}`)} />
                    <button type="button" onClick={s.go} style={sx(`width:30px;height:30px;flex:none;border-radius:50%;cursor:pointer;border:2px solid ${s.ring};background:${s.dotBg};color:${s.dotFg};font:700 12.5px/1 'IBM Plex Sans';display:flex;align-items:center;justify-content:center`)}>{s.mark}</button>
                    <div style={sx(`flex:1;height:2px;background:${s.rightLine}`)} />
                  </div>
                  <div style={sx('text-align:center;padding:9px 10px 0')}>
                    <div style={sx(`font:600 12.5px/1.25 'IBM Plex Sans';color:${s.labelFg}`)}>{s.name}</div>
                    <div style={sx('margin:9px auto 0;width:76px;height:3px;border-radius:2px;background:#e6eae8;overflow:hidden')}>
                      <div style={sx(`height:3px;border-radius:2px;background:${s.barFg};width:${s.barW}`)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={sx('padding:24px 40px 0')}>
          <div style={sx('display:flex;align-items:baseline;gap:13px')}>
            <div style={sx(`font:600 11px/1 'IBM Plex Sans';letter-spacing:.16em;text-transform:uppercase;color:#0d7a6f`)}>Step {step + 1}</div>
            <h2 style={sx(`margin:0;font:600 21px/1.2 'Bitter',Georgia,serif`)}>{STEPS[step][0]}</h2>
          </div>
          <div style={sx(`margin-top:6px;font:400 13.5px/1.5 'IBM Plex Sans';color:#6b7873;max-width:820px`)}>{STEPS[step][1]}</div>
        </div>

        {!st.detail && (
          <div style={sx('padding:18px 40px 0;display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap')}>
            {sections.map((sec, si) => (
              <div key={si} style={sx(`flex:1;min-width:320px;border:1px solid ${sec.border};border-radius:12px;background:${sec.bg};padding:14px`)}>
                <div style={sx(`display:flex;align-items:center;justify-content:space-between;gap:20px;padding:13px 16px;margin-bottom:14px;border:1px solid ${sec.headBorder};border-radius:9px;background:#fff`)}>
                  <div>
                    <div style={sx(`font:700 13px/1 'IBM Plex Sans';letter-spacing:.09em;text-transform:uppercase;color:${sec.accent}`)}>{sec.title}</div>
                    <div style={sx(`margin-top:6px;font:400 12px/1.3 'IBM Plex Sans';color:#8a9793`)}>{sec.sub}</div>
                  </div>
                </div>
                <div style={sx('display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start')}>
                  {sec.groups.map((g, gi) => (
                    <div key={gi} style={sx('flex:1 1 100%;min-width:0;background:#fff;border:1px solid #dfe4e2;border-radius:10px;overflow:hidden')}>
                      <div style={sx('display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #e9edeb')}>
                        <div style={sx('display:flex;align-items:center;gap:10px')}>
                          <div style={sx(`width:3px;height:16px;border-radius:2px;background:${g.accent}`)} />
                          <div style={sx(`font:600 13px/1 'IBM Plex Sans';letter-spacing:.05em;text-transform:uppercase`)}>{g.title}</div>
                        </div>
                        <div style={sx(`font:500 11.5px/1 'IBM Plex Sans';color:#8a9793`)}>{g.meta}</div>
                      </div>
                      <div style={sx('display:flex;align-items:center;padding:9px 18px;background:#f7f9f8;border-bottom:1px solid #e9edeb')}>
                        <div style={sx(`flex:1.7;font:600 10px/1.2 'IBM Plex Sans';letter-spacing:.12em;text-transform:uppercase;color:#8a9793`)}>{g.firstCol}</div>
                        {colDefs.map(([label], ci3) => (
                          <div key={ci3} style={sx(`flex:1;text-align:right;font:600 10px/1.2 'IBM Plex Sans';letter-spacing:.1em;text-transform:uppercase;color:#8a9793`)}>{label}</div>
                        ))}
                      </div>
                      {g.rows.map((r, ri) => (
                        <div key={ri} onClick={r.open} className="d2-geo-row" style={sx('display:flex;align-items:center;padding:12px 18px;border-bottom:1px solid #f0f3f2;cursor:pointer')}>
                          <div style={sx('flex:1.7;min-width:0')}>
                            <div style={sx(`font:600 13px/1.25 'IBM Plex Sans';color:#0d7a6f`)}>{r.name}</div>
                            <div style={sx(`font:400 11px/1.3 'IBM Plex Sans';color:#9aa5a1;margin-top:2px`)}>{r.sub}</div>
                          </div>
                          {r.cells.map((cell, cei) => (
                            <div key={cei} style={sx(`flex:1;text-align:right;font:700 13.5px/1.2 'IBM Plex Sans';color:${cell.tone}`)}>{cell.v}</div>
                          ))}
                        </div>
                      ))}
                      <div style={sx(`padding:11px 18px;background:#fafbfb;font:400 11.5px/1.4 'IBM Plex Sans';color:#9aa5a1`)}>Click a position name to open its locations.</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!!st.detail && (
          <div style={sx('padding:18px 40px 0')}>

            <div style={sx('display:flex;align-items:center;gap:14px;background:#fff;border:1px solid #dfe4e2;border-radius:10px;padding:13px 18px;margin-bottom:14px;flex-wrap:wrap')}>
              <button type="button" className="d2-btn" onClick={closeDetail} style={sx(`cursor:pointer;flex:none;white-space:nowrap;font:600 11px/1 'IBM Plex Sans';letter-spacing:.09em;text-transform:uppercase;padding:9px 13px;border-radius:6px;border:1px solid #dfe4e2;background:#fff;color:#6b7873`)}>← All positions</button>
              <div style={sx(`display:flex;align-items:center;gap:9px;flex-wrap:wrap;font:500 12.5px/1 'IBM Plex Sans';color:#8a9793`)}>
                <span style={sx('font-weight:700;color:#1a2422;font-size:14px')}>{dName}</span>
                <span>·</span><span>{dBody}</span>
                <span style={sx('color:#c9d2cf')}>/</span><span>PC · {dPc}</span>
                <span style={sx('color:#c9d2cf')}>/</span><span>AC · {dAc}</span>
                <span style={sx('color:#c9d2cf')}>/</span><span style={sx('color:#0d7a6f;font-weight:600')}>Step {step + 1} · {chipName}</span>
              </div>
            </div>

            <div style={sx('background:#fff;border:1px solid #dfe4e2;border-radius:10px;padding:15px 18px 17px;margin-bottom:14px')}>
              <div style={sx(`font:600 10.5px/1 'IBM Plex Sans';letter-spacing:.13em;text-transform:uppercase;color:#8a9793;margin-bottom:12px`)}>Where the {dName} locations stand — click a stage to move the step above and filter the list below</div>
              <div style={sx('display:flex;align-items:stretch;flex-wrap:wrap;gap:6px')}>
                {chips.map((c, i) => (
                  <div key={i} style={sx('display:flex;align-items:center;flex:1;min-width:130px')}>
                    <button type="button" className="d2-card" onClick={c.go} style={sx(`flex:1;min-width:0;cursor:pointer;text-align:left;padding:13px 14px;border-radius:9px;border:1.5px solid ${c.border};background:${c.bg}`)}>
                      <div style={sx(`font:600 10px/1.2 'IBM Plex Sans';letter-spacing:.1em;text-transform:uppercase;color:${c.labelFg}`)}>{c.label}</div>
                      <div style={sx(`margin-top:8px;font:700 20px/1 'IBM Plex Sans';color:${c.tone}`)}>{c.value}</div>
                      <div style={sx(`margin-top:6px;font:500 10.5px/1.2 'IBM Plex Sans';color:#9aa5a1`)}>{c.note}</div>
                    </button>
                    <div style={sx(`flex:none;width:16px;text-align:center;font:600 13px/1 'IBM Plex Sans';color:${c.arrowFg}`)}>{c.arrow}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={sx('background:#fff;border:1px solid #dfe4e2;border-radius:10px;padding:15px 18px 17px;margin-bottom:14px')}>
              <div style={sx('display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:12px')}>
                <div style={sx(`font:600 10.5px/1 'IBM Plex Sans';letter-spacing:.13em;text-transform:uppercase;color:#8a9793`)}>Reservation summary — click a quota to filter the locations below</div>
                <div style={sx(`font:400 11.5px/1 'IBM Plex Sans';color:#9aa5a1`)}>Women is a cross-cutting quota, so it overlaps the others</div>
              </div>
              <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:11px')}>
                {resCards.map((q, i) => (
                  <button type="button" key={i} className="d2-card" onClick={q.go} style={sx(`cursor:pointer;text-align:left;border:1.5px solid ${q.border};border-radius:9px;padding:12px 13px 11px;background:${q.bg}`)}>
                    <div style={sx('display:flex;align-items:center;justify-content:space-between')}>
                      <div style={sx(`font:700 12px/1 'IBM Plex Sans';letter-spacing:.06em;color:${q.tone}`)}>{q.label}</div>
                      <div style={sx(`font:500 10.5px/1 'IBM Plex Sans';color:#9aa5a1`)}>{q.share}</div>
                    </div>
                    <div style={sx(`margin-top:10px;font:700 20px/1 'IBM Plex Sans'`)}>{q.total}</div>
                    <div style={sx('margin-top:7px;height:4px;border-radius:2px;background:#eceff0;overflow:hidden')}><div style={sx(`height:4px;background:${q.tone};width:${q.barW}`)} /></div>
                    <div style={sx(`margin-top:8px;display:flex;justify-content:space-between;font:500 10.5px/1.3 'IBM Plex Sans'`)}><span style={sx('color:#1c7a45')}>{q.confirmed} conf.</span><span style={sx('color:#c0392b')}>{q.pending} left</span></div>
                  </button>
                ))}
              </div>
            </div>

            <div style={sx('background:#fff;border:1px solid #dfe4e2;border-radius:10px;overflow:hidden;margin-bottom:14px')}>
              <div style={sx('display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 18px;border-bottom:1px solid #e9edeb;flex-wrap:wrap')}>
                <div style={sx('display:flex;align-items:center;gap:10px')}>
                  <div style={sx('width:3px;height:16px;border-radius:2px;background:#0d7a6f')} />
                  <div style={sx(`font:600 13px/1 'IBM Plex Sans';letter-spacing:.05em;text-transform:uppercase`)}>Parliament constituency wise</div>
                </div>
                <div style={sx('display:flex;align-items:baseline;gap:12px')}>
                  <div style={sx(`font:400 11.5px/1 'IBM Plex Sans';color:#9aa5a1`)}>{pcTotal}</div>
                  <div style={sx(`font:500 11px/1 'IBM Plex Sans';color:#0d7a6f`)}>{geoNote}</div>
                </div>
              </div>
              <div style={sx('display:flex;padding:9px 18px;background:#f7f9f8;border-bottom:1px solid #e9edeb')}>
                <div style={sx(`flex:1.9;font:600 10px/1.2 'IBM Plex Sans';letter-spacing:.11em;text-transform:uppercase;color:#8a9793`)}>Parliament constituency</div>
                {geoCols.map((c, i) => (
                  <div key={i} style={sx(`flex:1;text-align:right;font:600 9.5px/1.25 'IBM Plex Sans';letter-spacing:.08em;text-transform:uppercase;color:${c.fg}`)}>{c.label}</div>
                ))}
              </div>
              {pcRows.map((g, i) => (
                <div key={i} onClick={g.go} className="d2-geo-row" style={sx(`display:flex;align-items:center;padding:11px 18px;border-bottom:1px solid #f0f3f2;cursor:pointer;background:${g.bg}`)}>
                  <div style={sx('flex:1.9;min-width:0;display:flex;align-items:baseline;gap:7px')}>
                    <div style={sx(`flex:none;width:9px;font:700 10px/1.4 'IBM Plex Sans';color:#0d7a6f`)}>{g.mark}</div>
                    <div style={sx('min-width:0')}>
                      <div style={sx(`font:700 12.5px/1.25 'IBM Plex Sans';color:${g.nameFg}`)}>{g.name}</div>
                      <div style={sx(`font:400 10.5px/1.3 'IBM Plex Sans';color:#9aa5a1;margin-top:2px`)}>{g.sub}</div>
                    </div>
                  </div>
                  {g.cells.map((cell, ci4) => (
                    <div key={ci4} style={sx(`flex:1;text-align:right;font:${cell.w} 12.5px/1.2 'IBM Plex Sans';color:${cell.fg}`)}>{cell.v}</div>
                  ))}
                </div>
              ))}
              <div style={sx(`padding:11px 18px;background:#fafbfb;font:400 11.5px/1.4 'IBM Plex Sans';color:#9aa5a1`)}>{geoFoot} Click a row to load its assembly segments below.</div>
            </div>

            <div style={sx('background:#fff;border:1px solid #dfe4e2;border-radius:10px;overflow:hidden;margin-bottom:14px')}>
              <div style={sx('display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 18px;border-bottom:1px solid #e9edeb;flex-wrap:wrap')}>
                <div style={sx('display:flex;align-items:center;gap:10px')}>
                  <div style={sx('width:3px;height:16px;border-radius:2px;background:#b3123b')} />
                  <div style={sx(`font:600 13px/1 'IBM Plex Sans';letter-spacing:.05em;text-transform:uppercase`)}>Assembly constituency wise — {dPc}</div>
                </div>
                <div style={sx('display:flex;align-items:baseline;gap:12px')}>
                  <div style={sx(`font:400 11.5px/1 'IBM Plex Sans';color:#9aa5a1`)}>{acTotal}</div>
                  <div style={sx(`font:500 11px/1 'IBM Plex Sans';color:#0d7a6f`)}>{geoNote}</div>
                </div>
              </div>
              <div style={sx('display:flex;padding:9px 18px;background:#f7f9f8;border-bottom:1px solid #e9edeb')}>
                <div style={sx(`flex:1.9;font:600 10px/1.2 'IBM Plex Sans';letter-spacing:.11em;text-transform:uppercase;color:#8a9793`)}>Assembly constituency</div>
                {geoCols.map((c, i) => (
                  <div key={i} style={sx(`flex:1;text-align:right;font:600 9.5px/1.25 'IBM Plex Sans';letter-spacing:.08em;text-transform:uppercase;color:${c.fg}`)}>{c.label}</div>
                ))}
              </div>
              {acRows.map((g, i) => (
                <div key={i} onClick={g.go} className="d2-geo-row" style={sx(`display:flex;align-items:center;padding:11px 18px;border-bottom:1px solid #f0f3f2;cursor:pointer;background:${g.bg}`)}>
                  <div style={sx('flex:1.9;min-width:0;display:flex;align-items:baseline;gap:7px')}>
                    <div style={sx(`flex:none;width:9px;font:700 10px/1.4 'IBM Plex Sans';color:#0d7a6f`)}>{g.mark}</div>
                    <div style={sx('min-width:0')}>
                      <div style={sx(`font:700 12.5px/1.25 'IBM Plex Sans';color:${g.nameFg}`)}>{g.name}</div>
                      <div style={sx(`font:400 10.5px/1.3 'IBM Plex Sans';color:#9aa5a1;margin-top:2px`)}>{g.sub}</div>
                    </div>
                  </div>
                  {g.cells.map((cell, ci5) => (
                    <div key={ci5} style={sx(`flex:1;text-align:right;font:${cell.w} 12.5px/1.2 'IBM Plex Sans';color:${cell.fg}`)}>{cell.v}</div>
                  ))}
                </div>
              ))}
              <div style={sx(`padding:11px 18px;background:#fafbfb;font:400 11.5px/1.4 'IBM Plex Sans';color:#9aa5a1`)}>Each column adds up down these four rows to the {dPc} row above. Click a row to filter the locations list.</div>
            </div>

            <div style={sx('background:#fff;border:1px solid #dfe4e2;border-radius:10px;overflow:hidden')}>
              <div style={sx('display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #e9edeb;flex-wrap:wrap;gap:6px')}>
                <div style={sx('display:flex;align-items:center;gap:10px')}>
                  <div style={sx('width:3px;height:16px;border-radius:2px;background:#0d7a6f')} />
                  <div style={sx(`font:600 13px/1 'IBM Plex Sans';letter-spacing:.05em;text-transform:uppercase`)}>{listTitle}</div>
                </div>
                <div style={sx('display:flex;align-items:center;gap:6px;flex-wrap:wrap')}>
                  {lfilters.map((f, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={f.go}
                      style={sx(`cursor:pointer;white-space:nowrap;font:600 10.5px/1 'IBM Plex Sans';letter-spacing:.05em;padding:8px 11px;border-radius:6px;border:1px solid ${f.border};background:${f.bg};color:${f.fg}`)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={sx('display:flex;padding:9px 18px;background:#f7f9f8;border-bottom:1px solid #e9edeb')}>
                <div style={sx(`flex:1.5;font:600 10px/1.2 'IBM Plex Sans';letter-spacing:.11em;text-transform:uppercase;color:#8a9793`)}>Location</div>
                <div style={sx(`flex:.85;font:600 10px/1.2 'IBM Plex Sans';letter-spacing:.11em;text-transform:uppercase;color:#8a9793`)}>Reserved for</div>
                <div style={sx(`flex:1.5;font:600 10px/1.2 'IBM Plex Sans';letter-spacing:.11em;text-transform:uppercase;color:#8a9793`)}>Names proposed</div>
                <div style={sx(`flex:1.15;font:600 10px/1.2 'IBM Plex Sans';letter-spacing:.11em;text-transform:uppercase;color:#8a9793`)}>Stage reached</div>
                {showMetric && (
                  <div style={sx(`flex:.95;text-align:right;font:600 10px/1.2 'IBM Plex Sans';letter-spacing:.11em;text-transform:uppercase;color:#8a9793`)}>{metricCol}</div>
                )}
                <div style={sx(`flex:1.15;text-align:right;font:600 10px/1.2 'IBM Plex Sans';letter-spacing:.11em;text-transform:uppercase;color:#8a9793`)}>Action</div>
              </div>
              {rows.map((r, i) => (
                <div key={i} className="d2-row" style={sx('display:flex;align-items:center;padding:12px 18px;border-bottom:1px solid #f0f3f2;flex-wrap:wrap')}>
                  <div style={sx('flex:1.5;min-width:140px')}>
                    <div style={sx(`font:600 13px/1.25 'IBM Plex Sans'`)}>{r.name}</div>
                    <div style={sx(`font:400 11px/1.3 'IBM Plex Sans';color:#9aa5a1;margin-top:2px`)}>{r.sub}</div>
                  </div>
                  <div style={sx(`flex:.85;font:500 12px/1.2 'IBM Plex Sans';color:#6b7873`)}>{r.quota}</div>
                  <div style={sx('flex:1.5;min-width:160px')}>
                    <div style={sx('display:flex;align-items:center;gap:7px')}>
                      <button type="button" className="d2-link" onClick={r.compare} style={sx(`cursor:pointer;border:0;background:transparent;padding:0;font:700 12.5px/1.2 'IBM Plex Sans';color:#0d7a6f;text-decoration:underline`)}>{r.namesLabel}</button>
                      <span style={sx(`font:600 9.5px/1 'IBM Plex Sans';letter-spacing:.07em;text-transform:uppercase;padding:4px 6px;border-radius:4px;background:${r.leadBg};color:${r.leadFg}`)}>{r.leadTag}</span>
                    </div>
                    <div style={sx(`font:400 11px/1.35 'IBM Plex Sans';color:#9aa5a1;margin-top:3px`)}>{r.leadName}</div>
                  </div>
                  <div style={sx('flex:1.15')}>
                    <span style={sx(`display:inline-block;font:600 9.5px/1 'IBM Plex Sans';letter-spacing:.08em;text-transform:uppercase;padding:5px 8px;border-radius:4px;background:${r.pillBg};color:${r.pillFg}`)}>{r.stage}</span>
                  </div>
                  {showMetric && (
                    <div style={sx(`flex:.95;text-align:right;font:600 12.5px/1.2 'IBM Plex Sans';color:${r.metricTone}`)}>{r.metric}</div>
                  )}
                  <div style={sx('flex:1.15;text-align:right')}>
                    <button type="button" onClick={r.go} style={sx(`cursor:pointer;white-space:nowrap;font:600 10px/1 'IBM Plex Sans';letter-spacing:.07em;text-transform:uppercase;padding:8px 11px;border-radius:6px;border:1px solid ${r.btnBorder};background:${r.btnBg};color:${r.btnFg}`)}>{r.btn}</button>
                  </div>
                </div>
              ))}
              {listEmpty && (
                <div style={sx('padding:44px 18px;text-align:center')}>
                  <div style={sx(`font:600 13.5px/1.3 'IBM Plex Sans';color:#6b7873`)}>Nothing waiting at this stage in AC · {dAc}</div>
                  <div style={sx(`margin-top:6px;font:400 12px/1.4 'IBM Plex Sans';color:#9aa5a1`)}>Pick another stage in the chain above, or try another quota or assembly segment.</div>
                </div>
              )}
              <div style={sx(`padding:11px 18px;background:#fafbfb;font:400 11.5px/1.4 'IBM Plex Sans';color:#9aa5a1`)}>{listFoot}</div>
            </div>
          </div>
        )}

        {hasCompare && (
          <div style={sx('position:fixed;inset:0;background:rgba(20,32,29,.42);z-index:50;display:flex;align-items:center;justify-content:center;padding:24px')}>
            <div style={sx('width:min(1220px,100%);max-height:90vh;display:flex;flex-direction:column;background:#fff;border-radius:12px;box-shadow:0 18px 50px rgba(20,32,29,.22);overflow:hidden')}>
              <div style={sx('display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:18px 22px;border-bottom:1px solid #e9edeb')}>
                <div>
                  <div style={sx(`font:600 10.5px/1 'IBM Plex Sans';letter-spacing:.13em;text-transform:uppercase;color:#8a9793`)}>{cmp.crumb}</div>
                  <div style={sx(`margin-top:8px;font:700 19px/1.2 'IBM Plex Sans'`)}>{cmp.title}</div>
                  <div style={sx(`margin-top:6px;font:400 12.5px/1.45 'IBM Plex Sans';color:#6b7873`)}>{cmp.help}</div>
                </div>
                <button type="button" className="d2-btn" onClick={closeCompare} style={sx(`cursor:pointer;flex:none;white-space:nowrap;font:600 11px/1 'IBM Plex Sans';letter-spacing:.08em;text-transform:uppercase;padding:9px 12px;border-radius:6px;border:1px solid #dfe4e2;background:#fff;color:#6b7873`)}>Close</button>
              </div>

              <div style={sx('flex:1;overflow:auto;padding:16px 22px 20px')}>
                <div style={sx('display:flex;gap:12px;align-items:stretch;flex-wrap:wrap')}>
                  {cmp.cands.map((c, i) => (
                    <div key={i} onClick={c.pick} className="d2-card" style={sx(`flex:1;min-width:220px;cursor:pointer;border:1.5px solid ${c.border};border-radius:10px;padding:13px 14px;background:${c.bg}`)}>
                      <div style={sx('display:flex;align-items:flex-start;gap:10px')}>
                        <div style={sx(`width:17px;height:17px;flex:none;margin-top:2px;border-radius:50%;border:2px solid ${c.dotRing};background:${c.dotFill}`)} />
                        <div style={sx('flex:1;min-width:0')}>
                          <div style={sx(`font:700 14px/1.25 'IBM Plex Sans'`)}>{c.name}</div>
                          <div style={sx(`margin-top:4px;font:400 11px/1.3 'IBM Plex Sans';color:#9aa5a1`)}>{c.phone}</div>
                        </div>
                        <div style={sx('flex:none;text-align:center;border:1px solid #e9edeb;border-radius:7px;padding:6px 8px;background:#fff')}>
                          <div style={sx(`font:700 15px/1 'IBM Plex Sans';color:#0d7a6f`)}>{c.score}</div>
                          <div style={sx(`margin-top:3px;font:600 8px/1 'IBM Plex Sans';letter-spacing:.1em;color:#9aa5a1`)}>SCORE</div>
                        </div>
                      </div>
                      <div style={sx('margin-top:10px;display:flex;gap:6px;flex-wrap:wrap')}>
                        <span style={sx(`font:600 9.5px/1 'IBM Plex Sans';letter-spacing:.07em;text-transform:uppercase;padding:5px 7px;border-radius:4px;background:${c.fitBg};color:${c.fitFg}`)}>{c.fit}</span>
                        <span style={sx(`font:600 9.5px/1 'IBM Plex Sans';letter-spacing:.07em;text-transform:uppercase;padding:5px 7px;border-radius:4px;background:${c.stateBg};color:${c.stateFg}`)}>{c.state}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={sx('margin-top:14px;border:1px solid #eceff0;border-radius:10px;overflow:hidden')}>
                  {cmp.attrs.map((a, i) => (
                    <div key={i} style={sx(`display:flex;gap:12px;align-items:stretch;border-bottom:1px solid #f2f5f4;background:${a.rowBg};flex-wrap:wrap`)}>
                      <div style={sx(`flex:none;width:186px;padding:11px 14px;font:600 10.5px/1.3 'IBM Plex Sans';letter-spacing:.09em;text-transform:uppercase;color:#8a9793`)}>{a.label}</div>
                      {a.cells.map((v, vi) => (
                        <div key={vi} style={sx('flex:1;min-width:120px;padding:11px 14px;display:flex;align-items:center;gap:7px')}>
                          <div style={sx(`font:600 12.5px/1.3 'IBM Plex Sans';color:${v.tone}`)}>{v.v}</div>
                          <span style={sx(`font:700 8.5px/1 'IBM Plex Sans';letter-spacing:.08em;text-transform:uppercase;color:#1c7a45`)}>{v.best}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div style={sx('display:flex;align-items:center;justify-content:space-between;gap:16px;padding:15px 22px;border-top:1px solid #e9edeb;background:#fbfcfc;flex-wrap:wrap')}>
                <div style={sx(`font:400 12px/1.45 'IBM Plex Sans';color:#6b7873`)}>{cmp.foot}</div>
                <div style={sx('display:flex;gap:10px')}>
                  <button type="button" className="d2-btn" onClick={closeCompare} style={sx(`cursor:pointer;white-space:nowrap;font:600 11.5px/1 'IBM Plex Sans';letter-spacing:.07em;text-transform:uppercase;padding:13px 16px;border-radius:7px;border:1px solid #dfe4e2;background:#fff;color:#6b7873`)}>Cancel</button>
                  <button type="button" onClick={cmp.confirmGo} style={sx(`cursor:${cmp.btnCursor};white-space:nowrap;font:600 11.5px/1 'IBM Plex Sans';letter-spacing:.07em;text-transform:uppercase;padding:13px 20px;border-radius:7px;border:0;background:${cmp.btnBg};color:${cmp.btnFg}`)}>{cmp.btnLabel}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {hasDrawer && (
          <>
            <div onClick={closeDrawer} style={sx('position:fixed;inset:0;background:rgba(20,32,29,.34);z-index:40')} />
            <div style={sx('position:fixed;top:0;right:0;bottom:0;width:min(440px,100%);background:#fff;z-index:41;box-shadow:-8px 0 28px rgba(20,32,29,.14);display:flex;flex-direction:column')}>
              <div style={sx('display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid #e9edeb')}>
                <div style={sx(`font:600 11px/1.3 'IBM Plex Sans';letter-spacing:.14em;text-transform:uppercase;color:#8a9793`)}>{dw.loc}</div>
                <button type="button" className="d2-btn" onClick={closeDrawer} style={sx(`cursor:pointer;flex:none;white-space:nowrap;font:600 11px/1 'IBM Plex Sans';letter-spacing:.08em;text-transform:uppercase;padding:9px 12px;border-radius:6px;border:1px solid #dfe4e2;background:#fff;color:#6b7873`)}>Close</button>
              </div>
              <div style={sx('flex:1;overflow:auto;padding:18px 20px 22px')}>
                <div style={sx('display:flex;align-items:flex-start;gap:13px')}>
                  <div style={sx(`width:56px;height:56px;flex:none;border-radius:9px;background:#eef1f0;border:1px solid #e2e7e5;display:flex;align-items:center;justify-content:center;font:600 9.5px/1.3 'IBM Plex Sans';color:#a6b1ad`)}>PHOTO</div>
                  <div style={sx('flex:1;min-width:0')}>
                    <div style={sx(`font:700 17px/1.2 'IBM Plex Sans'`)}>{dw.name}</div>
                    <div style={sx(`margin-top:5px;font:400 12px/1.35 'IBM Plex Sans';color:#8a9793`)}>{dw.role}</div>
                    <div style={sx('margin-top:9px;display:flex;gap:7px;flex-wrap:wrap')}>
                      <span style={sx(`font:600 10px/1 'IBM Plex Sans';letter-spacing:.07em;text-transform:uppercase;padding:5px 8px;border-radius:4px;background:${dw.pillBg};color:${dw.pillFg}`)}>{dw.stage}</span>
                      <span style={sx(`font:500 10.5px/1 'IBM Plex Sans';padding:5px 8px;border-radius:4px;background:#f1f4f3;color:#6b7873`)}>{dw.phone}</span>
                    </div>
                  </div>
                </div>

                <div style={sx('margin-top:14px')}>
                  <button type="button" className="d2-btn" onClick={dw.compareGo} style={sx(`width:100%;cursor:pointer;font:600 11px/1 'IBM Plex Sans';letter-spacing:.08em;text-transform:uppercase;padding:11px;border-radius:7px;border:1px solid #dfe4e2;background:#fff;color:#0d7a6f`)}>{dw.compareLabel}</button>
                </div>

                <div style={sx(`margin-top:20px;font:600 10px/1 'IBM Plex Sans';letter-spacing:.14em;text-transform:uppercase;color:#8a9793`)}>Progress</div>
                <div style={sx('margin-top:12px')}>
                  {dw.timeline.map((t, i) => (
                    <div key={i} style={sx('display:flex;gap:12px')}>
                      <div style={sx('flex:none;display:flex;flex-direction:column;align-items:center;width:18px')}>
                        <div style={sx(`width:16px;height:16px;border-radius:50%;border:2px solid ${t.ring};background:${t.fill};color:#fff;font:700 8px/16px 'IBM Plex Sans';text-align:center`)}>{t.mark}</div>
                        <div style={sx(`width:2px;flex:1;min-height:14px;background:${t.line}`)} />
                      </div>
                      <div style={sx('padding-bottom:12px')}>
                        <div style={sx(`font:600 12.5px/1.2 'IBM Plex Sans';color:${t.fg}`)}>{t.label}</div>
                        <div style={sx(`margin-top:3px;font:400 11px/1.35 'IBM Plex Sans';color:#9aa5a1`)}>{t.note}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={sx('margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:9px')}>
                  {dw.facts.map((f, i) => (
                    <div key={i} style={sx('border:1px solid #eceff0;border-radius:7px;padding:9px 11px')}>
                      <div style={sx(`font:600 9.5px/1 'IBM Plex Sans';letter-spacing:.1em;text-transform:uppercase;color:#9aa5a1`)}>{f.k}</div>
                      <div style={sx(`margin-top:5px;font:600 12.5px/1.25 'IBM Plex Sans'`)}>{f.v}</div>
                    </div>
                  ))}
                </div>

                <div style={sx('margin-top:18px;padding:13px 15px;border-radius:9px;background:#fbfcfc;border:1px solid #e9edeb')}>
                  <div style={sx(`font:600 11px/1.3 'IBM Plex Sans';letter-spacing:.11em;text-transform:uppercase;color:#0d7a6f`)}>{dw.actionStep} · {dw.actionTitle}</div>
                  <div style={sx(`margin-top:7px;font:400 11.5px/1.45 'IBM Plex Sans';color:#8a9793`)}>{dw.actionHelp}</div>

                  {dw.isDocs && (
                    <div style={sx('margin-top:12px')}>
                      {docsList.map((doc, i) => (
                        <div key={i} onClick={doc.go} style={sx('display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #f0f3f2;cursor:pointer')}>
                          <div style={sx(`width:18px;height:18px;flex:none;border-radius:50%;border:1.5px solid ${doc.tone};color:${doc.tone};font:700 10px/15px 'IBM Plex Sans';text-align:center`)}>{doc.mark}</div>
                          <div style={sx('flex:1;min-width:0')}>
                            <div style={sx(`font:600 12.5px/1.2 'IBM Plex Sans'`)}>{doc.name}</div>
                            <div style={sx(`margin-top:3px;font:400 11px/1.3 'IBM Plex Sans';color:#9aa5a1`)}>{doc.note}</div>
                          </div>
                          <div style={sx(`font:600 10px/1 'IBM Plex Sans';letter-spacing:.08em;text-transform:uppercase;color:${doc.tone}`)}>{doc.state}</div>
                        </div>
                      ))}
                      <div style={sx('margin-top:12px;border:1.5px dashed #cfd8d5;border-radius:9px;padding:16px;text-align:center;background:#fff')}>
                        <div style={sx(`font:600 12.5px/1.3 'IBM Plex Sans';color:#6b7873`)}>Drop scanned papers here</div>
                        <div style={sx(`margin-top:5px;font:400 11px/1.4 'IBM Plex Sans';color:#9aa5a1`)}>PDF or JPG · up to 5 MB each</div>
                      </div>
                    </div>
                  )}

                  {dw.isD2d && (
                    <div style={sx('margin-top:12px')}>
                      <div style={sx('display:flex;align-items:baseline;justify-content:space-between')}>
                        <div style={sx(`font:700 24px/1 'IBM Plex Sans'`)}>{d2d.pct}%</div>
                        <div style={sx(`font:500 12px/1 'IBM Plex Sans';color:#8a9793`)}>{d2d.visited} of {d2d.houses} houses</div>
                      </div>
                      <div style={sx('margin-top:9px;height:8px;border-radius:4px;background:#eceff0;overflow:hidden')}><div style={sx(`height:8px;background:#0d7a6f;width:${d2d.barW}`)} /></div>
                      {d2d.workers.map((w, i) => (
                        <div key={i} style={sx('display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #f0f3f2')}>
                          <div style={sx(`font:600 12.5px/1.2 'IBM Plex Sans';flex:1`)}>{w.name}</div>
                          <div style={sx(`font:500 11.5px/1 'IBM Plex Sans';color:#9aa5a1`)}>{w.last}</div>
                          <div style={sx(`font:700 12.5px/1 'IBM Plex Sans';color:#0d7a6f;width:52px;text-align:right`)}>{w.houses}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {dw.isResult && (
                    <div style={sx('margin-top:12px')}>
                      <div style={sx('display:flex;gap:9px')}>
                        <div onClick={resObj.wonGo} style={sx(`flex:1;border:${resObj.won.w} solid ${resObj.won.border};border-radius:8px;padding:12px;text-align:center;background:${resObj.won.bg};cursor:pointer`)}><div style={sx(`font:700 13px/1 'IBM Plex Sans';color:${resObj.won.fg}`)}>WON</div></div>
                        <div onClick={resObj.lostGo} style={sx(`flex:1;border:${resObj.lost.w} solid ${resObj.lost.border};border-radius:8px;padding:12px;text-align:center;background:${resObj.lost.bg};cursor:pointer`)}><div style={sx(`font:700 13px/1 'IBM Plex Sans';color:${resObj.lost.fg}`)}>LOST</div></div>
                      </div>
                      <div style={sx(`margin-top:9px;font:400 11px/1.4 'IBM Plex Sans';color:#9aa5a1`)}>{resObj.note}</div>
                    </div>
                  )}
                </div>
              </div>
              <div style={sx('padding:14px 20px;border-top:1px solid #e9edeb;background:#fbfcfc;display:flex;gap:9px')}>
                <button type="button" onClick={dw.primaryGo} style={sx(`flex:1;cursor:pointer;white-space:nowrap;font:600 11.5px/1 'IBM Plex Sans';letter-spacing:.07em;text-transform:uppercase;padding:13px;border-radius:7px;border:0;background:${dw.primaryBg};color:${dw.primaryFg}`)}>{dw.primary}</button>
                <button type="button" className="d2-btn" onClick={closeDrawer} style={sx(`cursor:pointer;white-space:nowrap;font:600 11.5px/1 'IBM Plex Sans';letter-spacing:.07em;text-transform:uppercase;padding:13px 15px;border-radius:7px;border:1px solid #dfe4e2;background:#fff;color:#6b7873`)}>Later</button>
              </div>
            </div>
          </>
        )}

        {!!st.toast && (
          <div style={sx('position:fixed;bottom:26px;left:50%;transform:translateX(-50%);z-index:60;display:flex;align-items:center;gap:11px;background:#12312b;color:#fff;border-radius:9px;padding:14px 20px;box-shadow:0 10px 30px rgba(18,49,43,.3)')}>
            <div style={sx(`width:18px;height:18px;border-radius:50%;background:#7fe0b0;color:#12312b;font:700 10px/18px 'IBM Plex Sans';text-align:center`)}>✓</div>
            <div style={sx(`font:500 13px/1.3 'IBM Plex Sans'`)}>{st.toast}</div>
          </div>
        )}

      </div>
    </div>
  )
}
