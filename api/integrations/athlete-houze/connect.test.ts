import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const mock = vi.hoisted(() => ({
  getUser: vi.fn(),
  pairing: vi.fn(),
  config: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mock.createClient(...args),
}))
vi.mock('../../_lib/athleteHouzePairing', async importOriginal => {
  const real = await importOriginal<typeof import('../../_lib/athleteHouzePairing')>()
  return {
    ...real,
    loadPreviewPairingConfig: () => mock.config(),
    completePreviewOwnedPairing: (...args: unknown[]) => mock.pairing(...args),
  }
})

import handler from './connect'

const origin = 'https://nil-preview-test.vercel.app'
const valid = { connectCode: 'AHNR-ABCD-2345', athleteConsent: true }
const sourceUser = '9a76b680-4523-4852-9721-eaa1bc943f1c'
const testToken = 'synthetic-preview-token-not-real'

function makeRequest(body: unknown = valid, overrides: Record<string, unknown> = {}): VercelRequest {
  return {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json', authorization: 'Bearer ' + testToken },
    body,
    ...overrides,
  } as unknown as VercelRequest
}

function makeResponse() {
  const headers = new Map<string, unknown>()
  const res = {
    setHeader: vi.fn((k: string, v: unknown) => { headers.set(k, v); return res }),
    status: vi.fn((value: number) => { res.statusCode = value; return res }),
    json: vi.fn((value: unknown) => { res.body = value; return res }),
    statusCode: 200,
    body: null as unknown,
  }
  return { res: res as unknown as VercelResponse, state: res, headers }
}

describe('preview-only NIL Roster pairing HTTP guard', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.VITE_SUPABASE_URL = 'https://independent-nil-test.supabase.co'
    process.env.VITE_SUPABASE_ANON_KEY = 'synthetic-anon-key'
    mock.config.mockReturnValue({
      endpoint: 'https://houze-beta-test.vercel.app/api/integrations/nil-roster/complete-link',
      nilRosterOrigin: origin,
      secret: 'a'.repeat(40),
    })
    mock.createClient.mockImplementation(() => ({ auth: { getUser: mock.getUser } }))
    mock.getUser.mockResolvedValue({ data: { user: { id: sourceUser } }, error: null })
    mock.pairing.mockResolvedValue({ ok: true })
  })

  it('fails closed when preview-only integration is disabled', async () => {
    mock.config.mockReturnValue(null)
    const { res, state } = makeResponse()
    await handler(makeRequest(), res)
    expect(state.statusCode).toBe(503)
    expect(mock.createClient).not.toHaveBeenCalled()
    expect(mock.pairing).not.toHaveBeenCalled()
  })

  it('rejects wrong origin, consent omission, and injected athlete IDs before authentication', async () => {
    for (const request of [
      makeRequest(valid, { headers: { origin: 'https://evil.example', 'content-type': 'application/json', authorization: 'Bearer ' + testToken } }),
      makeRequest({ connectCode: valid.connectCode, athleteConsent: false }),
      makeRequest({ ...valid, externalAthleteId: 'different-user' }),
      makeRequest({ ...valid, backfillConsented: true }),
    ]) {
      const { res, state } = makeResponse()
      await handler(request, res)
      expect([400, 403]).toContain(state.statusCode)
    }
    expect(mock.getUser).not.toHaveBeenCalled()
  })

  it('requires a valid verified bearer session even when public mode is enabled', async () => {
    const request = makeRequest(valid, {
      headers: { origin, 'content-type': 'application/json' },
    })
    const { res, state } = makeResponse()
    await handler(request, res)
    expect(state.statusCode).toBe(401)
    expect(mock.createClient).not.toHaveBeenCalled()
    expect(mock.pairing).not.toHaveBeenCalled()

    mock.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    const denied = makeResponse()
    await handler(makeRequest(), denied.res)
    expect(denied.state.statusCode).toBe(401)
    expect(mock.pairing).not.toHaveBeenCalled()
  })

  it('verifies the browser token with source GoTrue and never advertises premium access', async () => {
    const { res, state, headers } = makeResponse()
    await handler(makeRequest(), res)
    expect(state.statusCode).toBe(200)
    expect(state.body).toEqual({ status: 'linked', premiumAccessActive: false })
    expect(headers.get('Cache-Control')).toBe('private, no-store')
    expect(mock.getUser).toHaveBeenCalledWith(testToken)
    const call = mock.pairing.mock.calls[0][0]
    expect(call.payload.externalAthleteId).toBe(sourceUser)
    expect(call.payload.athleteConsent).toBe(true)
    expect(call.payload.backfillConsented).toBe(false)
    expect(JSON.stringify(call)).not.toContain('different-user')
    expect(JSON.stringify(call)).not.toContain('email')
  })

  it('never reports success on a rejected remote pair or unavailable source Auth', async () => {
    mock.pairing.mockResolvedValueOnce({ ok: false, code: 'rejected' })
    const { res, state } = makeResponse()
    await handler(makeRequest(), res)
    expect(state.statusCode).toBe(409)
    mock.getUser.mockRejectedValueOnce(new Error('unavailable'))
    const authFailed = makeResponse()
    await handler(makeRequest(), authFailed.res)
    expect(authFailed.state.statusCode).toBe(401)
  })
})
