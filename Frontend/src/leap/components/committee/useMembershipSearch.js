import { useState } from 'react'
import { SEARCH_TYPES, searchCadre } from '../../cadreSearchApi.js'

export { SEARCH_TYPES }

const MIN_LENGTH = { MembershipId: 8, MobileNo: 10 }

const sanitize = (type, raw) => {
  if (type === 'MembershipId') return raw.replace(/\D/g, '').slice(0, 8)
  if (type === 'MobileNo') return raw.replace(/\D/g, '').slice(0, 10)
  return raw
}

const typeLabel = (type) => SEARCH_TYPES.find((t) => t.value === type)?.label || type

// Defaults to membership-id-only, same restriction and reasoning as the wizard's own
// cadre search (NewPositionModal's AddMembersPanel): the one field searchCadre matches
// exactly, so a search resolves to a single cadre rather than a page of near-matches. A
// caller that wants the other three fields (Voter ID / Mobile / Name — see
// cadreSearchApi.js's SEARCH_TYPES) calls `selectType`; one that never does gets the old
// membership-id-only behaviour unchanged. Shared by KssPanel and MainCommitteePanel —
// all three stage a cadre this same way before writing it somewhere.
export default function useMembershipSearch(constituencyId) {
  const [searchType, setSearchType] = useState(SEARCH_TYPES[0].value)
  const [value, setValue] = useState('')
  // null = not searched yet, [] = searched and found nothing, else the matched rows.
  const [results, setResults] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const selectType = (type) => {
    setSearchType(type)
    setValue('')
    setResults(null)
    setError('')
  }

  const run = async () => {
    const v = value.trim()
    const min = MIN_LENGTH[searchType]
    if (min && v.length < min) {
      setError(`Enter the full ${min}-digit ${typeLabel(searchType)}.`)
      return
    }
    if (!v) {
      setError('Enter a value to search.')
      return
    }
    setBusy(true)
    setError('')
    setResults(null)
    try {
      const rows = await searchCadre(searchType, v, constituencyId)
      setResults(rows || [])
      if (!rows || rows.length === 0) setError(`No cadre found for that ${typeLabel(searchType).toLowerCase()}.`)
    } catch (err) {
      setError(err.message)
      setResults([])
    } finally {
      setBusy(false)
    }
  }

  const reset = () => { setValue(''); setResults(null); setError('') }

  return {
    searchType, selectType,
    value, setValue: (v) => setValue(sanitize(searchType, v)),
    result: results && results[0] ? results[0] : null,
    results,
    busy, error, run, reset,
  }
}
