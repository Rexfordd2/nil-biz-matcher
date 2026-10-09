import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAuthenticatedSupabaseUser } from '../../_lib/getAuthenticatedSupabaseUser'
import {
  buildOwnedPairingPayload,
  completePreviewOwnedPairing,
  loadPreviewPairingConfig,
  validateConnectCode,
} from '../../_lib/athleteHouzePairing'

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
  const auth = await getAuthenticatedSupabaseUser(req, res)
  // The NIL public-mode bypass must NEVER authorize account linking.
  if (auth.bypassed || !auth.user) return res.status(401).json({ error: 'Authentication required' })
  const payload = buildOwnedPairingPayload(auth.user.id, body.connectCode)
  if (!payload) return res.status(403).json({ error: 'Ownership not verified' })
  const paired = await completePreviewOwnedPairing({ config, payload })
  if (!paired.ok) return res.status(paired.code === 'unavailable' ? 503 : 409)
    .json({ error: 'Pairing was not completed' })
  return res.status(200).json({ status: 'linked', premiumAccessActive: false })
}
