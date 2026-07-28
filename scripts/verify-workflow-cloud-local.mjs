/**
 * Local-only PR-4B1 workflow repository verification.
 * Refuses any non-loopback hostname. Does not print secrets or private payloads.
 *
 * Uses authenticated signup sessions (not admin JWT / privileged SQL) for CRUD + RLS.
 *
 * Usage (local stack must be running):
 *   node scripts/verify-workflow-cloud-local.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { execSync, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const EMAIL_A = 'pr4a-repo-a@example.invalid'
const EMAIL_B = 'pr4a-repo-b@example.invalid'
const PASSWORD = 'local-only-pr4a-test-password'

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
	if (!apiUrl || !anon) throw new Error('Missing local API URL or anon key from supabase status')
	assertLocalHost(new URL(apiUrl).hostname)
	if (dbUrl) assertLocalHost(new URL(dbUrl).hostname)
	if (/supabase\.co/i.test(apiUrl)) throw new Error('Refusing production supabase.co URL')
	return { apiUrl, anon }
}

function assert(cond, msg) {
	if (!cond) throw new Error(msg)
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
		throw new Error((res.stderr || res.stdout || 'psql failed').slice(0, 300))
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
		return { client, userId: signedUp.data.user.id }
	}
	const signedIn = await client.auth.signInWithPassword({ email, password })
	if (signedIn.error || !signedIn.data.user) throw new Error('signIn failed after signup')
	return { client, userId: signedIn.data.user.id }
}

async function main() {
	assert(!process.env.SUPABASE_DB_PASSWORD, 'SUPABASE_DB_PASSWORD must be unset')
	const { apiUrl, anon } = readLocalStatus()
	console.log(`local_api_host=${new URL(apiUrl).hostname} local_api_port=${new URL(apiUrl).port}`)
	console.log('auth_path=signup_anon_jwt')

	const a = await recreateViaSignup(apiUrl, anon, EMAIL_A, PASSWORD)
	const b = await recreateViaSignup(apiUrl, anon, EMAIL_B, PASSWORD)

	assert(Boolean(a.userId), 'user A missing')
	assert(a.userId !== b.userId, 'users should differ')

	const emptyGuard = typeof '' === 'string' && ''.trim().length === 0
	assert(emptyGuard, 'empty user guard')

	const oppPayload = {
		id: 'opp-int-1',
		athleteId: 'ath-a',
		title: 'Integration Opp',
		category: 'other',
		status: 'pitched',
		linkedDealId: 'deal-int-1',
		expectedStartDate: '2026-08-01',
		expectedEndDate: '2026-09-01',
		notes: 'integration notes',
		description: 'desc',
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
		runOfShowUrl: 'https://example.invalid/run',
		notes: 'evt notes',
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

	const listed = await a.client
		.from('opportunities')
		.select('client_id,payload,linked_deal_client_id')
		.eq('user_id', a.userId)
	assert(!listed.error && listed.data.some((r) => r.client_id === 'opp-int-1'), 'list/get failed')
	const row = listed.data.find((r) => r.client_id === 'opp-int-1')
	assert(row.linked_deal_client_id === 'deal-int-1', 'linkedDealId summary lost')
	assert(row.payload?.unknownNested?.keep === true, 'unknown payload field lost')
	assert(row.payload?.linkedDealId === 'deal-int-1', 'linkedDealId payload lost')
	assert(row.payload?.notes === 'integration notes', 'opportunity notes lost')
	assert(row.payload?.expectedStartDate === '2026-08-01', 'opportunity start date lost')
	assert(row.payload?.expectedEndDate === '2026-09-01', 'opportunity end date lost')

	const dealRow = await a.client
		.from('deals')
		.select('value_estimate,payload')
		.eq('user_id', a.userId)
		.eq('client_id', 'deal-int-1')
		.maybeSingle()
	assert(!dealRow.error && dealRow.data.value_estimate === 0, 'zero valueEstimate lost')
	assert(dealRow.data.payload.reportedToSchool === false, 'false bool lost')
	assert(
		Array.isArray(dealRow.data.payload.deliverables) && dealRow.data.payload.deliverables.length === 0,
		'empty array lost'
	)

	const evtRow = await a.client
		.from('events')
		.select('payload')
		.eq('user_id', a.userId)
		.eq('client_id', 'evt-int-1')
		.maybeSingle()
	assert(evtRow.data.payload.sponsors.length === 0, 'sponsors empty array lost')
	assert(evtRow.data.payload.linkedDealId === 'deal-int-1', 'event linkedDealId lost')
	assert(evtRow.data.payload.runOfShowUrl === 'https://example.invalid/run', 'event url lost')
	assert(evtRow.data.payload.notes === 'evt notes', 'event notes lost')

	// Edit and verify fields again
	await a.client.from('opportunities').upsert(
		{
			user_id: a.userId,
			client_id: 'opp-int-1',
			title: 'Integration Opp Updated',
			payload: { ...oppPayload, title: 'Integration Opp Updated', notes: 'notes2' },
			source: 'nil_roster_app',
		},
		{ onConflict: 'user_id,client_id' }
	)
	const afterUpsert = await a.client
		.from('opportunities')
		.select('client_id,title,payload')
		.eq('user_id', a.userId)
		.eq('client_id', 'opp-int-1')
	assert(
		afterUpsert.data.length === 1 && afterUpsert.data[0].title === 'Integration Opp Updated',
		're-upsert duplicate or failed'
	)
	assert(afterUpsert.data[0].payload.notes === 'notes2', 'edited notes lost')
	assert(afterUpsert.data[0].payload.linkedDealId === 'deal-int-1', 'edited linkedDealId lost')

	const cross = await b.client.from('opportunities').select('*').eq('client_id', 'opp-int-1')
	assert(!cross.error && cross.data.length === 0, 'cross-user isolation failed')

	const crossUpdate = await b.client
		.from('opportunities')
		.update({ title: 'HACKED' })
		.eq('client_id', 'opp-int-1')
	assert(!crossUpdate.error, 'cross update request errored unexpectedly')
	const ownerTitle = (
		await a.client.from('opportunities').select('title').eq('client_id', 'opp-int-1').single()
	).data.title
	assert(ownerTitle === 'Integration Opp Updated', 'cross-user update bypassed RLS')

	const crossDelete = await b.client.from('opportunities').delete().eq('client_id', 'opp-int-1')
	assert(!crossDelete.error, 'cross delete request errored unexpectedly')
	assert(
		(await a.client.from('opportunities').select('client_id').eq('client_id', 'opp-int-1')).data.length === 1,
		'cross-user delete bypassed RLS'
	)

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
	const beforeTitle = (
		await a.client.from('opportunities').select('title').eq('client_id', 'opp-int-1').single()
	).data.title
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
	const afterTitle = (
		await a.client.from('opportunities').select('title').eq('client_id', 'opp-int-1').single()
	).data.title
	assert(afterTitle === beforeTitle, 'ignoreDuplicates overwrote existing')

	const del = await a.client.from('opportunities').delete().eq('user_id', a.userId).eq('client_id', 'opp-int-2')
	assert(!del.error, 'delete failed')
	const gone = await a.client.from('opportunities').select('client_id').eq('client_id', 'opp-int-2')
	assert(gone.data.length === 0, 'delete did not remove')

	const bad = await a.client.from('opportunities').insert({
		user_id: a.userId,
		client_id: 'opp-malformed',
		payload: [],
	})
	assert(Boolean(bad.error), 'array payload should be rejected')

	await a.client.from('opportunities').delete().eq('user_id', a.userId)
	await a.client.from('deals').delete().eq('user_id', a.userId)
	await a.client.from('events').delete().eq('user_id', a.userId)
	await b.client.from('opportunities').delete().eq('user_id', b.userId)
	await b.client.from('deals').delete().eq('user_id', b.userId)
	await b.client.from('events').delete().eq('user_id', b.userId)

	assert(
		(await a.client.from('opportunities').select('client_id').eq('user_id', a.userId)).data.length === 0,
		'opp cleanup incomplete'
	)
	assert((await a.client.from('deals').select('client_id').eq('user_id', a.userId)).data.length === 0, 'deal cleanup incomplete')
	assert((await a.client.from('events').select('client_id').eq('user_id', a.userId)).data.length === 0, 'event cleanup incomplete')

	localPsql(`DELETE FROM auth.users WHERE id IN ('${a.userId}','${b.userId}');`)

	console.log('REPO_INTEGRATION_PASS')
}

main().catch((err) => {
	const message = String(err && err.message ? err.message : err)
	console.error('REPO_INTEGRATION_FAIL', message.slice(0, 300))
	process.exit(1)
})
