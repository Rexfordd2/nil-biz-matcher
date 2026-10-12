/**
 * GitHub-hosted runner only: real local GoTrue/PostgREST synthetic two-user proof.
 * This deliberately REFUSES remote Supabase hosts and prints no JWTs or keys.
 * No payment, Athlete Houze linking, external email or production mutations.
 */
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

function assert(value, message) {
  if (!value) throw new Error(message)
}
function localHost(url) {
  const u = new URL(url)
  return ['127.0.0.1', 'localhost', '::1'].includes(u.hostname) &&
    u.protocol === 'http:' && Boolean(u.port)
}

async function main() {
  assert(process.env.GITHUB_ACTIONS === 'true' && process.env.CI === 'true',
    'This test only runs on the isolated GitHub-hosted CI runner')
  assert(!process.env.SUPABASE_ACCESS_TOKEN && !process.env.SUPABASE_DB_PASSWORD,
    'Remote Supabase project credentials must be absent')

  const raw = execFileSync('supabase', ['status', '-o', 'json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const position = raw.indexOf('{')
  assert(position >= 0, 'Missing local Supabase status JSON')
  const status = JSON.parse(raw.slice(position))
  const apiUrl = status.API_URL
  const anon = status.ANON_KEY || status.PUBLISHABLE_KEY
  const adminKey = status.SERVICE_ROLE_KEY || status.SECRET_KEY
  assert(apiUrl && localHost(apiUrl), 'Refusing a non-loopback Auth/PostgREST URL')
  assert(anon && adminKey, 'Missing disposable local Auth keys')

  const health = await fetch(apiUrl + '/auth/v1/health')
  assert(health.ok, 'Local GoTrue health check failed')

  const api = createClient(apiUrl, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const rest = await fetch(apiUrl + '/rest/v1/opportunities?select=id&limit=1', {
    headers: { apikey: anon, authorization: 'Bearer ' + anon },
  })
  assert(rest.ok, 'PostgREST workflow table unavailable; verify migrations and RLS')

  const admin = createClient(apiUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const suffix = randomBytes(8).toString('hex')
  const password = randomBytes(20).toString('base64url')
  const emailA = 'ci-nil-a-' + suffix + '@example.invalid'
  const emailB = 'ci-nil-b-' + suffix + '@example.invalid'
  const created = []
  try {
    for (const email of [emailA, emailB]) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      assert(!error && data?.user, 'Disposable GoTrue admin signup failed')
      created.push(data.user.id)
    }
    const a = createClient(apiUrl, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const b = createClient(apiUrl, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const aLogin = await a.auth.signInWithPassword({ email: emailA, password })
    const bLogin = await b.auth.signInWithPassword({ email: emailB, password })
    assert(aLogin.data?.session && !aLogin.error, 'A GoTrue login failed')
    assert(bLogin.data?.session && !bLogin.error, 'B GoTrue login failed')
    assert(aLogin.data.user.id !== bLogin.data.user.id, 'Synthetic users share a subject')
    console.log('PASS independent GoTrue synthetic sign-ins')

    const clientId = 'ci-nil-opp-' + suffix
    const insert = await a.from('opportunities').insert({
      user_id: created[0],
      client_id: clientId,
      title: 'Synthetic NIL opportunity',
      status: 'idea',
      category: 'other',
      payload: { synthetic_test_data: true },
    })
    assert(!insert.error, 'A cannot insert an owned opportunity: ' + insert.error?.code)
    const own = await a.from('opportunities').select('client_id')
      .eq('user_id', created[0]).eq('client_id', clientId)
    assert(!own.error && own.data?.length === 1, 'A cannot read owned opportunity')

    const other = await b.from('opportunities').select('client_id')
      .eq('user_id', created[0]).eq('client_id', clientId)
    assert(!other.error && other.data?.length === 0, 'B read A private record')

    const forbiddenUpdate = await b.from('opportunities').update({ status: 'active' })
      .eq('user_id', created[0]).eq('client_id', clientId).select('client_id')
    assert(!forbiddenUpdate.error && forbiddenUpdate.data?.length === 0,
      'B could update A private record')

    const forged = await b.from('opportunities').insert({
      user_id: created[0],
      client_id: 'forged-' + suffix,
      title: 'Forged',
      payload: {},
    })
    assert(Boolean(forged.error), 'B could insert opportunity with A ownership')
    console.log('PASS PostgREST owner A / unrelated B SELECT-UPDATE-INSERT denial')

    const refreshed = await a.auth.getUser()
    assert(!refreshed.error && refreshed.data.user?.id === created[0],
      'GoTrue session verification failed')
    console.log('PASS live GoTrue getUser and owned session')
    console.log('NIL_DISPOSABLE_AUTH_RLS_PASS')
  } finally {
    for (const id of created) {
      await admin.auth.admin.deleteUser(id)
    }
  }
}

main().catch(error => {
  console.error('NIL_DISPOSABLE_AUTH_RLS_FAIL:', error?.message ?? String(error))
  process.exitCode = 1
})
