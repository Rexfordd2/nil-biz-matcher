import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'

/**
 * Preview-only opt-in proof. Linking allows NIL Roster to send source-attested
 * updates only under separately permitted consent. It does NOT grant a paid
 * companion entitlement; 60-day activation is a different verified workflow.
 */
export default function AthleteHouzePreviewPairingCard() {
  const [code, setCode] = useState('')
  const [consent, setConsent] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const enabled = import.meta.env.VITE_ATHLETE_HOUZE_PREVIEW_PAIRING_ENABLED === 'true'
  if (!enabled || !supabase) return null

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending || !consent || !/^AHNR-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(code.trim().toUpperCase()))
      return
    setPending(true)
    setMessage(null)
    try {
      const { data, error } = await supabase!.auth.getSession()
      if (error || !data.session?.access_token) {
        setMessage('Sign in again before connecting your account.')
        return
      }
      const response = await fetch('/api/integrations/athlete-houze/connect', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer ' + data.session.access_token,
        },
        body: JSON.stringify({
          connectCode: code.trim().toUpperCase(),
          athleteConsent: true,
        }),
        redirect: 'error',
      })
      if (!response.ok) {
        setMessage(response.status === 503
          ? 'Preview pairing is not configured yet. Please contact the test operator.'
          : 'Pairing could not be confirmed. Verify your code, account and consent.')
        return
      }
      setMessage('Source account linked in the preview. Premium access is not yet active.')
      setCode('')
      setConsent(false)
    } catch {
      setMessage('Pairing is temporarily unavailable. No connection was confirmed.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section
      className="space-y-3 rounded-lg border border-amber-500/30 bg-mid/30 p-4"
      data-testid="athlete-houze-preview-pairing"
    >
      <div>
        <h3 className="font-semibold text-white">Athlete Houze account linking — preview only</h3>
        <p className="mt-1 text-sm text-gray-300">
          In Athlete Houze, request a new 15-minute NIL Roster pairing code for the
          athlete you own. Sign in here with your NIL Roster account and confirm
          that you authorize linking this account with that athlete.
          Parent or guardian authorization is required when applicable.
          This test does not grant Vanta, NIL Roster premium features or a 60-day trial.
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block space-y-1 text-sm text-gray-200">
          Pairing code
          <input
            value={code}
            onChange={e => setCode(e.target.value)}
            required
            autoComplete="off"
            maxLength={14}
            placeholder="AHNR-ABCD-2345"
            aria-label="Athlete Houze pairing code"
            className="block w-full rounded-md border border-border bg-background px-3 py-2 text-white"
          />
        </label>
        <label className="flex items-start gap-2 text-sm text-gray-200">
          <input
            type="checkbox"
            checked={consent}
            onChange={e => setConsent(e.target.checked)}
            className="mt-1"
          />
          I authorize this NIL Roster account to link to my selected Athlete
          Houze athlete. I understand this is a private preview connection and
          does not activate the Proof Sprint premium trial.
        </label>
        <button
          type="submit"
          disabled={pending || !consent || !code.trim()}
          className="rounded-md border border-white/20 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? 'Verifying account…' : 'Connect preview account'}
        </button>
        {message && <p role="status" className="text-sm text-gray-300">{message}</p>}
      </form>
    </section>
  )
}
