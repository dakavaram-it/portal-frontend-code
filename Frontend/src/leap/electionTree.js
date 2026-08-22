// The shape of the election — the two tiers, the five bodies under them, and the fifteen
// posts those bodies hold. Shared by Dashboard (components/Dashboard.jsx) and Dashboard 2
// (components/Dashboard2.jsx) so the two screens cannot disagree about the layout.
//
// It lived inside Dashboard.jsx until Dashboard 2 grew a second, independent answer: that
// screen grouped its rows by `main_election_type` straight out of the database, which put
// three stray positions under the wrong body, split Corporator into two rows, and could not
// show a post the database has no row for at all. Two definitions of one tree is the bug;
// this file is the fix. Add a post here and both screens grow it.
//
// ---------------------------------------------------------------------------
// Why this is written down rather than derived from the rows
// ---------------------------------------------------------------------------
// THE TREE IS THE PLAN. A post nobody has configured a proposal constituency for yet still
// has to appear — as a static "not configured" card — or the screen would pretend half the
// election does not exist. Deriving the layout from the rows can only ever show what has
// already been set up.
//
// ---------------------------------------------------------------------------
// Why cards claim by proposal_role_id and nothing else
// ---------------------------------------------------------------------------
// NOT BY NAME: roles 1/2 were `President`/`Vice-President` before they were
// `Sarpanch`/`Upa-Sarpanch`, and every rename empties whichever card spelt the old one.
//
// NOT BY ELECTION TYPE EITHER: a position's election type is its *constituency's*, not the
// post's, and the two disagree across the data — Sarpanch and Upa-Sarpanch positions sit
// under an MPTC constituency, and role 5 Corporator appears under two types. Pinning a
// card to a type makes it read "not configured" while its own rows sit in the Other group
// below it.
//
// The role ids are the database's own, verified against it. Between them the fifteen cards
// claim every proposal_position in the database, so the Other group is empty — if a row
// ever appears there, a new proposal_role was added and no card claims it.
export const ELECTION_TREE = [
  {
    id: 'panchayat-raj',
    label: 'Panchayat Raj Elections',
    sub: 'Mandal & District tier',
    bodies: [
      {
        label: 'Mandal Parishad',
        mainElectionTypeId: 1,
        sub: 'per Mandal',
        accent: '#2563eb',
        cards: [
          { label: 'MPTC', roleIds: [4] },
          { label: 'MPP', roleIds: [6] },
          { label: 'Vice-MPP', roleIds: [7] },
        ],
      },
      {
        label: 'Zilla Parishad',
        mainElectionTypeId: 2,
        sub: 'per District',
        accent: '#7c3aed',
        cards: [
          { label: 'ZPTC', roleIds: [3] },
          { label: 'ZP Chairman', roleIds: [12] },
          { label: 'Vice-Chairman', roleIds: [13] },
        ],
      },
    ],
  },
  {
    id: 'local-body',
    label: 'Local Body Elections',
    sub: 'Panchayat / Municipality / Corporation',
    bodies: [
      {
        label: 'Municipality',
        mainElectionTypeId: 4,
        sub: 'Town',
        accent: '#d97706',
        cards: [
          { label: 'Chairperson', roleIds: [8] },
          { label: 'Vice-Chairperson', roleIds: [9] },
          // Role 14 Ward Councillor, added to proposal_role after this tree was written.
          // Municipal-ward seats used to be filed under role 5 Corporator, which is why
          // this card claimed nothing; they now carry a role of their own, under
          // proposal_election_type 8 Municipal Ward. Until this card was told about it
          // every one of those positions fell into the Other group.
          // electionTypeId is the label to fall back on for an assembly with no ward rows
          // of its own — the ID, not the name, so a rename cannot leave it stale.
          { label: 'Ward Councillor', roleIds: [14], electionTypeId: 8 },
        ],
      },
      {
        label: 'Municipal Corporation',
        mainElectionTypeId: 5,
        sub: 'City',
        accent: '#0891b2',
        cards: [
          { label: 'Corporator', roleIds: [5] },
          { label: 'Mayor', roleIds: [10] },
          { label: 'Deputy Mayor', roleIds: [11] },
        ],
      },
      {
        label: 'Gram Panchayat',
        mainElectionTypeId: 3,
        sub: 'Village',
        accent: '#059669',
        cards: [
          { label: 'Sarpanch', roleIds: [1] },
          { label: 'Upa Sarpanch', roleIds: [2] },
          // No proposal_role exists for a panchayat ward seat either, so this card is
          // static by definition — not a mapping guess that could be hiding rows.
          // Same as Ward Councillor above: proposal_election_type 7, Panchayat, by id.
          { label: 'Ward Member', roleIds: [], electionTypeId: 7 },
        ],
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// mainElectionTypeId — for labelling only, never for claiming
// ---------------------------------------------------------------------------
// A card still claims its rows by role id alone (see below). But a role can legitimately
// span election types — role 5 Corporator holds Corporation Ward and a stray MPTC
// constituency — and a card that names both reads as nonsense under the one body it sits
// in. So the BODY says which main_election_type it is, and a card names
// the election type(s) of its own rows within that body: Corporator under Municipal
// Corporation reads "Corporation Ward", Mayor reads "Corporation".
//
// This is a label, not a filter. Nothing is hidden when it does not match — a card whose
// rows all fall outside its body still counts them, and falls back to naming them all.
// Deriving the label from the rows rather than writing the type names down here is
// deliberate: election types get renamed, and a hardcoded string would go stale silently,
// which is the same trap that empties a card matched on role *name*.

// A row belongs to a card when its own proposal_role_id is one the card claims.
// See the note above ELECTION_TREE for why the role id alone, and not the election type.
export const cardMatches = (card, row) => card.roleIds.includes(Number(row.proposal_role_id))

// Every role id the tree claims — what a caller checks a row against to decide whether it
// belongs in the Other group. Derived, never written down twice.
export const CLAIMED_ROLE_IDS = new Set(
  ELECTION_TREE.flatMap((tier) => tier.bodies.flatMap((body) => body.cards.flatMap((card) => card.roleIds))),
)
