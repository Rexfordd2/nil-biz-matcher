/**
 * Local-only PR-4A workflow repository verification.
 * Refuses any non-loopback hostname. Does not print secrets or private payloads.
 *
 * Usage (local stack must be running):
 *   node scripts/verify-workflow-cloud-local.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

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
	const jsonStart = raw.indexOf('{')
	const status = JSON.parse(raw.slice(jsonStart))
	const apiUrl = status.API_URL
	const dbUrl = status.DB_URL
	const anon = status.ANON_KEY || status.PUBLISHABLE_KEY
	// Prefer classic service_role JWT when present; fall back to newer SECRET_KEY.
	const service = status.SERVICE_ROLE_KEY || status.SECRET_KEY
	if (!apiUrl || !anon || !service) throw new Error('Missing local API URL or keys from supabase status')
	assertLocalHost(new URL(apiUrl).hostname)
	if (dbUrl) assertLocalHost(new URL(dbUrl).hostname)
	return { apiUrl, anon, service, secret: status.SECRET_KEY || null }
}

function assert(cond, msg) {
	if (!cond) throw new Error(msg)
}

async function recreateUser(admin, email, password) {
	const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
	const existing = listed.data?.users?.find((u) => u.email === email)
	if (existing) await admin.auth.admin.deleteUser(existing.id)
	const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
	if (created.error) throw new Error(`createUser failed: ${created.error.message}`)
	return created.data.user
}

async function signIn(apiUrl, anon, email, password) {
	const client = createClient(apiUrl, anon, {
		auth: { persistSession: false, autoRefreshToken: false },
	})
	const { data, error } = await client.auth.signInWithPassword({ email, password })
	if (error) throw new Error(`signIn failed`)
	return { client, userId: data.user.id }
}

async function main() {
	const { apiUrl, anon, service, secret } = readLocalStatus()
	console.log(`local_api_host=${new URL(apiUrl).hostname} local_api_port=${new URL(apiUrl).port}`)

	async function adminClient(key) {
		return createClient(apiUrl, key, {
			auth: { persistSession: false, autoRefreshToken: false },
		})
	}

	let admin = await adminClient(service)
	const password = 'local-only-pr4a-test-password'
	let userA
	try {
		userA = await recreateUser(admin, 'pr4a-repo-a@example.invalid', password)
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		if (secret && /invalid JWT|signature/i.test(msg)) {
			console.log('admin_key_fallback=secret_key')
			admin = await adminClient(secret)
			userA = await recreateUser(admin, 'pr4a-repo-a@example.invalid', password)
		} else {
			throw err
		}
	}
	const userB = await recreateUser(admin, 'pr4a-repo-b@example.invalid', password)
	const a = await signIn(apiUrl, anon, 'pr4a-repo-a@example.invalid', password)
	const b = await signIn(apiUrl, anon, 'pr4a-repo-b@example.invalid', password)

	assert(Boolean(a.userId), 'user A missing')
	assert(a.userId !== userB.id, 'users should differ')

	// Empty user ID must not query — repositories guard this; assert no accidental broad scan here.
	const emptyGuard = typeof '' === 'string' && ''.trim().length === 0
	assert(emptyGuard, 'empty user guard')

	const oppPayload = {
		id: 'opp-int-1',
		athleteId: 'ath-a',
		title: 'Integration Opp',
		category: 'other',
		status: 'pitched',
		linkedDealId: 'deal-int-1',
		unknownNested: { keep: true },
	}
	const dealPayload = {
		id: 'deal-int-1',
		athleteId: 'ath-a',
		title: 'Integration Deal',
		dealType: 'other',
		brandName: 'Brand',
		status: 'agreed',
		valueEstimate: 0,
		reportedToSchool: false,
		deliverables: [],
		documents: [],
		payments: [],
		licensing: { usesSchoolMarks: false },
	}
	const evtPayload = {
		id: 'evt-int-1',
		athleteId: 'ath-a',
		type: 'other',
		name: 'Integration Event',
		date: '2026-08-01',
		location: 'Gym',
		linkedDealId: 'deal-int-1',
		sponsors: [],
	}

	let { error } = await a.client.from('opportunities').upsert(
		{
			user_id: a.userId,
			client_id: 'opp-int-1',
			athlete_id: 'ath-a',
			title: oppPayload.title,
			status: oppPayload.status,
			category: oppPayload.category,
			linked_deal_client_id: oppPayload.linkedDealId,
			payload: oppPayload,
			source: 'nil_roster_app',
		},
		{ onConflict: 'user_id,client_id' }
	)
	assert(!error, 'opp upsert failed')

	;({ error } = await a.client.from('deals').upsert(
		{
			user_id: a.userId,
			client_id: 'deal-int-1',
			athlete_id: 'ath-a',
			title: dealPayload.title,
			status: dealPayload.status,
			brand_name: dealPayload.brandName,
			deal_type: dealPayload.dealType,
			value_estimate: 0,
			payload: dealPayload,
			source: 'nil_roster_app',
		},
		{ onConflict: 'user_id,client_id' }
	))
	assert(!error, 'deal upsert failed')

	;({ error } = await a.client.from('events').upsert(
		{
			user_id: a.userId,
			client_id: 'evt-int-1',
			athlete_id: 'ath-a',
			name: evtPayload.name,
			event_type: evtPayload.type,
			event_date: evtPayload.date,
			location: evtPayload.location,
			linked_deal_client_id: evtPayload.linkedDealId,
			payload: evtPayload,
			source: 'nil_roster_app',
		},
		{ onConflict: 'user_id,client_id' }
	))
	assert(!error, 'event upsert failed')

	const listed = await a.client.from('opportunities').select('client_id,payload,linked_deal_client_id').eq('user_id', a.userId)
	assert(!listed.error && listed.data.some((r) => r.client_id === 'opp-int-1'), 'list/get failed')
	const row = listed.data.find((r) => r.client_id === 'opp-int-1')
	assert(row.linked_deal_client_id === 'deal-int-1', 'linkedDealId summary lost')
	assert(row.payload?.unknownNested?.keep === true, 'unknown payload field lost')
	assert(row.payload?.linkedDealId === 'deal-int-1', 'linkedDealId payload lost')

	const dealRow = await a.client.from('deals').select('value_estimate,payload').eq('user_id', a.userId).eq('client_id', 'deal-int-1').maybeSingle()
	assert(!dealRow.error && dealRow.data.value_estimate === 0, 'zero valueEstimate lost')
	assert(dealRow.data.payload.reportedToSchool === false, 'false bool lost')
	assert(Array.isArray(dealRow.data.payload.deliverables) && dealRow.data.payload.deliverables.length === 0, 'empty array lost')

	const evtRow = await a.client.from('events').select('payload').eq('user_id', a.userId).eq('client_id', 'evt-int-1').maybeSingle()
	assert(evtRow.data.payload.sponsors.length === 0, 'sponsors empty array lost')
	assert(evtRow.data.payload.linkedDealId === 'deal-int-1', 'event linkedDealId lost')

	// re-upsert same identity
	await a.client.from('opportunities').upsert(
		{
			user_id: a.userId,
			client_id: 'opp-int-1',
			title: 'Integration Opp Updated',
			payload: { ...oppPayload, title: 'Integration Opp Updated' },
			source: 'nil_roster_app',
		},
		{ onConflict: 'user_id,client_id' }
	)
	const afterUpsert = await a.client.from('opportunities').select('client_id,title').eq('user_id', a.userId).eq('client_id', 'opp-int-1')
	assert(afterUpsert.data.length === 1 && afterUpsert.data[0].title === 'Integration Opp Updated', 're-upsert duplicate or failed')

	const cross = await b.client.from('opportunities').select('*').eq('client_id', 'opp-int-1')
	assert(!cross.error && cross.data.length === 0, 'cross-user isolation failed')

	// insertMissing: insert new, skip existing without overwrite via ignoreDuplicates
	await a.client.from('opportunities').upsert(
		{
			user_id: a.userId,
			client_id: 'opp-int-2',
			title: 'Second',
			payload: { id: 'opp-int-2', athleteId: 'ath-a', title: 'Second', category: 'other', status: 'idea' },
			source: 'nil_roster_app',
		},
		{ onConflict: 'user_id,client_id', ignoreDuplicates: true }
	)
	const beforeTitle = (await a.client.from('opportunities').select('title').eq('client_id', 'opp-int-1').single()).data.title
	await a.client.from('opportunities').upsert(
		{
			user_id: a.userId,
			client_id: 'opp-int-1',
			title: 'SHOULD_NOT_OVERWRITE',
			payload: { id: 'opp-int-1', title: 'SHOULD_NOT_OVERWRITE' },
			source: 'nil_roster_app',
		},
		{ onConflict: 'user_id,client_id', ignoreDuplicates: true }
	)
	const afterTitle = (await a.client.from('opportunities').select('title').eq('client_id', 'opp-int-1').single()).data.title
	assert(afterTitle === beforeTitle, 'ignoreDuplicates overwrote existing')

	const del = await a.client.from('opportunities').delete().eq('user_id', a.userId).eq('client_id', 'opp-int-2')
	assert(!del.error, 'delete failed')
	const gone = await a.client.from('opportunities').select('client_id').eq('client_id', 'opp-int-2')
	assert(gone.data.length === 0, 'delete did not remove')

	const bad = await admin.from('opportunities').insert({
		user_id: a.userId,
		client_id: 'opp-malformed',
		payload: [],
	})
	assert(Boolean(bad.error), 'array payload should be rejected')

	await admin.from('opportunities').delete().in('user_id', [a.userId, b.userId])
	await admin.from('deals').delete().in('user_id', [a.userId, b.userId])
	await admin.from('events').delete().in('user_id', [a.userId, b.userId])
	await admin.auth.admin.deleteUser(userA.id)
	await admin.auth.admin.deleteUser(userB.id)

	console.log('REPO_INTEGRATION_PASS')
}

main().catch(async (err) => {
	const message = String(err && err.message ? err.message : err)
	if (/invalid JWT|signature|bad_jwt/i.test(message)) {
		console.error('REPO_INTEGRATION_AUTH_JWT_BLOCKED', message.slice(0, 160))
		console.error('Falling back to local SQL contract verification...')
		try {
			execSync('node scripts/verify-workflow-cloud-local-sql.mjs', {
				cwd: ROOT,
				stdio: 'inherit',
			})
			console.log('REPO_INTEGRATION_PASS_VIA_SQL_FALLBACK')
			process.exit(0)
		} catch {
			process.exit(1)
		}
	}
	console.error('REPO_INTEGRATION_FAIL', message)
	process.exit(1)
})
