import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const athleteId = '96bf779f-d03a-4fa5-bcc7-7bbd69f0fd53'
const identityId = '75bf779f-d03a-4fa5-bcc7-7bbd69f0fd53'

const mock = vi.hoisted(() => ({
  getUser: vi.fn(),
  pairing: vi.fn(),
  config: vi.fn(),
  createClient: vi.fn(),
  upsert: vi.fn(),
  fetch: vi.fn(),
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
const linkedAck = {
  ok: true as const,
  ack: { athleteId, identityId },
}
const linkedBody = {
  status: 'linked',
  premiumAccessActive: false,
  enrollmentKind: 'production',
  athleteId,
  identityId,
}

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
    mock.createClient.mockImplementation(() => ({
      auth: { getUser: mock.getUser },
      from: () => ({
        upsert: mock.upsert,
      }),
    }))
    mock.getUser.mockResolvedValue({ data: { user: { id: sourceUser } }, error: null })
    mock.pairing.mockResolvedValue(linkedAck)
    mock.upsert.mockResolvedValue({ error: null })
    mock.fetch.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', mock.fetch)
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

  it('verifies the browser token with source GoTrue, persists enrollment, and never advertises premium access', async () => {
    const { res, state, headers } = makeResponse()
    await handler(makeRequest(), res)
    expect(state.statusCode).toBe(200)
    expect(state.body).toEqual(linkedBody)
    expect(headers.get('Cache-Control')).toBe('private, no-store')
    expect(mock.getUser).toHaveBeenCalledWith(testToken)
    const call = mock.pairing.mock.calls[0][0]
    expect(call.payload.externalAthleteId).toBe(sourceUser)
    expect(call.payload.athleteConsent).toBe(true)
    expect(call.payload.backfillConsented).toBe(false)
    expect(JSON.stringify(call)).not.toContain('different-user')
    expect(JSON.stringify(call)).not.toContain('email')
    expect(mock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: sourceUser,
        houze_athlete_id: athleteId,
        consent_scope: 'restricted',
        status: 'linked',
        disconnected_at: null,
        last_error: null,
      }),
      { onConflict: 'user_id' },
    )
    expect(mock.fetch).not.toHaveBeenCalled()
  })

  it('compensates with a signed Houze disconnect when enrollment persistence fails', async () => {
    mock.upsert.mockResolvedValueOnce({ error: { message: 'rls_denied' } })
    const { res, state } = makeResponse()
    await handler(makeRequest(), res)
    expect(state.statusCode).toBe(500)
    expect(state.body).toEqual({ error: 'enrollment_write_failed' })
    expect(mock.fetch).toHaveBeenCalledTimes(1)
    const [url, init] = mock.fetch.mock.calls[0]
    expect(url).toBe('https://houze-beta-test.vercel.app/api/integrations/nil-roster/server-disconnect')
    expect(init.method).toBe('POST')
    expect(init.headers['x-ah-source']).toBe('nil_roster')
    expect(init.headers['x-ah-signature']).toMatch(/^sha256=[0-9a-f]+$/)
    expect(JSON.parse(init.body)).toEqual({ externalAthleteId: sourceUser })
  })

  it('never reports success on a rejected remote pair or unavailable source Auth', async () => {
    mock.pairing.mockResolvedValueOnce({ ok: false, code: 'rejected' })
    const { res, state } = makeResponse()
    await handler(makeRequest(), res)
    expect(state.statusCode).toBe(409)
    expect(mock.upsert).not.toHaveBeenCalled()
    mock.getUser.mockRejectedValueOnce(new Error('unavailable'))
    const authFailed = makeResponse()
    await handler(makeRequest(), authFailed.res)
    expect(authFailed.state.statusCode).toBe(401)
  })
})
