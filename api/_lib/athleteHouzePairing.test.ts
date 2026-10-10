import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  buildOwnedPairingPayload,
  completePreviewOwnedPairing,
  loadPreviewPairingConfig,
} from './athleteHouzePairing'

const secret = 'test-secret-only-not-for-real-runtime-0123456789abcdef'
const endpoint = 'https://houze-beta-test.vercel.app/api/integrations/nil-roster/complete-link'
const env = {
  VERCEL_ENV: 'preview',
  ATHLETE_HOUZE_PAIRING_URL: endpoint,
  ATHLETE_HOUZE_PAIRING_HMAC_SECRET: secret,
  NIL_ROSTER_PREVIEW_ORIGIN: 'https://nil-preview-test.vercel.app',
  NIL_ROSTER_PREVIEW_DATABASE_ASSERTION: 'confirmed_non_production',
  VITE_SUPABASE_URL: 'https://independent-nil-test.supabase.co',
}
const sourceId = '9a76b680-4523-4852-9721-eaa1bc943f1c'
const code = 'AHNR-ABCD-2345'

describe('preview-only Athlete Houze account pairing contract', () => {
  it('refuses missing configuration and all production endpoints', () => {
    expect(loadPreviewPairingConfig({})).toBeNull()
    expect(loadPreviewPairingConfig({ ...env, VERCEL_ENV: 'production' })).toBeNull()
    expect(loadPreviewPairingConfig({ ...env, NIL_ROSTER_PREVIEW_DATABASE_ASSERTION: undefined })).toBeNull()
    expect(loadPreviewPairingConfig({ ...env, VITE_SUPABASE_URL: 'https://duuvyyvfqbzozuhzlbek.supabase.co' })).toBeNull()
    expect(loadPreviewPairingConfig({ ...env, VITE_SUPABASE_URL: 'https://puwjpnmlfwaxtrjtxxsj.supabase.co' })).toBeNull()
    expect(loadPreviewPairingConfig({ ...env, ATHLETE_HOUZE_PAIRING_URL: 'https://athletehouze.com/api/integrations/nil-roster/complete-link' })).toBeNull()
    expect(loadPreviewPairingConfig({ ...env, ATHLETE_HOUZE_PAIRING_URL: 'https://beta.athletehouze.com/api/integrations/nil-roster/complete-link' })).toBeNull()
    expect(loadPreviewPairingConfig({ ...env, ATHLETE_HOUZE_PAIRING_HMAC_SECRET: 'short' })).toBeNull()
    expect(loadPreviewPairingConfig({ ...env, ATHLETE_HOUZE_PAIRING_URL: 'https://houze-beta-test.vercel.app/other' })).toBeNull()
    expect(loadPreviewPairingConfig(env)?.endpoint).toBe(endpoint)
  })

  it('always uses server-authenticated source user identity instead of claims from request body', () => {
    expect(buildOwnedPairingPayload(sourceId, code)).toEqual({
      connectCode: code,
      externalAthleteId: sourceId,
      athleteConsent: true,
      backfillConsented: false,
    })
    expect(buildOwnedPairingPayload('user@example.com', code)).toBeNull()
    expect(buildOwnedPairingPayload(sourceId, 'AHNR-INVALID')).toBeNull()
  })

  it('sends a correctly signed, privacy-minimized partner request and requires linked acknowledgment', async () => {
    const payload = buildOwnedPairingPayload(sourceId, code)!
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 'linked',
      enrollmentKind: 'production',
      athleteId: '96bf779f-d03a-4fa5-bcc7-7bbd69f0fd53',
      identityId: '75bf779f-d03a-4fa5-bcc7-7bbd69f0fd53',
      backfillConsented: false,
    }), { status: 200 }))
    expect(await completePreviewOwnedPairing({
      config: loadPreviewPairingConfig(env)!,
      payload,
      timestampSeconds: 1791500000,
      fetchImpl,
    })).toEqual({
      ok: true,
      ack: {
        athleteId: '96bf779f-d03a-4fa5-bcc7-7bbd69f0fd53',
        identityId: '75bf779f-d03a-4fa5-bcc7-7bbd69f0fd53',
      },
    })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(endpoint)
    expect(init.redirect).toBe('error')
    expect(init.body).not.toContain('email')
    const expected = createHmac('sha256', secret).update('1791500000.' + init.body).digest('hex')
    expect(init.headers['x-ah-signature']).toBe('sha256=' + expected)
    expect(init.headers['x-ah-source']).toBe('nil_roster')
  })

  it('rejects incomplete or canary source acknowledgments despite HTTP 200', async () => {
    const payload = buildOwnedPairingPayload(sourceId, code)!
    const base = {
      status: 'linked',
      enrollmentKind: 'production',
      athleteId: '96bf779f-d03a-4fa5-bcc7-7bbd69f0fd53',
      identityId: '75bf779f-d03a-4fa5-bcc7-7bbd69f0fd53',
      backfillConsented: false,
    }
    for (const body of [
      { ...base, enrollmentKind: 'canary' },
      { ...base, athleteId: 'fake' },
      { ...base, identityId: '' },
      { ...base, backfillConsented: true },
    ]) {
      const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))
      expect(await completePreviewOwnedPairing({
        config: loadPreviewPairingConfig(env)!,
        payload,
        fetchImpl,
      })).toEqual({ ok: false, code: 'rejected' })
    }
  })

  it('does not turn HTTP 200 without a real linked acknowledgment into success', async () => {
    const payload = buildOwnedPairingPayload(sourceId, code)!
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{"accepted":true}', { status: 200 }))
    expect(await completePreviewOwnedPairing({
      config: loadPreviewPairingConfig(env)!, payload, fetchImpl,
    })).toEqual({ ok: false, code: 'rejected' })
    fetchImpl.mockRejectedValue(new Error('network unavailable'))
    expect(await completePreviewOwnedPairing({
      config: loadPreviewPairingConfig(env)!, payload, fetchImpl,
    })).toEqual({ ok: false, code: 'unavailable' })
  })
})
