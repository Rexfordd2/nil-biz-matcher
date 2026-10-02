#!/usr/bin/env node
/**
 * HTTP and database regression for the recruiting receiver.
 * Runs the handler inside @vercel/node's dev server (addHelpers restores the
 * original bytes) and through the Vite dev middleware.
 */
import { spawn, spawnSync, fork } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyFreshDatabase, DB_NAME, POSTGRES_PASSWORD, RECEIVER_URL } from './apply-fresh-database.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SECRET = 'development-secret-012345'
const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'
const GENERATED = path.join(ROOT, 'scripts/recruiting-receiver/.generated')

const results = []

function check(name, ok, detail) {
	results.push({ name, ok, detail })
	console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
	if (!ok) throw new Error(name)
}

function psql(sql) {
	const result = spawnSync(
		'psql',
		['-h', '127.0.0.1', '-U', 'postgres', '-d', DB_NAME, '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-c', sql],
		{ encoding: 'utf8', env: { ...process.env, PGPASSWORD: POSTGRES_PASSWORD } }
	)
	return {
		status: result.status ?? 1,
		stdout: (result.stdout || '').trim(),
		stderr: (result.stderr || '').trim(),
	}
}

function eventBody(fields = {}, payload = {}) {
	return JSON.stringify({
		schemaVersion: 'athlete-houze.recruiting.event.v1',
		eventId: 'evt_receive_0001',
		idempotencyKey: 'idem_receive_0001',
		houzeAthleteId: 'ath_houze_0001',
		entityType: 'recruiting_record',
		entityId: 'rec_record_0001',
		revision: 1,
		occurredAt: '2026-10-01T03:04:05.000Z',
		payload: { title: 'State camp', status: 'prospect', ...payload },
		...fields,
	})
}

function requireCrypto() {
	return import('node:crypto')
}

let cryptoPromise
function createHmacLater() {
	return requireCrypto()
}

async function post(url, raw, { timestamp = Math.floor(Date.now() / 1000), signature } = {}) {
	const crypto = await createHmacLater()
	const sig =
		signature ??
		`sha256=${crypto.createHmac('sha256', SECRET).update(`${timestamp}.`).update(raw).digest('hex')}`
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'content-length': String(Buffer.byteLength(raw)),
			'x-ah-timestamp': String(timestamp),
			'x-ah-signature': sig,
		},
		body: raw,
	})
	const text = await response.text()
	let json = null
	try {
		json = text ? JSON.parse(text) : null
	} catch {
		json = text
	}
	return { status: response.status, json, text }
}

function lastCount(stdout) {
	const numbers = stdout
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => /^\d+$/.test(line))
	return numbers[numbers.length - 1]
}

function entityCount() {
	return Number(psql('SELECT count(*) FROM public.recruiting_received_entities').stdout)
}

function receiptCount() {
	return Number(psql('SELECT count(*) FROM public.recruiting_inbound_receipts').stdout)
}

function seed() {
	const seeded = psql(`
		INSERT INTO auth.users (id) VALUES ('${USER_A}'), ('${USER_B}') ON CONFLICT DO NOTHING;
		INSERT INTO public.recruiting_houze_athlete_links (houze_athlete_id, supabase_user_id, clerk_user_id)
		VALUES
		  ('ath_houze_0001', '${USER_A}', 'user_clerk12345678'),
		  ('ath_houze_0002', '${USER_B}', 'user_clerk87654321');
	`)
	if (seeded.status !== 0) throw new Error(seeded.stderr || seeded.stdout)
}

function startDevServer() {
	mkdirSync(GENERATED, { recursive: true })
	const built = spawnSync(
		path.join(ROOT, 'node_modules/.bin/esbuild'),
		[
			'api/recruiting/houze-receive.ts',
			'--bundle',
			'--platform=node',
			'--format=esm',
			`--outfile=${path.join(GENERATED, 'handler.mjs')}`,
			'--external:pg',
		],
		{ cwd: ROOT, encoding: 'utf8' }
	)
	if (built.status !== 0) throw new Error(built.stderr || built.stdout)

	const child = fork(path.join(ROOT, 'node_modules/@vercel/node/dist/dev-server.mjs'), [], {
		cwd: ROOT,
		env: {
			...process.env,
			VERCEL_DEV_ENTRYPOINT: 'scripts/recruiting-receiver/.generated/handler.mjs',
			VERCEL_DEV_CONFIG: '{}',
			VERCEL_DEV_BUILD_ENV: '{}',
			NIL_RECRUITING_RECEIVER_MODE: 'development',
			NIL_RECRUITING_RECEIVER_HMAC_SECRET: SECRET,
			NIL_RECRUITING_RECEIVER_DATABASE_URL: RECEIVER_URL,
			NODE_ENV: 'development',
		},
		execArgv: [],
		stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
	})
	let logs = ''
	child.stdout?.on('data', (chunk) => {
		logs += chunk.toString()
	})
	child.stderr?.on('data', (chunk) => {
		logs += chunk.toString()
	})
	const ready = new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`vercel dev server timeout\n${logs}`)), 30_000)
		child.once('message', (address) => {
			clearTimeout(timer)
			resolve(address)
		})
		child.once('exit', (code) => {
			clearTimeout(timer)
			reject(new Error(`vercel dev server exited ${code}\n${logs}`))
		})
	})
	return { child, ready, logs: () => logs }
}

function startVite() {
	const child = spawn(path.join(ROOT, 'node_modules/.bin/vite'), ['--host', '127.0.0.1', '--port', '4179', '--strictPort'], {
		cwd: ROOT,
		env: {
			...process.env,
			NIL_RECRUITING_RECEIVER_MODE: 'development',
			NIL_RECRUITING_RECEIVER_HMAC_SECRET: SECRET,
			NIL_RECRUITING_RECEIVER_DATABASE_URL: RECEIVER_URL,
			NODE_ENV: 'development',
		},
		stdio: ['ignore', 'pipe', 'pipe'],
	})
	let logs = ''
	child.stdout.on('data', (chunk) => {
		logs += chunk.toString()
	})
	child.stderr.on('data', (chunk) => {
		logs += chunk.toString()
	})
	const ready = new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`vite timeout\n${logs}`)), 30_000)
		const wait = () => {
			if (logs.includes('Local:') || logs.includes('localhost:4179') || logs.includes('127.0.0.1:4179')) {
				clearTimeout(timer)
				resolve('http://127.0.0.1:4179/api/recruiting/houze-receive')
				return
			}
			setTimeout(wait, 100)
		}
		wait()
		child.once('exit', (code) => {
			clearTimeout(timer)
			reject(new Error(`vite exited ${code}\n${logs}`))
		})
	})
	return { child, ready }
}

function stop(child) {
	if (!child || child.killed) return
	child.kill('SIGTERM')
}

async function runHttpSuite(url, label) {
	const first = await post(url, eventBody())
	check(
		`${label} apply`,
		first.status === 200 && first.json.applied === true && first.json.nilAccountId === USER_A && first.json.eventId === 'evt_receive_0001',
		JSON.stringify(first.json)
	)
	const owner = psql(
		`SELECT supabase_user_id::text || '|' || title FROM public.recruiting_received_entities WHERE entity_id = 'rec_record_0001'`
	).stdout
	check(`${label} owner is supabase id`, owner === `${USER_A}|State camp`, owner)

	const retry = await post(url, eventBody())
	check(
		`${label} identical retry`,
		retry.status === 200 && JSON.stringify(retry.json) === JSON.stringify(first.json) && receiptCount() === 1,
		`receipts=${receiptCount()} status=${retry.status}`
	)

	const conflictId = await post(url, eventBody({}, { title: 'Different camp' }))
	const afterConflict = psql(
		`SELECT title FROM public.recruiting_received_entities WHERE entity_id = 'rec_record_0001'`
	).stdout
	check(
		`${label} conflicting event id`,
		conflictId.status === 409 && conflictId.text === '{"error":"conflict"}' && afterConflict === 'State camp' && receiptCount() === 1,
		conflictId.text
	)

	const conflictKey = await post(
		url,
		eventBody({ eventId: 'evt_receive_0099', payload: { title: 'Other', status: 'paused' } })
	)
	check(
		`${label} conflicting idempotency key`,
		conflictKey.status === 409 && conflictKey.text === '{"error":"conflict"}' && receiptCount() === 1,
		conflictKey.text
	)

	const mismatch = await post(url, eventBody({ eventId: 'evt_mismatch_0001', idempotencyKey: 'idem_mismatch_0001', claimedNilAccountId: USER_B }))
	check(
		`${label} mismatched account`,
		mismatch.status === 403 && mismatch.json.error === 'mapping_mismatch' && entityCount() === 1,
		mismatch.text
	)

	const clerkAsHouze = await post(
		url,
		eventBody({
			eventId: 'evt_clerk_0001',
			idempotencyKey: 'idem_clerk_0001',
			houzeAthleteId: 'user_clerk12345678',
		})
	)
	check(
		`${label} clerk id is not the houze athlete`,
		clerkAsHouze.status === 403 && clerkAsHouze.json.error === 'mapping_missing' && entityCount() === 1,
		clerkAsHouze.text
	)

	const unknown = await post(url, eventBody({ unexpected: true, eventId: 'evt_unknown_0001', idempotencyKey: 'idem_unknown_0001' }))
	check(`${label} unknown field`, unknown.status === 400 && unknown.json.error === 'unknown_field' && entityCount() === 1, unknown.text)

	const next = await post(
		url,
		eventBody({ eventId: 'evt_receive_0002', idempotencyKey: 'idem_receive_0002', revision: 2 }, { title: 'Visit weekend' })
	)
	check(
		`${label} newer revision`,
		next.status === 200 && next.json.revisionOutcome === 'applied' && next.json.currentRevision === 2,
		JSON.stringify(next.json)
	)

	const stale = await post(
		url,
		eventBody({ eventId: 'evt_stale_0001', idempotencyKey: 'idem_stale_0001', revision: 1 }, { title: 'Old camp' })
	)
	const titleAfterStale = psql(
		`SELECT title || '|' || revision::text FROM public.recruiting_received_entities WHERE entity_id = 'rec_record_0001'`
	).stdout
	check(
		`${label} stale revision`,
		stale.status === 200 &&
			stale.json.revisionOutcome === 'current_revision_newer' &&
			stale.json.applied === false &&
			stale.json.currentRevision === 2 &&
			stale.json.requestedRevision === 1 &&
			stale.json.houzeAthleteId === 'ath_houze_0001' &&
			stale.json.nilAccountId === USER_A &&
			titleAfterStale === 'Visit weekend|2',
		`${stale.text} db=${titleAfterStale}`
	)

	const equal = await post(
		url,
		eventBody({ eventId: 'evt_equal_0001', idempotencyKey: 'idem_equal_0001', revision: 2 }, { title: 'Conflicting weekend' })
	)
	const titleAfterEqual = psql(
		`SELECT title FROM public.recruiting_received_entities WHERE entity_id = 'rec_record_0001'`
	).stdout
	const receiptsBeforeConcurrent = receiptCount()
	check(
		`${label} equal revision conflict`,
		equal.status === 409 && equal.text === '{"error":"conflict"}' && titleAfterEqual === 'Visit weekend',
		`${equal.text} title=${titleAfterEqual}`
	)

	const revoked = psql(`UPDATE public.recruiting_houze_athlete_links SET revoked_at = now() WHERE houze_athlete_id = 'ath_houze_0002'`)
	if (revoked.status !== 0) throw new Error(revoked.stderr)
	const revokedResponse = await post(
		url,
		eventBody({
			eventId: 'evt_revoked_0001',
			idempotencyKey: 'idem_revoked_0001',
			houzeAthleteId: 'ath_houze_0002',
			entityId: 'rec_revoked_0001',
		})
	)
	check(
		`${label} revoked mapping`,
		revokedResponse.status === 403 && revokedResponse.json.error === 'mapping_revoked',
		revokedResponse.text
	)

	const missing = await post(
		url,
		eventBody({
			eventId: 'evt_missing_0001',
			idempotencyKey: 'idem_missing_0001',
			houzeAthleteId: 'ath_missing_01',
			entityId: 'rec_missing_0001',
		})
	)
	check(`${label} missing mapping`, missing.status === 403 && missing.json.error === 'mapping_missing', missing.text)

	const pretty = `{
  "schemaVersion": "athlete-houze.recruiting.event.v1",
  "eventId": "evt_pretty_0001",
  "idempotencyKey": "idem_pretty_0001",
  "houzeAthleteId": "ath_houze_0001",
  "entityType": "recruiting_record",
  "entityId": "rec_pretty_0001",
  "revision": 3,
  "occurredAt": "2026-10-01T03:04:05Z",
  "payload": { "status": "contacted", "title": "Pretty ${label}" }
}`
	const crypto = await createHmacLater()
	const timestamp = Math.floor(Date.now() / 1000)
	const rebuilt = JSON.stringify(JSON.parse(pretty))
	const originalSig = crypto.createHmac('sha256', SECRET).update(`${timestamp}.`).update(pretty).digest('hex')
	const rebuiltSig = crypto.createHmac('sha256', SECRET).update(`${timestamp}.`).update(rebuilt).digest('hex')
	check(`${label} stringify changes signature`, originalSig !== rebuiltSig, '')
	const prettyResponse = await post(url, pretty, { timestamp, signature: `sha256=${originalSig}` })
	check(
		`${label} original bytes verify`,
		prettyResponse.status === 200 && prettyResponse.json.entityId === 'rec_pretty_0001',
		prettyResponse.text
	)
	const stringifyResponse = await post(url, pretty, { timestamp, signature: `sha256=${rebuiltSig}` })
	check(`${label} reconstructed signature rejected`, stringifyResponse.status === 401, stringifyResponse.text)

	const huge = `{"pad":"${'x'.repeat(70_000)}"}`
	const hugeResponse = await post(url, huge)
	check(`${label} bounded body`, hugeResponse.status === 413 && hugeResponse.json.error === 'payload_too_large', hugeResponse.text)

	const before = entityCount()
	const concurrentBody = eventBody({
		eventId: 'evt_concurrent_0001',
		idempotencyKey: 'idem_concurrent_0001',
		entityId: 'rec_concurrent_0001',
		revision: 4,
	})
	const [left, right] = await Promise.all([post(url, concurrentBody), post(url, concurrentBody)])
	const concurrentRows = Number(
		psql(`SELECT count(*) FROM public.recruiting_received_entities WHERE entity_id = 'rec_concurrent_0001'`).stdout
	)
	const concurrentReceipts = Number(
		psql(`SELECT count(*) FROM public.recruiting_inbound_receipts WHERE event_id = 'evt_concurrent_0001'`).stdout
	)
	check(
		`${label} concurrent delivery`,
		left.status === 200 &&
			right.status === 200 &&
			JSON.stringify(left.json) === JSON.stringify(right.json) &&
			concurrentRows === 1 &&
			concurrentReceipts === 1 &&
			entityCount() === before + 1,
		`statuses=${left.status}/${right.status} rows=${concurrentRows} receipts=${concurrentReceipts}`
	)
	void receiptsBeforeConcurrent
}

function runRoleChecks() {
	const anon = psql(`BEGIN; SET LOCAL ROLE anon; SELECT count(*) FROM public.recruiting_received_entities; ROLLBACK;`)
	check('anon select denied', anon.status !== 0, anon.stderr)

	const other = psql(`
		BEGIN;
		SET LOCAL ROLE authenticated;
		SELECT set_config('request.jwt.claim.sub', '${USER_B}', true);
		SELECT count(*) FROM public.recruiting_received_entities;
		ROLLBACK;
	`)
	check(
		'authenticated cannot read another account',
		other.status === 0 && lastCount(other.stdout) === '0',
		other.stdout
	)

	const own = psql(`
		BEGIN;
		SET LOCAL ROLE authenticated;
		SELECT set_config('request.jwt.claim.sub', '${USER_A}', true);
		SELECT count(*) FROM public.recruiting_received_entities;
		ROLLBACK;
	`)
	check(
		'authenticated reads own rows',
		own.status === 0 && Number(lastCount(own.stdout)) > 0,
		own.stdout
	)

	const insert = psql(`
		BEGIN;
		SET LOCAL ROLE authenticated;
		INSERT INTO public.recruiting_received_entities (
		  supabase_user_id, entity_type, entity_id, revision, content_hash, title, status, occurred_at, payload
		) VALUES (
		  '${USER_A}', 'recruiting_record', 'rec_should_fail', 1, 'hash', 'Nope', 'prospect', now(), '{}'::jsonb
		);
		ROLLBACK;
	`)
	check('authenticated insert denied', insert.status !== 0, insert.stderr)

	const receipts = psql(`
		BEGIN;
		SET LOCAL ROLE authenticated;
		SELECT set_config('request.jwt.claim.sub', '${USER_A}', true);
		SELECT count(*) FROM public.recruiting_inbound_receipts;
		ROLLBACK;
	`)
	check('receipts are not user-facing', receipts.status !== 0, receipts.stderr)

	const receiverInsert = psql(`
		BEGIN;
		SET LOCAL ROLE nil_recruiting_receiver;
		INSERT INTO public.recruiting_received_entities (
		  supabase_user_id, entity_type, entity_id, revision, content_hash, title, status, occurred_at, payload
		) VALUES (
		  '${USER_A}', 'recruiting_record', 'rec_should_fail', 1, 'hash', 'Nope', 'prospect', now(), '{}'::jsonb
		);
		ROLLBACK;
	`)
	check('receiver role cannot insert directly', receiverInsert.status !== 0, receiverInsert.stderr)

	const before = entityCount()
	const receiverCall = psql(`
		BEGIN;
		SET LOCAL ROLE nil_recruiting_receiver;
		SELECT public.commit_recruiting_inbound_event(
		  'evt_role_0001','idem_role_0001','ath_houze_0001', NULL, 'user_clerk12345678',
		  'recruiting_record','rec_role_0001', 1, '2026-10-01T03:04:05.000Z','Role check','prospect', NULL
		);
		ROLLBACK;
	`)
	check(
		'receiver role can execute commit',
		receiverCall.status === 0 && receiverCall.stdout.includes('"status": "ok"') && entityCount() === before,
		receiverCall.stdout || receiverCall.stderr
	)

	const authenticatedCall = psql(`
		BEGIN;
		SET LOCAL ROLE authenticated;
		SELECT public.commit_recruiting_inbound_event(
		  'evt_role_0002','idem_role_0002','ath_houze_0001', NULL, NULL,
		  'recruiting_record','rec_role_0002', 1, '2026-10-01T03:04:05.000Z','Nope','prospect', NULL
		);
		ROLLBACK;
	`)
	check('authenticated cannot execute commit', authenticatedCall.status !== 0, authenticatedCall.stderr)

	const serviceInsert = psql(`
		BEGIN;
		SET LOCAL ROLE service_role;
		INSERT INTO public.recruiting_inbound_receipts (
		  event_id, idempotency_key, supabase_user_id, houze_athlete_id, entity_type, entity_id, revision, content_hash, acknowledgement
		) VALUES (
		  'evt_service','idem_service','${USER_A}','ath_houze_0001','recruiting_record','rec_service',1,'hash','{}'::jsonb
		);
		ROLLBACK;
	`)
	check('service role cannot write receipts', serviceInsert.status !== 0, serviceInsert.stderr)
}

async function runLoginChecks() {
	const { default: pg } = await import('pg')
	const good = new pg.Client({ connectionString: RECEIVER_URL, connectionTimeoutMillis: 5_000 })
	await good.connect()
	const who = await good.query('SELECT current_user AS role')
	await good.end()
	check(
		'receiver login succeeds',
		who.rows[0]?.role === 'nil_recruiting_receiver',
		String(who.rows[0]?.role)
	)

	const badUrl = new URL(RECEIVER_URL)
	badUrl.password = 'incorrect-receiver-password'
	const bad = new pg.Client({ connectionString: badUrl.toString(), connectionTimeoutMillis: 5_000 })
	let code = ''
	try {
		await bad.connect()
		await bad.end()
	} catch (error) {
		code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'error'
	}
	check('incorrect receiver credentials fail', code === '28P01', code || 'connected')
}

async function main() {
	const migration = applyFreshDatabase()
	check(
		'second migration run is up to date',
		migration.secondPush.includes('"upToDate":true') && migration.replayStatus === 0,
		migration.secondPush.split('\n')[0]
	)
	const policyCount = psql(
		`SELECT count(*) FROM pg_policies WHERE policyname = 'recruiting_received_entities_select_own'`
	).stdout
	check('replayed migration did not duplicate policies', policyCount === '1', policyCount)
	seed()

	const dev = startDevServer()
	let vite
	try {
		const address = await dev.ready
		const port = address.port
		await runHttpSuite(`http://127.0.0.1:${port}/`, 'node')
		runRoleChecks()
		await runLoginChecks()
		vite = startVite()
		const viteUrl = await vite.ready
		const pretty = `{\n  "schemaVersion": "athlete-houze.recruiting.event.v1",\n  "eventId": "evt_vite_0001",\n  "idempotencyKey": "idem_vite_0001",\n  "houzeAthleteId": "ath_houze_0001",\n  "entityType": "recruiting_record",\n  "entityId": "rec_vite_0001",\n  "revision": 1,\n  "occurredAt": "2026-10-01T03:04:05.000Z",\n  "payload": {\n    "title": "Vite camp",\n    "status": "prospect"\n  }\n}\n`
		const crypto = await createHmacLater()
		const timestamp = Math.floor(Date.now() / 1000)
		const originalSig = crypto.createHmac('sha256', SECRET).update(`${timestamp}.`).update(pretty).digest('hex')
		const rebuiltSig = crypto
			.createHmac('sha256', SECRET)
			.update(`${timestamp}.`)
			.update(JSON.stringify(JSON.parse(pretty)))
			.digest('hex')
		const accepted = await post(viteUrl, pretty, { timestamp, signature: `sha256=${originalSig}` })
		check('vite original bytes', accepted.status === 200 && accepted.json.title === undefined && accepted.json.entityId === 'rec_vite_0001', accepted.text)
		const rejected = await post(viteUrl, pretty, { timestamp, signature: `sha256=${rebuiltSig}` })
		check('vite reconstructed signature rejected', rejected.status === 401, rejected.text)
		const unknown = await post(viteUrl, eventBody({ unexpected: true, eventId: 'evt_vite_0002', idempotencyKey: 'idem_vite_0002' }))
		check('vite unknown field', unknown.status === 400 && unknown.json.error === 'unknown_field', unknown.text)
	} finally {
		stop(dev.child)
		if (vite) stop(vite.child)
	}

	const failed = results.filter((result) => !result.ok)
	console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2))
	if (failed.length) process.exit(1)
}

main().catch((error) => {
	console.error(error)
	console.log(JSON.stringify({ passed: results.filter((result) => result.ok).length, failed: results.length, error: String(error) }, null, 2))
	process.exit(1)
})
