import { execFileSync } from 'node:child_process'
import { createHmac, randomBytes } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import handler from './connect'

const suite = process.env.NIL_DISPOSABLE_ROUTE_PROOF === 'true' ? describe : describe.skip
const houze = 'https://houze-beta-test.vercel.app/api/integrations/nil-roster/complete-link'
const disconnect = 'https://houze-beta-test.vercel.app/api/integrations/nil-roster/server-disconnect'
const origin = 'https://nil-preview-test.vercel.app'
const code = 'AHNR-ABCD-2345'
const secret = 'test-only-' + 'A'.repeat(55)
const athleteId = '96bf779f-d03a-4fa5-bcc7-7bbd69f0fd53'
const identityId = '75bf779f-d03a-4fa5-bcc7-7bbd69f0fd53'
const ids: string[] = []
const tokens: string[] = []
let admin: ReturnType<typeof createClient>
let nativeFetch: typeof fetch
let anonKey: string
let apiUrl: string

function request(token: string, body: unknown = { connectCode: code, athleteConsent: true }): VercelRequest {
  return {
    method: 'POST',
    headers: { origin, authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body,
  } as unknown as VercelRequest
}

function response() {
  const res = {
    code: 200,
    jsonBody: null as unknown,
    headers: new Map<string, unknown>(),
    setHeader(k: string, v: unknown) { this.headers.set(k, v); return this },
    status(n: number) { this.code = n; return this },
    json(b: unknown) { this.jsonBody = b; return this },
  }
  return res
}

suite('NIL preview source route with REAL local GoTrue', () => {
  beforeAll(async () => {
    if (process.env.GITHUB_ACTIONS !== 'true' || process.env.CI !== 'true')
      throw new Error('Only isolated hosted CI is permitted')
    const raw = execFileSync('supabase', ['status', '-o', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const st = JSON.parse(raw.slice(raw.indexOf('{')))
    const url = st.API_URL as string
    const u = new URL(url)
    if (u.protocol !== 'http:' || !['localhost', '127.0.0.1', '::1'].includes(u.hostname))
      throw new Error('Refusing non-local Supabase')
    const anon = st.ANON_KEY || st.PUBLISHABLE_KEY
    const service = st.SERVICE_ROLE_KEY || st.SECRET_KEY
    if (!anon || !service) throw new Error('Missing disposable Auth keys')
    apiUrl = url
    anonKey = anon
    Object.assign(process.env, {
      VERCEL_ENV: 'preview',
      NIL_ROSTER_PREVIEW_DATABASE_ASSERTION: 'confirmed_non_production',
      VITE_SUPABASE_URL: url,
      VITE_SUPABASE_ANON_KEY: anon,
      ATHLETE_HOUZE_PAIRING_URL: houze,
      ATHLETE_HOUZE_PAIRING_HMAC_SECRET: secret,
      NIL_ROSTER_PREVIEW_ORIGIN: origin,
    })
    admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
    const suffix = randomBytes(8).toString('hex')
    const password = randomBytes(20).toString('base64url')
    for (const index of ['a', 'b']) {
      const email = 'nil-proof-' + index + '-' + suffix + '@example.invalid'
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
      expect(error).toBeNull()
      expect(data.user).toBeTruthy()
      ids.push(data.user!.id)
      const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
      const login = await client.auth.signInWithPassword({ email, password })
      expect(login.error).toBeNull()
      expect(login.data.session).toBeTruthy()
      tokens.push(login.data.session!.access_token)
    }
    nativeFetch = globalThis.fetch
  }, 120_000)

  afterAll(async () => {
    if (nativeFetch) globalThis.fetch = nativeFetch
    for (const id of ids) await admin.auth.admin.deleteUser(id)
    delete process.env.ATHLETE_HOUZE_PAIRING_HMAC_SECRET
  }, 60_000)

  it('authenticates both separate source accounts, persists enrollment, and signs their distinct IDs', async () => {
    const delivered: Array<{ body: Record<string, unknown>; signature: string; timestamp: string }> = []
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === houze) {
        const raw = String(init?.body)
        const head = new Headers(init?.headers)
        const signature = head.get('x-ah-signature') ?? ''
        const timestamp = head.get('x-ah-timestamp') ?? ''
        const digest = createHmac('sha256', secret).update(timestamp + '.' + raw).digest('hex')
        expect(signature).toBe('sha256=' + digest)
        delivered.push({ body: JSON.parse(raw), signature, timestamp })
        return Response.json({
          status: 'linked',
          enrollmentKind: 'production',
          athleteId,
          identityId,
          backfillConsented: false,
        })
      }
      if (url === disconnect) {
        return Response.json({ ok: true, disconnected: true })
      }
      return nativeFetch(input, init)
    }) as typeof fetch

    for (const token of tokens) {
      const res = response()
      await handler(request(token), res as unknown as VercelResponse)
      expect(res.code).toBe(200)
      expect(res.jsonBody).toEqual({
        status: 'linked',
        premiumAccessActive: false,
        enrollmentKind: 'production',
        athleteId,
        identityId,
      })
    }
    expect(delivered.map(d => d.body.externalAthleteId)).toEqual(ids)
    expect(delivered.every(d => d.body.athleteConsent === true && d.body.backfillConsented === false)).toBe(true)
    expect(ids[0]).not.toBe(ids[1])

    for (const userId of ids) {
      const { data, error } = await admin
        .from('athlete_houze_enrollments')
        .select('user_id, houze_athlete_id, status, consent_scope, disconnected_at')
        .eq('user_id', userId)
        .maybeSingle()
      expect(error).toBeNull()
      expect(data).toEqual({
        user_id: userId,
        houze_athlete_id: athleteId,
        status: 'linked',
        consent_scope: 'restricted',
        disconnected_at: null,
      })
    }

    // Ownership isolation: user A cannot read user B enrollment via user JWT + RLS.
    const userA = createClient(apiUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: 'Bearer ' + tokens[0] } },
    })
    const { data: foreign, error: foreignError } = await userA
      .from('athlete_houze_enrollments')
      .select('user_id')
      .eq('user_id', ids[1])
      .maybeSingle()
    expect(foreignError).toBeNull()
    expect(foreign).toBeNull()
  }, 45_000)

  it('rejects unauthenticated, forged and cross-subject requests before source sends', async () => {
    const malformed = response()
    await handler(request(tokens[0], { connectCode: code, athleteConsent: true, externalAthleteId: ids[1] }), malformed as unknown as VercelResponse)
    expect(malformed.code).toBe(400)
    const unauthenticated = response()
    await handler(request('invalid-test-token'), unauthenticated as unknown as VercelResponse)
    expect(unauthenticated.code).toBe(401)
  }, 45_000)
})
