import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test, expect, type APIRequestContext, type Page } from '@playwright/test'

/**
 * Release acceptance against the disposable local stack (stack.sh): real
 * Supabase Auth and PostgREST on the production-shaped schema, the production
 * build of the app, and the compiled API handlers running with production-like
 * secrets, public-mode flags and SMTP settings. Synthetic accounts only.
 *
 *   tests/acceptance/supabase-local/stack.sh start
 *   set -a; . /tmp/nil-acceptance-stack/env; set +a
 *   npx playwright test tests/acceptance/supabase-local
 */
const SUPABASE_URL = process.env.ACCEPTANCE_SUPABASE_URL
const ANON_KEY = process.env.ACCEPTANCE_ANON_KEY || ''
const SERVICE_KEY = process.env.ACCEPTANCE_SERVICE_KEY || ''
const SINK_LOG = process.env.ACCEPTANCE_SINK_LOG || ''
const RUN = process.env.ACCEPTANCE_RUN_ID || Date.now().toString(36)
const PASSWORD = 'Synthetic-Passw0rd-For-Acceptance'
const athleteA = { email: `athlete-a-${RUN}@example.test`, name: 'Synthetic Athlete A' }
const athleteB = { email: `athlete-b-${RUN}@example.test`, name: 'Synthetic Athlete B' }

test.skip(!SUPABASE_URL, 'Requires the local acceptance stack (tests/acceptance/supabase-local/stack.sh)')
// Tests share the synthetic accounts and run in file order on one worker.
test.describe.configure({ mode: 'default' })

test.beforeEach(async ({ context }) => {
	if (!process.env.ACCEPTANCE_VIDEO) return
	await context.addInitScript(() => {
		window.addEventListener('DOMContentLoaded', () => {
			const dot = document.createElement('div')
			dot.style.cssText = 'position:fixed;z-index:2147483647;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:rgba(255,64,64,.8);border:2px solid #fff;pointer-events:none;left:-20px;top:-20px'
			document.body.appendChild(dot)
			window.addEventListener('mousemove', e => { dot.style.left = `${e.clientX}px`; dot.style.top = `${e.clientY}px` }, true)
		})
	})
})

type Sinks = { smtpConnections: number; apiCalls: { path: string; status: number; location: string | null; threw?: string }[] }
const sinks = (): Sinks => JSON.parse(readFileSync(SINK_LOG, 'utf8'))

async function passwordGrant(request: APIRequestContext, email: string, password: string) {
	return request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
		headers: { apikey: ANON_KEY },
		data: { email, password },
	})
}

async function tokenFor(request: APIRequestContext, email: string) {
	const res = await passwordGrant(request, email, PASSWORD)
	expect(res.status()).toBe(200)
	const body = await res.json()
	return { token: body.access_token as string, id: body.user.id as string }
}

function rest(request: APIRequestContext, token: string) {
	const headers = { apikey: ANON_KEY, authorization: `Bearer ${token}`, prefer: 'return=representation' }
	return {
		get: (path: string) => request.get(`${SUPABASE_URL}/rest/v1/${path}`, { headers }),
		post: (path: string, data: unknown) => request.post(`${SUPABASE_URL}/rest/v1/${path}`, { headers, data }),
		patch: (path: string, data: unknown) => request.patch(`${SUPABASE_URL}/rest/v1/${path}`, { headers, data }),
	}
}

async function hasSupabaseSession(page: Page) {
	return page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('sb-') && k.includes('auth-token')))
}

async function logIn(page: Page, email: string, password: string) {
	await page.goto('/auth/login')
	await expect(page.getByTestId('login-form')).toBeVisible({ timeout: 15000 })
	await page.getByTestId('login-email').fill(email)
	await page.getByTestId('login-password').fill(password)
	await page.getByTestId('login-submit').click()
}

async function expectSignedIn(page: Page) {
	// First sign-in in a fresh browser lands on onboarding, which needs a session.
	await page.waitForURL(url => /^\/(app|onboarding)/.test(url.pathname), { timeout: 20000 })
	if (new URL(page.url()).pathname.startsWith('/onboarding')) {
		await expect(page.getByTestId('onboarding-page')).toBeVisible({ timeout: 15000 })
	}
	await expect(page.getByTestId('auth-gate-login')).toHaveCount(0)
	await expect(page.getByTestId('onboarding-go-login')).toHaveCount(0)
	expect(await hasSupabaseSession(page)).toBe(true)
}

test('4/6: Supabase signup creates the account and its profiles row', async ({ page, request }) => {
	await page.goto('/auth/signup')
	await expect(page.getByTestId('signup-form')).toBeVisible({ timeout: 15000 })
	await page.getByTestId('signup-display-name').fill(athleteA.name)
	await page.getByTestId('signup-role').selectOption('athlete')
	await page.getByTestId('signup-email').fill(athleteA.email)
	await page.getByTestId('signup-password').fill(PASSWORD)
	await page.getByTestId('signup-password-confirm').fill(PASSWORD)
	await page.getByTestId('signup-terms').check()
	await page.getByTestId('signup-submit').click()
	await expectSignedIn(page)

	const { id } = await tokenFor(request, athleteA.email)
	const rows = await (await rest(request, SERVICE_KEY).get(`profiles?id=eq.${id}&select=id,user_id,email,full_name,role,terms_version`)).json()
	expect(rows).toHaveLength(1)
	expect(rows[0]).toMatchObject({ id, user_id: id, email: athleteA.email, full_name: athleteA.name, role: 'athlete' })
	expect(rows[0].terms_version).toBeTruthy()

	const second = await request.post(`${SUPABASE_URL}/auth/v1/signup`, {
		headers: { apikey: ANON_KEY },
		data: { email: athleteB.email, password: PASSWORD, data: { full_name: athleteB.name, role: 'athlete' } },
	})
	expect(second.status()).toBe(200)
})

test('5: invalid Supabase credentials are rejected without a session', async ({ page, request }) => {
	await logIn(page, athleteA.email, 'not-the-password')
	await expect(page.getByTestId('login-error')).toContainText(/invalid|incorrect/i, { timeout: 15000 })
	expect(new URL(page.url()).pathname).toBe('/auth/login')
	expect(await hasSupabaseSession(page)).toBe(false)

	expect((await passwordGrant(request, athleteA.email, 'not-the-password')).status()).toBe(400)
	expect((await passwordGrant(request, `nobody-${RUN}@example.test`, PASSWORD)).status()).toBe(400)
})

test('4/7: Supabase login, session restoration on reload, and logout', async ({ page }) => {
	await logIn(page, athleteA.email, PASSWORD)
	await expectSignedIn(page)

	await page.reload()
	await expectSignedIn(page)
	await page.goto('/app/recruiting/board')
	await expect(page.getByText('To Contact')).toBeVisible({ timeout: 15000 })
	await expect(page.getByTestId('auth-gate-login')).toHaveCount(0)

	await page.getByRole('button', { name: athleteA.name }).click()
	await page.getByRole('button', { name: 'Log out' }).click()
	await page.waitForURL(url => url.pathname === '/auth/login', { timeout: 15000 })
	expect(await hasSupabaseSession(page)).toBe(false)
	await page.goto('/app/recruiting/board')
	await expect(page.getByTestId('auth-gate-login')).toBeVisible({ timeout: 15000 })
})

test('8/14: board persistence and cross-account isolation', async ({ page, request }) => {
	const a = await tokenFor(request, athleteA.email)
	const b = await tokenFor(request, athleteB.email)
	const asA = rest(request, a.token)
	const asB = rest(request, b.token)

	const [org] = await (await asA.post('orgs', { name: `Synthetic University ${RUN}`, sport: 'Soccer', level: 'NCAA D1', owner_id: a.id })).json()
	expect((await asA.post('org_contacts', { org_id: org.id, name: 'Synthetic Coach', email: 'coach@example.test' })).status()).toBe(201)
	const [target] = await (await asA.post('user_targets', { user_id: a.id, org_id: org.id })).json()

	await logIn(page, athleteA.email, PASSWORD)
	await expectSignedIn(page)
	await page.goto('/app/recruiting/board')
	const card = page.locator('div.bg-mid', { hasText: org.name })
	await expect(card).toBeVisible({ timeout: 15000 })
	await card.getByRole('button', { name: 'Contacted', exact: true }).click()
	await expect.poll(async () => (await (await asA.get(`user_targets?id=eq.${target.id}&select=status`)).json())[0]?.status).toBe('Contacted')

	await page.reload()
	const contacted = page.locator('div', { has: page.getByText('Contacted', { exact: true }) }).locator('div.bg-mid', { hasText: org.name })
	await expect(contacted.first()).toBeVisible({ timeout: 15000 })

	expect(await (await asB.get(`user_targets?select=id`)).json()).toEqual([])
	expect(await (await asB.get(`orgs?id=eq.${org.id}`)).json()).toEqual([])
	expect(await (await asB.get(`org_contacts?org_id=eq.${org.id}`)).json()).toEqual([])
	expect(await (await asB.patch(`user_targets?id=eq.${target.id}`, { status: 'Committed' })).json()).toEqual([])
	expect((await asB.post('user_targets', { user_id: a.id, org_id: org.id })).status()).toBe(403)
	const profilesForB = await (await asB.get('profiles?select=id')).json()
	expect(profilesForB).toEqual([{ id: b.id }])
	expect(await (await rest(request, ANON_KEY).get('profiles?select=id')).json()).toEqual([])
	expect((await (await asA.get(`user_targets?id=eq.${target.id}&select=status`)).json())[0].status).toBe('Contacted')
})

test('8/9/10: outreach drafts stay usable while sending is closed to everyone', async ({ page, request }) => {
	await logIn(page, athleteA.email, PASSWORD)
	await expectSignedIn(page)
	await page.goto('/app/recruiting/blast')
	await expect(page.getByText('Recipients (from My Targets)')).toBeVisible({ timeout: 15000 })
	await expect(page.getByText('coach@example.test', { exact: false })).toBeVisible({ timeout: 15000 })
	await page.getByPlaceholder('Subject').fill('Synthetic recruiting draft')
	await page.getByRole('button', { name: 'Insert Template' }).click()
	await expect(page.getByPlaceholder('Body')).not.toHaveValue('')

	const fromApp = await page.evaluate(async () => {
		const res = await fetch('/api/recruiting/send', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				athlete: { fullName: 'Synthetic Athlete A', email: 'athlete@example.test' },
				coaches: [{ name: 'Coach', email: 'coach@example.test' }],
				subject: 's',
				body: 'b',
				clipUrl: 'https://example.test/clip',
			}),
		})
		return { status: res.status, body: await res.json() }
	})
	expect(fromApp).toEqual({ status: 503, body: { error: expect.stringMatching(/disabled/i), code: 'OUTREACH_DISABLED' } })
	await expect(page.getByPlaceholder('Subject')).toHaveValue('Synthetic recruiting draft')

	const { token } = await tokenFor(request, athleteA.email)
	const attempts: Record<string, string>[] = [{}, { authorization: `Bearer ${token}` }, { 'x-public-mode': 'true' }]
	for (const headers of attempts) {
		const res = await request.post('/api/recruiting/send', {
			headers,
			data: {
				athlete: { fullName: 'Anyone', email: 'spoofed@example.test' },
				coaches: [{ name: 'Anyone', email: 'anyone@example.test' }],
				clipUrl: 'https://example.test/clip',
				subject: 'relay',
				body: 'relay',
			},
		})
		expect(res.status()).toBe(503)
	}
	expect(sinks().smtpConnections).toBe(0)
})

test('1/2/3: legacy endpoints never issue sessions or create accounts', async ({ page, request, baseURL }) => {
	for (const path of ['/api/auth/login', '/api/auth/register']) {
		const res = await request.post(path, { data: { email: athleteA.email, password: PASSWORD, name: 'x' } })
		expect(res.status()).toBe(410)
		expect(res.headers()['set-cookie']).toBeUndefined()
		expect(await res.json()).toEqual({ error: expect.any(String), code: 'LEGACY_AUTH_DISABLED' })
	}
	const legacyDefault = 'dev-secret-change-me'
	const payload = Buffer.from(JSON.stringify({ userId: 'u', email: athleteA.email, exp: Date.now() + 3600_000 })).toString('base64url')
	const forged = `${payload}.${createHmac('sha256', legacyDefault).update(payload).digest('base64url')}`
	const me = await request.get('/api/auth/me', { headers: { cookie: `al_session=${forged}` } })
	expect(me.status()).toBe(410)
	expect(me.headers()['set-cookie']).toBeUndefined()

	await page.goto('/auth/login')
	const cookies = await page.context().cookies(baseURL)
	expect(cookies.find(c => c.name === 'al_session')).toBeUndefined()
	await page.goto('/app')
	await expect(page.getByTestId('auth-gate-login')).toBeVisible({ timeout: 15000 })
})

test('11: click tracking never redirects', async ({ request }) => {
	for (const url of ['https://evil.example/phish', '//evil.example', 'javascript:alert(1)', '/app', '']) {
		const res = await request.get(`/api/recruiting/track?type=click&id=synthetic&url=${encodeURIComponent(url)}`, { maxRedirects: 0 })
		expect(res.status()).toBe(410)
		expect(res.headers().location).toBeUndefined()
	}
	expect(sinks().apiCalls.filter(c => c.path === '/api/recruiting/track').every(c => c.location === null)).toBe(true)
})

test('12: Athlete Houze reporting stays disabled for a signed-in user', async ({ request }) => {
	const { token } = await tokenFor(request, athleteA.email)
	const res = await request.post('/api/integrations/athlete-houze/report', {
		headers: { authorization: `Bearer ${token}` },
		data: { clientId: 'synthetic-opportunity-1' },
	})
	expect(res.status()).toBe(503)
	expect(await res.json()).toEqual({ error: 'Integration unavailable' })
})

test('13: every API route loads and answers under the production runtime', async ({ request }) => {
	const routes = [
		'/api/auth/login', '/api/auth/logout', '/api/auth/me', '/api/auth/register', '/api/build-id',
		'/api/business/search', '/api/healthz', '/api/integrations/athlete-houze/report', '/api/ping',
		'/api/places-search', '/api/recruiting/search', '/api/recruiting/send', '/api/recruiting/track', '/api/waitlist',
	]
	for (const path of routes) {
		const res = await request.get(path, { maxRedirects: 0 })
		expect(res.headers()['content-type'] ?? '', path).not.toContain('text/html')
	}
	const calls = sinks().apiCalls.filter(c => routes.includes(c.path))
	expect(new Set(calls.map(c => c.path)).size).toBe(routes.length)
	expect(calls.filter(c => c.threw)).toEqual([])
})
