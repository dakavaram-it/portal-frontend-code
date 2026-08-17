import { useState } from 'react'
import { searchCadre } from '../../cadreSearchApi.js'

const sanitizeMid = (raw) => raw.replace(/\D/g, '').slice(0, 8)

// Membership-id-only, same restriction and reasoning as the wizard's own cadre search
// (NewPositionModal's AddMembersPanel): the one field searchCadre matches exactly, so a
// search resolves to a single cadre rather than a page of near-matches. Shared by
// KssPanel and MainCommitteePanel — both stage a cadre this same way before writing it
// somewhere.
export default function useMembershipSearch(constituencyId) {
  const [value, setValue] = useState('')
  const [result, setResult] = useState(null) // null = not searched (or found none), object = found
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    if (value.length < 8) {
      setError('Enter the full 8-digit membership ID.')
      return
    }
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const rows = await searchCadre('MembershipId', value, constituencyId)
      setResult((rows && rows[0]) || null)
      if (!rows || !rows[0]) setError('No cadre found with that membership ID.')
    } catch (err) {
      setError(err.message)
      setResult(null)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => { setValue(''); setResult(null); setError('') }

  return { value, setValue: (v) => setValue(sanitizeMid(v)), result, busy, error, run, reset }
}
