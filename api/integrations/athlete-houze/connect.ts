import { createHmac, randomUUID } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import {
  buildOwnedPairingPayload,
  completePreviewOwnedPairing,
  loadPreviewPairingConfig,
  validateConnectCode,
} from '../../_lib/athleteHouzePairing.js'
import { createUserClient } from '../../_lib/athleteHouzeEnrollment.js'

async function bestEffortPartnerAcknowledgment(input: {
  pairingEndpoint: string
  secret: string
  athleteId: string
  externalAthleteId: string
}): Promise<void> {
  const ackUrl = process.env.ATHLETE_HOUZE_PARTNER_ACK_URL?.trim()
  const ackSecret =
    process.env.ATHLETE_HOUZE_PARTNER_ACK_HMAC_SECRET?.trim() || input.secret
  if (!ackUrl || !ackSecret) return
  try {
    const destination = new URL(ackUrl)
    if (destination.pathname !== '/api/integrations/proof-sprint/partner-acknowledgment') return
    if (/(^|\.)athletehouze\.com$/i.test(destination.hostname)) return
    const body = JSON.stringify({
      partner: 'nil_roster',
      athleteId: input.athleteId,
      externalAccountId: input.externalAthleteId,
      acknowledgmentId: randomUUID(),
    })
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = createHmac('sha256', ackSecret)
      .update(String(timestamp) + '.')
      .update(body)
      .digest('hex')
    await fetch(destination.href, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-ah-source': 'nil_roster',
        'x-ah-timestamp': String(timestamp),
        'x-ah-signature': 'sha256=' + signature,
      },
      body,
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
    }).catch(() => null)
  } catch {
    // Partner ack is evidence for trial activation, not pairing success.
  }
}

/**
 * Authenticated pairing proof.
 *
 * Preview: requires isolated non-production Auth + explicit origin consent.
 * After Athlete Houze returns a complete production-kind acknowledgment, the
 * NIL-side durable enrollment row is written. If that write fails, Houze is
 * asked to disconnect so the handshake does not leave a one-sided link.
 *
 * Premium / 60-day entitlement is never activated here.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const config = loadPreviewPairingConfig()
  if (!config) return res.status(503).json({ error: 'Pairing unavailable' })
  const origin = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin
  if (!origin || origin !== config.nilRosterOrigin) {
    return res.status(403).json({ error: 'Origin not allowed' })
  }
  const contentType = req.headers['content-type']
  if (typeof contentType !== 'string' || !/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return res.status(415).json({ error: 'JSON required' })
  }
  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).sort().join(',') !== 'athleteConsent,connectCode' ||
      body.athleteConsent !== true || !validateConnectCode(body.connectCode)) {
    return res.status(400).json({ error: 'Invalid request' })
  }
  // Browser sessions in NIL Roster are stored client-side. Re-verify the
  // bearer token with the isolated source GoTrue service; never trust a
  // browser-provided subject or a public-mode session bypass.
  const authorization = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization
  const bearer = typeof authorization === 'string'
    ? /^Bearer\s+(.+)$/i.exec(authorization)
    : null
  const accessToken = bearer?.[1]?.trim()
  if (!accessToken) return res.status(401).json({ error: 'Authentication required' })
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey)
    return res.status(503).json({ error: 'Pairing unavailable' })
  const source = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: 'Bearer ' + accessToken } },
  })
  let verifiedUserId: string | undefined
  try {
    const { data, error } = await source.auth.getUser(accessToken)
    if (error || !data.user) return res.status(401).json({ error: 'Authentication required' })
    verifiedUserId = data.user.id
  } catch {
    return res.status(401).json({ error: 'Authentication required' })
  }
  const payload = buildOwnedPairingPayload(verifiedUserId, body.connectCode)
  if (!payload) return res.status(403).json({ error: 'Ownership not verified' })
  const paired = await completePreviewOwnedPairing({ config, payload })
  if (!paired.ok) {
    return res.status(paired.code === 'unavailable' ? 503 : 409)
      .json({ error: 'Pairing was not completed' })
  }

  const userClient = createUserClient(accessToken)
  if (!userClient) return res.status(503).json({ error: 'Pairing unavailable' })

  const connectedAt = new Date().toISOString()
  const { error: enrollmentError } = await userClient.from('athlete_houze_enrollments').upsert(
    {
      user_id: verifiedUserId,
      houze_athlete_id: paired.ack.athleteId,
      consent_scope: 'restricted',
      status: 'linked',
      connected_at: connectedAt,
      disconnected_at: null,
      last_error: null,
    },
    { onConflict: 'user_id' },
  )

  if (enrollmentError) {
    // Compensating action: do not leave a Houze-side link without a durable NIL row.
    const disconnectBody = JSON.stringify({ externalAthleteId: verifiedUserId })
    const disconnectEndpoint = new URL(
      '/api/integrations/nil-roster/server-disconnect',
      config.endpoint,
    ).toString()
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = createHmac('sha256', config.secret)
      .update(String(timestamp) + '.')
      .update(disconnectBody)
      .digest('hex')
    await fetch(disconnectEndpoint, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-ah-source': 'nil_roster',
        'x-ah-timestamp': String(timestamp),
        'x-ah-signature': 'sha256=' + signature,
      },
      body: disconnectBody,
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
    }).catch(() => null)
    return res.status(500).json({ error: 'enrollment_write_failed' })
  }

  // Best-effort trial evidence only. Failures never flip pairing success
  // or advertise premium access from this route.
  await bestEffortPartnerAcknowledgment({
    pairingEndpoint: config.endpoint,
    secret: config.secret,
    athleteId: paired.ack.athleteId,
    externalAthleteId: verifiedUserId,
  })

  return res.status(200).json({
    status: 'linked',
    premiumAccessActive: false,
    enrollmentKind: 'production',
    athleteId: paired.ack.athleteId,
    identityId: paired.ack.identityId,
  })
}
