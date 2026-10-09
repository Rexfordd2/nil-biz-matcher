import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import {
  buildOwnedPairingPayload,
  completePreviewOwnedPairing,
  loadPreviewPairingConfig,
  validateConnectCode,
} from '../../_lib/athleteHouzePairing.js'

/**
 * Preview-only pairing proof. No production enrollment or premium entitlement
 * is activated by a successful connect-code redemption.
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
  if (!paired.ok) return res.status(paired.code === 'unavailable' ? 503 : 409)
    .json({ error: 'Pairing was not completed' })
  return res.status(200).json({ status: 'linked', premiumAccessActive: false })
}
