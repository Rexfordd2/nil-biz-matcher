import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const mock = vi.hoisted(() => ({
  getUser: vi.fn(),
  pairing: vi.fn(),
  config: vi.fn(),
}))

vi.mock('../../_lib/getAuthenticatedSupabaseUser', () => ({
  getAuthenticatedSupabaseUser: (...args: unknown[]) => mock.getUser(...args),
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

function makeRequest(body: unknown = valid, overrides: Record<string, unknown> = {}): VercelRequest {
  return {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
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
    mock.config.mockReturnValue({
      endpoint: 'https://houze-beta-test.vercel.app/api/integrations/nil-roster/complete-link',
      nilRosterOrigin: origin,
      secret: 'a'.repeat(40),
    })
    mock.getUser.mockResolvedValue({ bypassed: false, user: { id: sourceUser } })
    mock.pairing.mockResolvedValue({ ok: true })
  })

  it('fails closed when no preview-only integration is configured', async () => {
    mock.config.mockReturnValue(null)
    const { res, state } = makeResponse()
    await handler(makeRequest(), res)
    expect(state.statusCode).toBe(503)
    expect(mock.getUser).not.toHaveBeenCalled()
    expect(mock.pairing).not.toHaveBeenCalled()
  })

  it('rejects origin mismatch, missing consent and ID injection before auth', async () => {
    for (const request of [
      makeRequest(valid, { headers: { origin: 'https://evil.example', 'content-type': 'application/json' } }),
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

  it('rejects public-mode auth bypass and missing authentication', async () => {
    for (const authenticated of [
      { bypassed: true, user: null },
      { bypassed: false, user: null },
    ]) {
      mock.getUser.mockResolvedValueOnce(authenticated)
      const { res, state } = makeResponse()
      await handler(makeRequest(), res)
      expect(state.statusCode).toBe(401)
    }
    expect(mock.pairing).not.toHaveBeenCalled()
  })

  it('requires source-verified ownership and never advertises premium access', async () => {
    const { res, state, headers } = makeResponse()
    await handler(makeRequest(), res)
    expect(state.statusCode).toBe(200)
    expect(state.body).toEqual({ status: 'linked', premiumAccessActive: false })
    expect(headers.get('Cache-Control')).toBe('private, no-store')
    const call = mock.pairing.mock.calls[0][0]
    expect(call.payload.externalAthleteId).toBe(sourceUser)
    expect(call.payload.athleteConsent).toBe(true)
    expect(call.payload.backfillConsented).toBe(false)
    expect(JSON.stringify(call)).not.toContain('different-user')
    expect(JSON.stringify(call)).not.toContain('email')
  })

  it('does not report a connection when the remote server rejects it', async () => {
    mock.pairing.mockResolvedValue({ ok: false, code: 'rejected' })
    const { res, state } = makeResponse()
    await handler(makeRequest(), res)
    expect(state.statusCode).toBe(409)
  })
})
