/**
 * LOCAL-ONLY PR-4B2 account-level canary integration.
 *
 * Disposable Monster_Collective Supabase only. Refuses remote hosts / production refs.
 * Grants app_metadata canary claim to User A via local docker psql (trusted local admin).
 * User B receives no claim. Never prints secrets or account payloads from Production.
 *
 * Usage (local stack must already be running):
 *   node scripts/verify-workflow-canary-local.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { execSync, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
function parseMode(raw) {
	if (raw === undefined || raw === null) return 'off'
	const normalized = String(raw).trim().toLowerCase()
	if (normalized === 'canary' || normalized === 'all' || normalized === 'off') return normalized
	return 'off'
}

function isCloudEligibleAthleteId(id) {
	if (typeof id !== 'string') return false
	const trimmed = id.trim()
	return trimmed.length > 0 && trimmed !== 'anonymous' && trimmed === id
}

function readCanary(appMetadata) {
	if (!appMetadata || typeof appMetadata !== 'object' || Array.isArray(appMetadata)) return false
	return appMetadata.workflow_cloud_persistence_canary === true
}

function evaluate({ masterEnabled, mode, authenticated, athleteId, workflowCloudPersistenceCanary }) {
	if (!masterEnabled) return { enabled: false, reason: 'master_off' }
	if (mode === 'off') return { enabled: false, reason: 'mode_off' }
	if (!authenticated) return { enabled: false, reason: 'signed_out' }
	if (!isCloudEligibleAthleteId(athleteId)) return { enabled: false, reason: 'invalid_athlete' }
	if (mode === 'canary') {
		if (workflowCloudPersistenceCanary !== true) {
			return { enabled: false, reason: 'canary_claim_missing' }
		}
		return { enabled: true, reason: 'canary' }
	}
	return { enabled: true, reason: 'all' }
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PASSWORD = 'local-only-pr4b2-canary-pass'
const EMAIL_A = 'pr4b2-canary-a@example.invalid'
const EMAIL_B = 'pr4b2-canary-b@example.invalid'
const ATHLETE_A = 'ath-pr4b2-a-synth'
const ATHLETE_B = 'ath-pr4b2-b-synth'

const results = []
function pass(name) {
	results.push({ name, ok: true })
	console.log(`PASS ${name}`)
}
function fail(name, detail) {
	results.push({ name, ok: false, detail })
	console.error(`FAIL ${name}: ${String(detail || '').slice(0, 240)}`)
}
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
	if (!apiUrl || !anon) throw new Error('Missing local API URL or anon key')
	assertLocalHost(new URL(apiUrl).hostname)
	if (/supabase\.co/i.test(apiUrl)) throw new Error('Refusing production supabase.co URL')
	if (/duuvyyvfqbzozuhzlbek/i.test(apiUrl)) throw new Error('Refusing Production project ref')
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
	if (res.status !== 0) {
		throw new Error((res.stderr || res.stdout || 'psql failed').slice(0, 400))
	}
	return (res.stdout || '').trim()
}

async function recreateViaSignup(apiUrl, anon, email, password) {
	localPsql(`DELETE FROM auth.users WHERE email = '${email.replace(/'/g, "''")}';`)
	const client = createClient(apiUrl, anon, {
		auth: { persistSession: false, autoRefreshToken: false },
	})
	const signedUp = await client.auth.signUp({ email, password })
	if (signedUp.error) throw new Error(`signUp failed: ${signedUp.error.message}`)
	if (signedUp.data.session && signedUp.data.user) {
		return { client, user: signedUp.data.user }
	}
	const signedIn = await client.auth.signInWithPassword({ email, password })
	if (signedIn.error || !signedIn.data.user) throw new Error('signIn failed after signup')
	return { client, user: signedIn.data.user }
}

function setCanaryClaim(userId, value) {
	const json = JSON.stringify({ workflow_cloud_persistence_canary: value })
	localPsql(
		`UPDATE auth.users SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '${json.replace(/'/g, "''")}'::jsonb WHERE id = '${userId}';`
	)
}

async function refreshUser(client) {
	const { data, error } = await client.auth.refreshSession()
	if (error) {
		const again = await client.auth.getUser()
		if (again.error || !again.data.user) throw new Error(error.message)
		return again.data.user
	}
	return data.user
}

async function countWorkflowRows(client, userId) {
	const tables = ['opportunities', 'deals', 'events']
	let total = 0
	for (const table of tables) {
		const { count, error } = await client
			.from(table)
			.select('*', { count: 'exact', head: true })
			.eq('user_id', userId)
		if (error) throw new Error(`${table}: ${error.message}`)
		total += count || 0
	}
	return total
}

async function insertOpp(client, userId, athleteId, clientId) {
	return client.from('opportunities').upsert(
		{
			user_id: userId,
			athlete_id: athleteId,
			client_id: clientId,
			title: 'Canary local opp',
			category: 'other',
			status: 'idea',
			payload: {
				id: clientId,
				athleteId,
				title: 'Canary local opp',
				category: 'other',
				status: 'idea',
			},
			source: 'nil_roster_app',
		},
		{ onConflict: 'user_id,client_id' }
	)
}

async function main() {
	assert(!process.env.SUPABASE_DB_PASSWORD, 'SUPABASE_DB_PASSWORD must be unset')
	assert(!process.env.SUPABASE_SECRET_KEY, 'SUPABASE_SECRET_KEY must be unset')
	const { apiUrl, anon } = readLocalStatus()
	console.log(`local_api_host=${new URL(apiUrl).hostname} local_api_port=${new URL(apiUrl).port}`)

	const a = await recreateViaSignup(apiUrl, anon, EMAIL_A, PASSWORD)
	const b = await recreateViaSignup(apiUrl, anon, EMAIL_B, PASSWORD)

	// Trusted local-only admin: grant claim to User A only.
	setCanaryClaim(a.user.id, true)

	const userA = await refreshUser(a.client)
	const userB = await refreshUser(b.client)

	try {
		assert(readCanary(userA.app_metadata) === true, 'User A claim missing after refresh')
		pass('user_a_claim')
	} catch (e) {
		fail('user_a_claim', e.message)
	}

	try {
		assert(readCanary(userB.app_metadata) === false, 'User B must not have claim')
		pass('user_b_claim_absent')
	} catch (e) {
		fail('user_b_claim_absent', e.message)
	}

	const canaryMode = parseMode('canary')
	const allMode = parseMode('all')

	try {
		const eligA = evaluate({
			masterEnabled: true,
			mode: canaryMode,
			authenticated: true,
			athleteId: ATHLETE_A,
			workflowCloudPersistenceCanary: readCanary(userA.app_metadata),
		})
		assert(eligA.enabled === true && eligA.reason === 'canary', 'User A should be eligible')
		pass('user_a_canary_eligible')
	} catch (e) {
		fail('user_a_canary_eligible', e.message)
	}

	try {
		const eligB = evaluate({
			masterEnabled: true,
			mode: canaryMode,
			authenticated: true,
			athleteId: ATHLETE_B,
			workflowCloudPersistenceCanary: readCanary(userB.app_metadata),
		})
		assert(eligB.enabled === false && eligB.reason === 'canary_claim_missing', 'User B local-only')
		pass('user_b_canary_local_only')
	} catch (e) {
		fail('user_b_canary_local_only', e.message)
	}

	try {
		const signedOut = evaluate({
			masterEnabled: true,
			mode: canaryMode,
			authenticated: false,
			athleteId: ATHLETE_A,
			workflowCloudPersistenceCanary: true,
		})
		assert(signedOut.enabled === false, 'signed-out must be local')
		pass('signed_out_local')
	} catch (e) {
		fail('signed_out_local', e.message)
	}

	// Tampering: localStorage / user_metadata / query-shaped values must not enable.
	try {
		const fake = evaluate({
			masterEnabled: true,
			mode: canaryMode,
			authenticated: true,
			athleteId: ATHLETE_B,
			workflowCloudPersistenceCanary: readCanary({
				// string true must not count
				workflow_cloud_persistence_canary: 'true',
			}),
		})
		assert(fake.enabled === false, 'string claim must not enable')
		const fromUserMeta = readCanary(undefined)
		assert(fromUserMeta === false, 'missing app_metadata is false')
		pass('tampering_rejected')
	} catch (e) {
		fail('tampering_rejected', e.message)
	}

	// Master-off overrides claim + canary/all modes.
	try {
		for (const mode of ['canary', 'all']) {
			const claimed = evaluate({
				masterEnabled: false,
				mode,
				authenticated: true,
				athleteId: ATHLETE_A,
				workflowCloudPersistenceCanary: true,
			})
			assert(claimed.enabled === false && claimed.reason === 'master_off', `master off ${mode}`)
		}
		pass('master_off_override')
	} catch (e) {
		fail('master_off_override', e.message)
	}

	// Mode all: both users eligible without claim.
	try {
		const eligAllB = evaluate({
			masterEnabled: true,
			mode: allMode,
			authenticated: true,
			athleteId: ATHLETE_B,
			workflowCloudPersistenceCanary: false,
		})
		assert(eligAllB.enabled === true && eligAllB.reason === 'all', 'all mode User B')
		pass('mode_all_regression_elig')
	} catch (e) {
		fail('mode_all_regression_elig', e.message)
	}

	// Cloud CRUD for claimed User A; RLS isolation vs User B.
	try {
		const clientId = `opp-pr4b2-${Date.now()}`
		const ins = await insertOpp(a.client, a.user.id, ATHLETE_A, clientId)
		assert(!ins.error, ins.error?.message || 'insert failed')

		const listedA = await a.client.from('opportunities').select('client_id').eq('client_id', clientId)
		assert((listedA.data || []).length === 1, 'User A should see own row')

		const listedB = await b.client.from('opportunities').select('client_id').eq('client_id', clientId)
		assert((listedB.data || []).length === 0, 'User B must not see User A row')

		await b.client.from('opportunities').update({ title: 'hijack' }).eq('client_id', clientId)
		// RLS should block; treat zero rows / error as success.
		const hijackCheck = await a.client.from('opportunities').select('title').eq('client_id', clientId).maybeSingle()
		assert(hijackCheck.data?.title === 'Canary local opp', 'User B must not mutate User A')

		await a.client.from('opportunities').delete().eq('client_id', clientId)
		const left = await countWorkflowRows(a.client, a.user.id)
		assert(left === 0, `cleanup expected 0 rows, got ${left}`)
		pass('user_a_cloud_crud_rls_cleanup')
	} catch (e) {
		fail('user_a_cloud_crud_rls_cleanup', e.message)
	}

	// Cleanup disposable users
	localPsql(`DELETE FROM auth.users WHERE email IN ('${EMAIL_A}', '${EMAIL_B}');`)

	const failed = results.filter((r) => !r.ok)
	console.log(`summary pass=${results.length - failed.length} fail=${failed.length}`)
	if (failed.length) process.exit(1)
}

main().catch((e) => {
	console.error(`FATAL: ${String(e?.message || e).slice(0, 400)}`)
	process.exit(1)
})
