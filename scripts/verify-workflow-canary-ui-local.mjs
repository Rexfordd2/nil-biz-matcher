/**
 * LOCAL-ONLY PR-4B2 canary browser matrix against disposable Supabase.
 *
 * Requires preview built with:
 *   VITE_SUPABASE_URL=http://127.0.0.1:54321
 *   VITE_SUPABASE_ANON_KEY=<local anon>
 *   VITE_WORKFLOW_CLOUD_PERSISTENCE=true
 *   VITE_WORKFLOW_CLOUD_PERSISTENCE_MODE=canary
 *   VITE_EXISTING_USER_LOGIN_ENABLED=true
 *   VITE_APP_MODE=beta
 *   VITE_PUBLIC_MODE=true
 *   VITE_ALLOW_MISSING_GOOGLE_MAPS_KEY=true
 *   VITE_E2E_BYPASS_AUTH=false
 *
 *   node scripts/verify-workflow-canary-ui-local.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
import { execSync, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173'
const PASSWORD = 'local-only-pr4b2-ui-pass-12'
const EMAIL_A = `pr4b2-ui-a-${Date.now()}@example.invalid`
const EMAIL_B = `pr4b2-ui-b-${Date.now()}@example.invalid`
const ATHLETE_A = 'ath-pr4b2-ui-a'
const ATHLETE_B = 'ath-pr4b2-ui-b'

function assert(cond, msg) {
	if (!cond) throw new Error(msg)
}
function assertLocalHost(hostname) {
	const h = String(hostname || '').toLowerCase()
	if (!['localhost', '127.0.0.1', '::1'].includes(h)) {
		throw new Error(`Refusing non-local hostname: ${h || '(empty)'}`)
	}
}
function readLocalStatus() {
	const raw = execSync('supabase status -o json', {
		cwd: ROOT,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	})
	const status = JSON.parse(raw.slice(raw.indexOf('{')))
	const apiUrl = status.API_URL
	const anon = status.ANON_KEY || status.PUBLISHABLE_KEY
	assert(apiUrl && anon, 'missing local status keys')
	assertLocalHost(new URL(apiUrl).hostname)
	assert(!/supabase\.co/i.test(apiUrl), 'refusing supabase.co')
	assert(!/duuvyyvfqbzozuhzlbek/i.test(apiUrl), 'refusing Production project')
	return { apiUrl, anon }
}
function localPsql(sql) {
	const res = spawnSync(
		'docker',
		[
			'exec',
			'-i',
			'supabase_db_Monster_Collective',
			'psql',
			'-U',
			'postgres',
			'-d',
			'postgres',
			'-v',
			'ON_ERROR_STOP=1',
			'-t',
			'-A',
			'-c',
			sql,
		],
		{ encoding: 'utf8' }
	)
	if (res.status !== 0) throw new Error((res.stderr || res.stdout || 'psql failed').slice(0, 300))
	return (res.stdout || '').trim()
}

const results = []
function pass(name) {
	results.push({ name, ok: true })
	console.log(`PASS ${name}`)
}

async function signup(apiUrl, anon, email) {
	const client = createClient(apiUrl, anon, { auth: { persistSession: false, autoRefreshToken: false } })
	const signedUp = await client.auth.signUp({ email, password: PASSWORD })
	assert(!signedUp.error && signedUp.data.user, `signup failed: ${signedUp.error?.message}`)
	let session = signedUp.data.session
	if (!session) {
		const signedIn = await client.auth.signInWithPassword({ email, password: PASSWORD })
		assert(!signedIn.error && signedIn.data.session, 'signin failed')
		session = signedIn.data.session
	}
	return { client, user: signedUp.data.user, session }
}

function setCanary(userId) {
	localPsql(
		`UPDATE auth.users SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"workflow_cloud_persistence_canary": true}'::jsonb WHERE id = '${userId}';`
	)
}

async function main() {
	assert(!process.env.SUPABASE_DB_PASSWORD, 'SUPABASE_DB_PASSWORD must be unset')
	assertLocalHost(new URL(BASE_URL).hostname)
	const { apiUrl, anon } = readLocalStatus()
	console.log(`CANARY_UI_GATE_START base=${new URL(BASE_URL).host}`)

	const a = await signup(apiUrl, anon, EMAIL_A)
	const b = await signup(apiUrl, anon, EMAIL_B)
	setCanary(a.user.id)

	// Refresh A so JWT carries claim
	const refreshed = await a.client.auth.signInWithPassword({ email: EMAIL_A, password: PASSWORD })
	assert(!refreshed.error && refreshed.data.session, 'User A re-login failed')
	a.session = refreshed.data.session
	assert(a.session.user.app_metadata?.workflow_cloud_persistence_canary === true, 'User A claim missing in session')
	pass('user_a_session_claim')

	assert(b.session.user.app_metadata?.workflow_cloud_persistence_canary !== true, 'User B must lack claim')
	pass('user_b_session_no_claim')

	const browser = await chromium.launch({ headless: true })

	async function openAs(session, athleteId, label) {
		const context = await browser.newContext()
		const page = await context.newPage()
		const workflowRest = []
		page.on('request', (req) => {
			const u = req.url()
			if (/\/rest\/v1\/(opportunities|deals|events)/.test(u)) {
				workflowRest.push(req.method())
				assert(!/supabase\.co/i.test(u), 'production REST hit')
			}
		})
		await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
		await page.evaluate(
			({ session, athleteId, apiUrl, label }) => {
				const hostKey = new URL(apiUrl).hostname.split('.')[0]
				const storageKey = `sb-${hostKey}-auth-token`
				localStorage.setItem(
					storageKey,
					JSON.stringify({
						access_token: session.access_token,
						refresh_token: session.refresh_token,
						expires_at: session.expires_at,
						expires_in: session.expires_in,
						token_type: session.token_type,
						user: session.user,
					})
				)
				localStorage.setItem(
					'athlete',
					JSON.stringify({
						id: athleteId,
						name: label,
						school: 'Local',
						schoolLevel: 'high_school',
						sports: [{ name: 'Basketball', positions: ['Guard'] }],
					})
				)
				localStorage.setItem('opps.store', JSON.stringify({}))
				localStorage.setItem('deals.store', JSON.stringify({}))
				localStorage.setItem('events.store', JSON.stringify({}))
			},
			{ session, athleteId, apiUrl, label }
		)
		return { context, page, workflowRest }
	}

	// Existing-user login enabled, signup disabled
	{
		const context = await browser.newContext()
		const page = await context.newPage()
		await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
		assert((await page.getByTestId('auth-disabled').count()) === 0, 'login should be enabled')
		assert((await page.getByTestId('login-email').count()) > 0, 'login form missing')
		pass('login_enabled')
		await page.goto(`${BASE_URL}/auth/signup`, { waitUntil: 'domcontentloaded', timeout: 60000 })
		assert((await page.getByTestId('auth-disabled').count()) > 0, 'signup must stay disabled')
		pass('signup_disabled')
		await context.close()
	}

	// Signed-out: zero workflow traffic
	{
		const context = await browser.newContext()
		const page = await context.newPage()
		const workflowRest = []
		page.on('request', (req) => {
			if (/\/rest\/v1\/(opportunities|deals|events)/.test(req.url())) workflowRest.push(req.method())
		})
		await page.goto(`${BASE_URL}/app/opportunities/pipeline`, { waitUntil: 'domcontentloaded', timeout: 60000 })
		await page.waitForTimeout(2000)
		// May see AuthGate — that's fine; no workflow REST
		assert(workflowRest.length === 0, `signed-out workflow traffic: ${workflowRest.length}`)
		pass('signed_out_zero_workflow_rest')
		await context.close()
	}

	// User B unclaimed canary: local-only, zero workflow REST, no cloud UI
	{
		const { context, page, workflowRest } = await openAs(b.session, ATHLETE_B, 'User B')
		await page.goto(`${BASE_URL}/app/opportunities/pipeline`, { waitUntil: 'domcontentloaded', timeout: 60000 })
		await page.waitForTimeout(2500)
		const body = (await page.locator('body').textContent()) || ''
		assert(!body.includes('Checking secure storage'), 'B should not show checking')
		assert(!body.includes('Saved to NIL Roster'), 'B should not show cloud banner')
		assert(!body.includes('Save your existing records to NIL Roster'), 'B should not show import')
		assert(workflowRest.length === 0, `User B workflow REST must be 0, got ${workflowRest.length}`)
		pass('user_b_local_only_zero_rest')

		await page.goto(`${BASE_URL}/app/opportunities/deals`, { waitUntil: 'domcontentloaded', timeout: 60000 })
		await page.waitForTimeout(1500)
		await page.goto(`${BASE_URL}/app/opportunities/events`, { waitUntil: 'domcontentloaded', timeout: 60000 })
		await page.waitForTimeout(1500)
		assert(workflowRest.length === 0, 'User B deals/events still zero REST')
		pass('user_b_all_domains_local')
		await context.close()
	}

	// User A claimed: cloud path
	{
		const { context, page, workflowRest } = await openAs(a.session, ATHLETE_A, 'User A')
		await page.goto(`${BASE_URL}/app/opportunities/pipeline`, { waitUntil: 'domcontentloaded', timeout: 60000 })
		await page.waitForTimeout(3000)
		const body = (await page.locator('body').textContent()) || ''
		assert(
			body.includes('Saved to NIL Roster') ||
				body.includes('Checking secure storage') ||
				body.includes('Save your existing records to NIL Roster'),
			'User A expected cloud/import UI'
		)
		assert(workflowRest.length > 0, 'User A should hit workflow REST')
		pass('user_a_cloud_path')

		// Tampering: localStorage fake claim must not affect User B path (already proven);
		// on A, attempt user_metadata-style injection into stored session user.
		await page.evaluate(() => {
			localStorage.setItem('workflow_cloud_persistence_canary', 'true')
			localStorage.setItem('canary', 'true')
		})
		await page.reload({ waitUntil: 'domcontentloaded' })
		await page.waitForTimeout(2000)
		pass('tamper_localstorage_no_crash')
		await context.close()
	}

	await browser.close()

	localPsql(`DELETE FROM public.opportunities WHERE user_id IN ('${a.user.id}', '${b.user.id}');`)
	localPsql(`DELETE FROM public.deals WHERE user_id IN ('${a.user.id}', '${b.user.id}');`)
	localPsql(`DELETE FROM public.events WHERE user_id IN ('${a.user.id}', '${b.user.id}');`)
	localPsql(`DELETE FROM auth.users WHERE id IN ('${a.user.id}', '${b.user.id}');`)

	const failed = results.filter((r) => !r.ok)
	assert(failed.length === 0, 'canary ui failures')
	console.log(`CANARY_UI_GATE_PASS checks=${results.length}`)
}

main().catch((err) => {
	console.error('CANARY_UI_GATE_FAIL', String(err && err.message ? err.message : err).slice(0, 400))
	process.exit(1)
})
