import { createHmac } from 'node:crypto'

/**
 * Preview-only source ownership transport. No grants are issued by this helper.
 * NIL's authenticated Supabase user is the external identity; user-input
 * athlete IDs and emails are never accepted as identity proof.
 */
const CONNECT_CODE = /^AHNR-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type PreviewPairingConfig = {
  endpoint: string
  secret: string
  nilRosterOrigin: string
}

export function validateConnectCode(input: unknown): input is string {
  return typeof input === 'string' && CONNECT_CODE.test(input)
}

export function loadPreviewPairingConfig(
  env: Record<string, string | undefined> = process.env
): PreviewPairingConfig | null {
  if (env.VERCEL_ENV !== 'preview' && env.NODE_ENV !== 'test' && env.NODE_ENV !== 'development') return null
  const endpoint = env.ATHLETE_HOUZE_PAIRING_URL?.trim()
  const secret = env.ATHLETE_HOUZE_PAIRING_HMAC_SECRET?.trim()
  const nilRosterOrigin = env.NIL_ROSTER_PREVIEW_ORIGIN?.trim()
  if (!endpoint || !secret || secret.length < 32 || !nilRosterOrigin) return null
  try {
    const destination = new URL(endpoint)
    const source = new URL(nilRosterOrigin)
    if (destination.username || destination.password || destination.hash || destination.search) return null
    if (destination.pathname !== '/api/integrations/nil-roster/complete-link') return null
    // Never connect this test sender to the live Athlete Houze domain or workers.dev.
    if (/(^|\.)athletehouze\.com$/i.test(destination.hostname) || destination.hostname.endsWith('.workers.dev')) return null
    const local = ['localhost', '127.0.0.1'].includes(destination.hostname)
    const localSource = ['localhost', '127.0.0.1'].includes(source.hostname)
    if (destination.protocol !== 'https:' && !(local && destination.protocol === 'http:')) return null
    if (source.protocol !== 'https:' && !(localSource && source.protocol === 'http:')) return null
    if (source.origin !== nilRosterOrigin || source.pathname !== '/' || source.search || source.hash) return null
    return { endpoint: destination.href, secret, nilRosterOrigin }
  } catch {
    return null
  }
}

export type SourceOwnedPairingRequest = {
  connectCode: string
  externalAthleteId: string
  athleteConsent: true
  backfillConsented: false
}

export function buildOwnedPairingPayload(
  authenticatedSupabaseUserId: string,
  connectCode: string
): SourceOwnedPairingRequest | null {
  if (!UUID.test(authenticatedSupabaseUserId) || !validateConnectCode(connectCode)) return null
  return {
    connectCode,
    externalAthleteId: authenticatedSupabaseUserId,
    athleteConsent: true,
    backfillConsented: false,
  }
}

export async function completePreviewOwnedPairing(input: {
  config: PreviewPairingConfig
  payload: SourceOwnedPairingRequest
  fetchImpl?: typeof fetch
  timestampSeconds?: number
}): Promise<{ ok: true } | { ok: false; code: 'rejected' | 'unavailable' }> {
  const now = input.timestampSeconds ?? Math.floor(Date.now() / 1000)
  const body = JSON.stringify(input.payload)
  const signature = createHmac('sha256', input.config.secret)
    .update(String(now) + '.').update(body).digest('hex')
  try {
    const result = await (input.fetchImpl ?? fetch)(input.config.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json',
        'x-ah-source': 'nil_roster',
        'x-ah-timestamp': String(now),
        'x-ah-signature': 'sha256=' + signature,
      },
      body,
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
    })
    if (result.ok) {
      const json: unknown = await result.json().catch(() => null)
      if (json && typeof json === 'object' && 'status' in json && json.status === 'linked')
        return { ok: true }
    }
    return { ok: false, code: 'rejected' }
  } catch {
    return { ok: false, code: 'unavailable' }
  }
}
