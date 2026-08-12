import { getToken } from './api.js'

// Cadre Search & Notes talks to a different backend than the rest of leap/ — the
// mypartydashboard.com PSA web service, not the /leapapi FastAPI app — so it gets its own
// tiny client rather than joining api.js. Called directly (not proxied): that service
// answers `Access-Control-Allow-Origin: *`, so there is no same-origin problem to work
// around the way /leapapi's dead-backend-vs-401 handling has to.
const SEARCH_URL = 'https://www.mypartydashboard.com/PSA/WebService/Cadre/search'

// `imageUrl` in the search response is a path relative to this S3 bucket
// (e.g. "232/10000000.jpg"), not a full URL — the caller has to prefix it.
const IMAGE_BASE_URL = 'https://imagesearch-projectkv.s3.amazonaws.com/cadre_images/'

export const cadreImageUrl = (imageUrl) => (imageUrl ? `${IMAGE_BASE_URL}${imageUrl}` : '')

// The backend's own CADRE_SEARCH_FILTERS keys. TR NO appears in the legacy screen this
// module mirrors but has no searchType value here, so it is left out rather than sent
// as something the service does not recognise.
export const SEARCH_TYPES = [
  { value: 'MembershipId', label: 'Membership ID' },
  { value: 'VoterCardNo', label: 'Voter ID' },
  { value: 'MobileNo', label: 'Mobile No' },
  { value: 'CadreName', label: 'Name' },
]

export const searchCadre = async (searchType, searchValue, constituencyId) => {
  const res = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authToken: getToken() || '' },
    body: JSON.stringify({
      searchType,
      searchValue,
      constituencyId: constituencyId || null,
    }),
  })
  if (!res.ok) throw new Error(`Cadre search failed (${res.status})`)
  return res.json()
}
