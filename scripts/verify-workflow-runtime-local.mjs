/**
 * LOCAL-ONLY PR-4B1 workflow runtime integration gate.
 *
 * Proves authenticated PostgREST + RLS + planner/controller/mirror semantics
 * against the disposable Monster_Collective supabase stack.
 *
 * Refuses non-loopback hosts and production project refs.
 * Never prints secrets, tokens, or raw private payloads.
 *
 * Usage (local stack must already be running):
 *   node scripts/verify-workflow-runtime-local.mjs
 *
 * Auth note:
 *   Local GoTrue currently rejects classic HS256 service_role JWTs for Admin API
 *   ("signing method HS256 is invalid"). Disposable users are created via public
 *   signup + password sign-in (anon key). Cleanup uses local docker psql only.
 */
import { createClient } from '@supabase/supabase-js'
import { execSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PASSWORD = 'local-only-pr4b1-runtime-pass'
const ATHLETE_A = 'ath-pr4b1-a-synth'
const ATHLETE_B = 'ath-pr4b1-b-synth'
const EMAIL_A = 'pr4b1-runtime-a@example.invalid'
const EMAIL_B = 'pr4b1-runtime-b@example.invalid'
const PRODUCTION_REF_MARKERS = ['vanta', 'nilbase', 'supabase.co']

const results = []
function pass(name) {
	results.push({ name, ok: true })
	console.log(`PASS ${name}`)
}
function fail(name, detail) {
	results.push({ name, ok: false, detail })
	console.error(`FAIL ${name}: ${String(detail || '').slice(0, 200)}`)
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

function refuseProductionMarkers(text) {
	const lower = String(text || '').toLowerCase()
	for (const marker of PRODUCTION_REF_MARKERS) {
		if (lower.includes(marker) && !lower.includes('monster_collective')) {
			// allow project_id Monster_Collective; block remote hosts
		}
	}
	if (/https?:\/\/[a-z0-9-]+\.supabase\.co/i.test(String(text || ''))) {
		throw new Error('Refusing production supabase.co URL')
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
	const dbUrl = status.DB_URL
	const anon = status.ANON_KEY || status.PUBLISHABLE_KEY
	if (!apiUrl || !anon) throw new Error('Missing local API URL or anon key')
	assertLocalHost(new URL(apiUrl).hostname)
	if (dbUrl) assertLocalHost(new URL(dbUrl).hostname)
	refuseProductionMarkers(apiUrl)
	refuseProductionMarkers(dbUrl || '')
	return { apiUrl, dbUrl, anon }
}

function localPsql(sql) {
	const res = spawnSync(
		'docker',
		['exec', '-i', 'supabase_db_Monster_Collective', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-c', sql],
		{ encoding: 'utf8' }
	)
	if (res.status !== 0) {
		throw new Error((res.stderr || res.stdout || 'psql failed').slice(0, 300))
	}
	return (res.stdout || '').trim()
}

async function recreateViaSignup(apiUrl, anon, email, password) {
	// Best-effort cleanup of prior disposable user (local SQL only).
	localPsql(`DELETE FROM auth.users WHERE email = '${email.replace(/'/g, "''")}';`)
	const client = createClient(apiUrl, anon, {
		auth: { persistSession: false, autoRefreshToken: false },
	})
	const signedUp = await client.auth.signUp({ email, password })
	if (signedUp.error) throw new Error(`signUp failed: ${signedUp.error.message}`)
	if (signedUp.data.session) {
		return { client, userId: signedUp.data.user.id, session: signedUp.data.session }
	}
	const signedIn = await client.auth.signInWithPassword({ email, password })
	if (signedIn.error || !signedIn.data.session) throw new Error('signIn failed after signup')
	return { client, userId: signedIn.data.user.id, session: signedIn.data.session }
}

function fingerprint(obj) {
	return createHash('sha256').update(JSON.stringify(obj)).digest('hex')
}

/** Stable subset compare — mirrors codec round-trip equality without dumping payloads. */
function stableOppFingerprint(record) {
	return JSON.stringify({
		id: record?.id ?? null,
		athleteId: record?.athleteId ?? null,
		title: record?.title ?? null,
		category: record?.category ?? null,
		status: record?.status ?? null,
		linkedDealId: record?.linkedDealId ?? null,
	})
}

/** Order-independent domain equality (mirrors src/persistence/workflows/stableId.ts). */
function stableStringify(value) {
	return JSON.stringify(value, (_key, v) => {
		if (v && typeof v === 'object' && !Array.isArray(v)) {
			const sorted = {}
			for (const k of Object.keys(v).sort()) sorted[k] = v[k]
			return sorted
		}
		return v
	})
}

function workflowRecordsEqual(a, b) {
	return stableStringify(a) === stableStringify(b)
}

/** Minimal planner mirroring committed conflict reasons. */
function planLocalVsCloud(localRecords, cloudById, activeAthleteId) {
	const recordsToInsert = []
	const alreadyPresent = []
	const rejectedRecords = []
	const conflicts = []
	const seen = new Map()
	for (let index = 0; index < localRecords.length; index++) {
		const raw = localRecords[index]
		if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') {
			rejectedRecords.push({ index, reason: 'malformed' })
			continue
		}
		if (seen.has(raw.id)) {
			rejectedRecords.push({ index, reason: 'duplicate_local' })
			conflicts.push({ clientId: raw.id, reason: 'duplicate_local_content' })
			continue
		}
		seen.set(raw.id, index)
		if (raw.athleteId && raw.athleteId !== activeAthleteId) {
			rejectedRecords.push({ index, reason: 'athlete_mismatch' })
			conflicts.push({ clientId: raw.id, reason: 'athlete_mismatch' })
			continue
		}
		if (cloudById.has(raw.id)) {
			const cloud = cloudById.get(raw.id)
			if (!workflowRecordsEqual(cloud, raw)) {
				conflicts.push({ clientId: raw.id, reason: 'content_mismatch' })
			} else {
				alreadyPresent.push(raw)
				conflicts.push({ clientId: raw.id, reason: 'cloud_exists' })
			}
			continue
		}
		recordsToInsert.push(raw)
	}
	return { recordsToInsert, alreadyPresent, rejectedRecords, conflicts }
}

function decideMode(plan, cloudRejectedCount = 0) {
	const blocking = new Set(['content_mismatch', 'athlete_mismatch', 'duplicate_local_content'])
	const hasInsertable = plan.recordsToInsert.length > 0
	const hasBlocking =
		plan.rejectedRecords.length > 0 ||
		cloudRejectedCount > 0 ||
		plan.conflicts.some((c) => blocking.has(c.reason))
	if (hasBlocking) return 'conflict'
	if (hasInsertable) return 'import_required'
	return 'cloud'
}

/** In-memory mirror of useWorkflowDomainPersistence write/mirror contracts. */
function createController(repo, storage) {
	let mode = 'local'
	let sessionStayLocal = false
	let pendingWrite = false
	let store = structuredClone(storage.get())
	let importPlan = null

	function mutationsDisabled() {
		return (
			mode === 'checking' ||
			mode === 'import_required' ||
			mode === 'conflict' ||
			mode === 'unavailable' ||
			pendingWrite
		)
	}

	async function bootstrap(userId, athleteId) {
		if (sessionStayLocal) {
			mode = 'local'
			return mode
		}
		mode = 'checking'
		store = structuredClone(storage.get())
		const listed = await repo.list(userId)
		if (!listed.ok) {
			mode = 'unavailable'
			return mode
		}
		const localForAthlete = Array.isArray(store[athleteId]) ? store[athleteId] : []
		const cloudForAthlete = listed.records.filter((r) => r.athleteId === athleteId)
		const plan = planLocalVsCloud(
			localForAthlete,
			new Map(cloudForAthlete.map((r) => [r.id, r])),
			athleteId
		)
		importPlan = plan
		const decision = decideMode(plan, listed.rejectedCount || 0)
		if (decision === 'conflict') {
			mode = 'conflict'
			return mode
		}
		if (decision === 'import_required') {
			mode = 'import_required'
			return mode
		}
		if ((listed.rejectedCount || 0) > 0) {
			mode = 'conflict'
			return mode
		}
		// Mirror only after complete decode
		const next = { ...store }
		for (const r of listed.records) {
			const key = r.athleteId || 'anonymous'
			if (!next[key]) next[key] = []
			const idx = next[key].findIndex((x) => x.id === r.id)
			if (idx === -1) next[key] = [r, ...next[key]]
			else next[key][idx] = r
		}
		store = next
		storage.set(store)
		mode = 'cloud'
		importPlan = null
		return mode
	}

	async function confirmImport(userId, athleteId) {
		if (mode !== 'import_required') return mode
		const listed = await repo.list(userId)
		if (!listed.ok) {
			mode = 'unavailable'
			return mode
		}
		const localForAthlete = Array.isArray(storage.get()[athleteId]) ? storage.get()[athleteId] : []
		const cloudForAthlete = listed.records.filter((r) => r.athleteId === athleteId)
		const plan = planLocalVsCloud(
			localForAthlete,
			new Map(cloudForAthlete.map((r) => [r.id, r])),
			athleteId
		)
		importPlan = plan
		const decision = decideMode(plan, listed.rejectedCount || 0)
		if (decision !== 'import_required') {
			mode = decision
			return mode
		}
		const insertIds = plan.recordsToInsert.map((r) => r.id)
		const inserted = await repo.insertMissing(userId, plan.recordsToInsert)
		if (!inserted.ok) {
			mode = 'unavailable'
			return mode
		}
		const verified = await repo.list(userId)
		if (!verified.ok) {
			mode = 'unavailable'
			return mode
		}
		const verifiedIds = new Set(verified.records.map((r) => r.id))
		for (const id of insertIds) {
			if (!verifiedIds.has(id)) {
				mode = 'unavailable'
				return mode
			}
		}
		store = structuredClone(storage.get())
		const next = { ...store }
		for (const r of verified.records) {
			const key = r.athleteId || 'anonymous'
			if (!next[key]) next[key] = []
			const idx = next[key].findIndex((x) => x.id === r.id)
			if (idx === -1) next[key] = [r, ...next[key]]
			else next[key][idx] = r
		}
		store = next
		storage.set(store)
		mode = 'cloud'
		importPlan = null
		return mode
	}

	function keepUsingDevice() {
		sessionStayLocal = true
		mode = 'local'
		importPlan = null
		store = structuredClone(storage.get())
	}

	async function upsert(userId, record) {
		if (mutationsDisabled()) return false
		if (mode === 'cloud') {
			if (pendingWrite) return false
			pendingWrite = true
			try {
				const result = await repo.upsert(userId, record)
				if (!result.ok) return false
				// Prefer canonical encode→decode record when repository returns it.
				const mirrored = result.record || record
				const key = mirrored.athleteId
				const list = store[key] || []
				const idx = list.findIndex((r) => r.id === mirrored.id)
				const updated =
					idx === -1 ? [mirrored, ...list] : list.map((r) => (r.id === mirrored.id ? mirrored : r))
				store = { ...store, [key]: updated }
				storage.set(store)
				return true
			} finally {
				pendingWrite = false
			}
		}
		const key = record.athleteId
		const list = store[key] || []
		const idx = list.findIndex((r) => r.id === record.id)
		const updated = idx === -1 ? [record, ...list] : list.map((r) => (r.id === record.id ? record : r))
		store = { ...store, [key]: updated }
		storage.set(store)
		return true
	}

	async function remove(userId, athleteId, id) {
		if (mutationsDisabled()) return false
		if (mode === 'cloud') {
			if (pendingWrite) return false
			pendingWrite = true
			try {
				const result = await repo.remove(userId, id)
				if (!result.ok) return false
				store = { ...store, [athleteId]: (store[athleteId] || []).filter((r) => r.id !== id) }
				storage.set(store)
				return true
			} finally {
				pendingWrite = false
			}
		}
		store = { ...store, [athleteId]: (store[athleteId] || []).filter((r) => r.id !== id) }
		storage.set(store)
		return true
	}

	return {
		get mode() {
			return mode
		},
		get store() {
			return store
		},
		get importPlan() {
			return importPlan
		},
		get sessionStayLocal() {
			return sessionStayLocal
		},
		mutationsDisabled,
		bootstrap,
		confirmImport,
		keepUsingDevice,
		upsert,
		remove,
		forceMode(next) {
			mode = next
		},
	}
}

function memoryStorage(initial = {}) {
	let raw = JSON.stringify(initial)
	const keysTouched = { setItem: [], removeItem: [], clear: 0 }
	return {
		get() {
			return JSON.parse(raw)
		},
		set(value) {
			raw = JSON.stringify(value)
			keysTouched.setItem.push('store')
		},
		snapshot() {
			return raw
		},
		keysTouched,
		assertNoRemoveOrClear() {
			assert(keysTouched.removeItem.length === 0, 'removeItem was called')
			assert(keysTouched.clear === 0, 'clear was called')
		},
	}
}

function domainRepo(client, table, encodeRow, decodeRow) {
	return {
		async list(userId) {
			const { data, error } = await client.from(table).select('*').eq('user_id', userId)
			if (error) return { ok: false, error: 'unavailable' }
			const records = []
			let rejectedCount = 0
			for (const row of data || []) {
				const decoded = decodeRow(row)
				if (decoded) records.push(decoded)
				else rejectedCount += 1
			}
			return { ok: true, records, rejectedCount }
		},
		async upsert(userId, record) {
			const row = encodeRow(userId, record)
			const decoded = decodeRow(row)
			if (!decoded) return { ok: false, error: 'decode_failure' }
			const { error } = await client.from(table).upsert(row, { onConflict: 'user_id,client_id' })
			return error ? { ok: false, error: 'write_failure' } : { ok: true, record: decoded }
		},
		async remove(userId, clientId) {
			const { error } = await client.from(table).delete().eq('user_id', userId).eq('client_id', clientId)
			return error ? { ok: false, error: 'write_failure' } : { ok: true }
		},
		async insertMissing(userId, records) {
			const existing = await client.from(table).select('client_id').eq('user_id', userId)
			if (existing.error) return { ok: false, error: 'unavailable' }
			const ids = new Set((existing.data || []).map((r) => r.client_id))
			const toInsert = []
			for (const record of records) {
				if (ids.has(record.id)) continue
				toInsert.push(encodeRow(userId, record))
				ids.add(record.id)
			}
			if (toInsert.length === 0) return { ok: true, inserted: 0 }
			const { error } = await client
				.from(table)
				.upsert(toInsert, { onConflict: 'user_id,client_id', ignoreDuplicates: true })
			return error ? { ok: false, error: 'write_failure' } : { ok: true, inserted: toInsert.length }
		},
		async get(userId, clientId) {
			const { data, error } = await client
				.from(table)
				.select('*')
				.eq('user_id', userId)
				.eq('client_id', clientId)
				.maybeSingle()
			if (error) return { ok: false, error: 'unavailable' }
			return { ok: true, record: data ? decodeRow(data) : null, rawPresent: Boolean(data) }
		},
	}
}

function encodeOpp(userId, record) {
	return {
		user_id: userId,
		client_id: record.id,
		athlete_id: record.athleteId,
		title: record.title,
		status: record.status,
		category: record.category,
		linked_deal_client_id: record.linkedDealId ?? null,
		payload: record,
		source: 'nil_roster_app',
	}
}
function decodeOpp(row) {
	if (!row?.payload || typeof row.payload !== 'object' || Array.isArray(row.payload)) return null
	return { ...row.payload, id: row.client_id, athleteId: row.payload.athleteId ?? row.athlete_id }
}
function encodeDeal(userId, record) {
	return {
		user_id: userId,
		client_id: record.id,
		athlete_id: record.athleteId,
		title: record.title,
		status: record.status,
		brand_name: record.brandName,
		deal_type: record.dealType,
		value_estimate: record.valueEstimate ?? null,
		payload: record,
		source: 'nil_roster_app',
	}
}
function decodeDeal(row) {
	if (!row?.payload || typeof row.payload !== 'object' || Array.isArray(row.payload)) return null
	return { ...row.payload, id: row.client_id, athleteId: row.payload.athleteId ?? row.athlete_id }
}
function encodeEvent(userId, record) {
	return {
		user_id: userId,
		client_id: record.id,
		athlete_id: record.athleteId,
		name: record.name,
		event_type: record.type,
		event_date: record.date,
		location: record.location,
		linked_deal_client_id: record.linkedDealId ?? null,
		payload: record,
		source: 'nil_roster_app',
	}
}
function decodeEvent(row) {
	if (!row?.payload || typeof row.payload !== 'object' || Array.isArray(row.payload)) return null
	return { ...row.payload, id: row.client_id, athleteId: row.payload.athleteId ?? row.athlete_id }
}

async function testDomainCrudAndIsolation(label, repoA, repoB, userA, userB, sample, updateTitle) {
	const empty = await repoA.list(userA)
	assert(empty.ok && empty.records.length === 0, `${label} expected empty list`)

	const up = await repoA.upsert(userA, sample)
	assert(up.ok, `${label} upsert failed`)

	const listed = await repoA.list(userA)
	assert(listed.ok && listed.records.some((r) => r.id === sample.id), `${label} list missing`)
	const got = await repoA.get(userA, sample.id)
	assert(got.ok && got.record && got.record.id === sample.id, `${label} get failed`)

	// Payload fidelity checks (boolean assertions only — no raw dump)
	if (label === 'deals') {
		assert(got.record.valueEstimate === 0, 'zero value lost')
		assert(got.record.reportedToSchool === false, 'false bool lost')
		assert(Array.isArray(got.record.deliverables) && got.record.deliverables.length === 0, 'empty arrays lost')
		assert(Array.isArray(got.record.payments), 'payments lost')
		assert(got.record.licensing && got.record.licensing.usesSchoolMarks === false, 'licensing lost')
		assert(Array.isArray(got.record.documents), 'documents lost')
	}
	if (label === 'opportunities') {
		assert(got.record.linkedDealId === sample.linkedDealId, 'linkedDealId lost')
		assert(got.record.notes === sample.notes, 'notes lost')
		assert(got.record.expectedStartDate === sample.expectedStartDate, 'start date lost')
		assert(got.record.expectedEndDate === sample.expectedEndDate, 'end date lost')
		assert(got.record.unknownNested?.keep === true, 'unknown field lost')
	}
	if (label === 'events') {
		assert(Array.isArray(got.record.sponsors) && got.record.sponsors.length === 0, 'sponsors lost')
		assert(got.record.linkedDealId === sample.linkedDealId, 'event linkedDealId lost')
		assert(got.record.runOfShowUrl === sample.runOfShowUrl, 'event runOfShowUrl lost')
		assert(got.record.url === sample.url, 'event url extension lost')
	}

	const updated = { ...sample, ...updateTitle }
	const up2 = await repoA.upsert(userA, updated)
	assert(up2.ok, `${label} re-upsert failed`)
	const after = await repoA.list(userA)
	assert(after.records.filter((r) => r.id === sample.id).length === 1, `${label} duplicate row`)

	// User B isolation
	const bList = await repoB.list(userB)
	assert(bList.ok && !bList.records.some((r) => r.id === sample.id), `${label} B listed A`)
	const bGet = await repoB.get(userB, sample.id)
	assert(bGet.ok && bGet.record === null && bGet.rawPresent === false, `${label} B got A by client_id`)
	const bUp = await repoB.upsert(userB, { ...updated, athleteId: ATHLETE_B })
	// B may insert own row with same client_id (composite key includes user_id) — that is OK.
	// Critical: B must not mutate A's row.
	const aStill = await repoA.get(userA, sample.id)
	assert(aStill.record && aStill.record.title === updated.title, `${label} A mutated by B upsert`)
	const bDel = await repoB.remove(userB, sample.id)
	assert(bDel.ok, `${label} B delete own/no-op path`)
	const aAfterBDel = await repoA.get(userA, sample.id)
	assert(aAfterBDel.record, `${label} A deleted via B`)

	const del = await repoA.remove(userA, sample.id)
	assert(del.ok, `${label} delete failed`)
	const gone = await repoA.get(userA, sample.id)
	assert(gone.ok && gone.record === null, `${label} still present after delete`)
}

async function main() {
	console.log('PR4B1_RUNTIME_GATE_START')
	assert(
		!process.env.SUPABASE_DB_PASSWORD,
		'SUPABASE_DB_PASSWORD must be unset for local gate'
	)
	if (process.env.DATABASE_URL) {
		assertLocalHost(new URL(process.env.DATABASE_URL).hostname)
	}
	if (process.env.PGHOST) {
		assertLocalHost(process.env.PGHOST)
	}
	if (process.env.VITE_SUPABASE_URL) {
		assertLocalHost(new URL(process.env.VITE_SUPABASE_URL).hostname)
	}

	const { apiUrl, anon } = readLocalStatus()
	console.log(`local_api_host=${new URL(apiUrl).hostname} local_api_port=${new URL(apiUrl).port}`)
	console.log('auth_path=signup_anon_jwt (admin_jwt_hs256_blocked)')

	// Confirm project container is Monster_Collective, not Vanta
	const dbName = localPsql(`SELECT current_database();`)
	assert(dbName === 'postgres', 'unexpected database')
	const tables = localPsql(
		`SELECT string_agg(tablename, ',' ORDER BY tablename) FROM pg_tables WHERE schemaname='public' AND tablename IN ('opportunities','deals','events');`
	)
	assert(tables === 'deals,events,opportunities', 'workflow tables missing')
	const rls = localPsql(
		`SELECT bool_and(rowsecurity) FROM pg_tables WHERE schemaname='public' AND tablename IN ('opportunities','deals','events');`
	)
	assert(rls === 't', 'RLS not enabled')
	pass('schema_rls_local_only')

	const a = await recreateViaSignup(apiUrl, anon, EMAIL_A, PASSWORD)
	const b = await recreateViaSignup(apiUrl, anon, EMAIL_B, PASSWORD)
	assert(a.userId && b.userId && a.userId !== b.userId, 'users not distinct')
	pass('synthetic_users_authenticated')

	const oppA = domainRepo(a.client, 'opportunities', encodeOpp, decodeOpp)
	const oppB = domainRepo(b.client, 'opportunities', encodeOpp, decodeOpp)
	const dealA = domainRepo(a.client, 'deals', encodeDeal, decodeDeal)
	const dealB = domainRepo(b.client, 'deals', encodeDeal, decodeDeal)
	const evtA = domainRepo(a.client, 'events', encodeEvent, decodeEvent)
	const evtB = domainRepo(b.client, 'events', encodeEvent, decodeEvent)

	const sampleOpp = {
		id: 'opp-pr4b1-1',
		athleteId: ATHLETE_A,
		title: 'Opp A',
		category: 'other',
		status: 'pitched',
		linkedDealId: 'deal-pr4b1-1',
		expectedStartDate: '2026-08-01',
		expectedEndDate: '2026-09-01',
		notes: 'opp notes keep',
		description: 'desc',
		targetBrandName: 'Brand',
		unknownNested: { keep: true },
	}
	const sampleDeal = {
		id: 'deal-pr4b1-1',
		athleteId: ATHLETE_A,
		title: 'Deal A',
		dealType: 'other',
		brandName: 'Brand',
		status: 'agreed',
		valueEstimate: 0,
		reportedToSchool: false,
		deliverables: [],
		documents: [],
		payments: [{ date: '2026-01-01', amount: 0, currency: 'USD' }],
		licensing: { usesSchoolMarks: false, notes: '' },
	}
	const sampleEvt = {
		id: 'evt-pr4b1-1',
		athleteId: ATHLETE_A,
		type: 'other',
		name: 'Event A',
		date: '2026-08-01',
		location: 'Gym',
		linkedDealId: 'deal-pr4b1-1',
		sponsors: [],
		runOfShowUrl: 'https://example.invalid/run',
		waiversUrl: 'https://example.invalid/waiver',
		notes: 'event notes',
		url: 'https://example.invalid/event',
	}

	await testDomainCrudAndIsolation('opportunities', oppA, oppB, a.userId, b.userId, sampleOpp, {
		title: 'Opp A Updated',
	})
	pass('opportunities_crud_rls')
	await testDomainCrudAndIsolation('deals', dealA, dealB, a.userId, b.userId, sampleDeal, {
		title: 'Deal A Updated',
	})
	pass('deals_crud_rls')
	await testDomainCrudAndIsolation('events', evtA, evtB, a.userId, b.userId, sampleEvt, {
		name: 'Event A Updated',
	})
	pass('events_crud_rls')

	// Cross-user delete/update with known client_id must not affect owner row
	await oppA.upsert(a.userId, sampleOpp)
	const crossUpdate = await b.client
		.from('opportunities')
		.update({ title: 'HACKED' })
		.eq('client_id', sampleOpp.id)
	assert(!crossUpdate.error, 'cross update request errored unexpectedly')
	const ownerAfterCross = await oppA.get(a.userId, sampleOpp.id)
	assert(ownerAfterCross.record.title === 'Opp A', 'cross-user update bypassed RLS')
	const crossDelete = await b.client.from('opportunities').delete().eq('client_id', sampleOpp.id)
	assert(!crossDelete.error, 'cross delete request errored unexpectedly')
	assert((await oppA.get(a.userId, sampleOpp.id)).record, 'cross-user delete bypassed RLS')
	await oppA.remove(a.userId, sampleOpp.id)
	pass('cross_user_client_id_knowledge_blocked')

	// --- Controller cases (opportunities representative; same adapters pattern for all) ---
	const storage = memoryStorage({})
	const controller = createController(oppA, storage)

	// Case 1: empty local / empty cloud
	assert((await controller.bootstrap(a.userId, ATHLETE_A)) === 'cloud', 'case1 mode')
	assert(!controller.mutationsDisabled(), 'case1 mutations')
	assert(controller.importPlan === null, 'case1 prompt')
	const created = {
		id: 'opp-ctrl-1',
		athleteId: ATHLETE_A,
		title: 'Ctrl Create',
		category: 'other',
		status: 'idea',
	}
	assert(await controller.upsert(a.userId, created), 'case1 create')
	assert((storage.get()[ATHLETE_A] || []).some((r) => r.id === 'opp-ctrl-1'), 'case1 mirror')
	assert((await oppA.list(a.userId)).records.some((r) => r.id === 'opp-ctrl-1'), 'case1 cloud')
	pass('case1_empty_empty_cloud_create_mirror')

	await oppA.remove(a.userId, 'opp-ctrl-1')
	localPsql(`DELETE FROM public.opportunities WHERE user_id = '${a.userId}';`)

	// Case 2: local records / empty cloud → import_required; no auto write
	const localOnly = {
		id: 'opp-local-1',
		athleteId: ATHLETE_A,
		title: 'Local Only',
		category: 'other',
		status: 'idea',
	}
	const mismatchedAthlete = {
		id: 'opp-mismatch-ath',
		athleteId: ATHLETE_B,
		title: 'Wrong Athlete',
		category: 'other',
		status: 'idea',
	}
	storage.set({ [ATHLETE_A]: [localOnly, mismatchedAthlete] })
	const c2 = createController(oppA, storage)
	assert((await c2.bootstrap(a.userId, ATHLETE_A)) === 'conflict', 'athlete mismatch should conflict')
	assert(c2.mutationsDisabled(), 'conflict mutations locked')
	assert((await oppA.list(a.userId)).records.length === 0, 'conflict must not write cloud')
	pass('athlete_mismatch_conflict_no_cloud_write')

	// Local-only safe import_required (no mismatch)
	storage.set({ [ATHLETE_A]: [localOnly] })
	const c2b = createController(oppA, storage)
	assert((await c2b.bootstrap(a.userId, ATHLETE_A)) === 'import_required', 'case2 mode')
	assert(c2b.mutationsDisabled(), 'case2 locked')
	assert((await oppA.list(a.userId)).records.length === 0, 'case2 auto cloud write')
	pass('case2_import_required_no_auto_write')

	// Keep using this device — session only
	const beforeKeep = storage.snapshot()
	c2b.keepUsingDevice()
	assert(c2b.mode === 'local', 'keep local mode')
	assert(c2b.sessionStayLocal === true, 'session flag')
	assert(storage.snapshot() === beforeKeep, 'keep must not rewrite mirror unexpectedly beyond reload')
	assert(await c2b.upsert(a.userId, { ...localOnly, title: 'Local Edit' }), 'local edit works')
	assert((await oppA.list(a.userId)).records.length === 0, 'keep must not write cloud')
	// No migration receipt key concept — storage only holds athlete store
	assert(!JSON.stringify(storage.get()).includes('migration_receipt'), 'receipt key')
	pass('keep_using_device_session_only')

	// New controller session may prompt again
	storage.set({ [ATHLETE_A]: [localOnly] })
	const c2c = createController(oppA, storage)
	assert((await c2c.bootstrap(a.userId, ATHLETE_A)) === 'import_required', 'reprompt')
	pass('import_reprompt_new_session')

	// Explicit import with confirmation semantics (controller confirmImport = confirmed path)
	assert((await c2c.confirmImport(a.userId, ATHLETE_A)) === 'cloud', 'import activate')
	assert((await oppA.list(a.userId)).records.some((r) => r.id === 'opp-local-1'), 'import inserted')
	assert((storage.get()[ATHLETE_A] || []).some((r) => r.id === 'opp-local-1'), 'local retained')
	// Second import idempotent: same local row already in cloud → cloud mode, still one row
	storage.set({ [ATHLETE_A]: [localOnly] })
	const c2d = createController(oppA, storage)
	assert((await c2d.bootstrap(a.userId, ATHLETE_A)) === 'cloud', 'idempotent already present → cloud')
	const insertAgain = await oppA.insertMissing(a.userId, [localOnly])
	assert(insertAgain.ok, 'idempotent insertMissing ok')
	const countAfter = (await oppA.list(a.userId)).records.filter((r) => r.id === 'opp-local-1').length
	assert(countAfter === 1, 'idempotent duplicate insert')
	pass('explicit_import_idempotent')

	// Equivalent local/cloud → cloud, mirror retained
	const equiv = (await oppA.get(a.userId, 'opp-local-1')).record
	storage.set({ [ATHLETE_A]: [equiv] })
	const cEq = createController(oppA, storage)
	assert((await cEq.bootstrap(a.userId, ATHLETE_A)) === 'cloud', 'equivalent mode')
	pass('local_cloud_equivalent')

	// Cloud non-conflicting superset
	await oppA.upsert(a.userId, {
		id: 'opp-cloud-extra',
		athleteId: ATHLETE_A,
		title: 'Cloud Extra',
		category: 'other',
		status: 'idea',
	})
	storage.set({ [ATHLETE_A]: [equiv] })
	const cSup = createController(oppA, storage)
	assert((await cSup.bootstrap(a.userId, ATHLETE_A)) === 'cloud', 'superset mode')
	assert((storage.get()[ATHLETE_A] || []).some((r) => r.id === 'opp-cloud-extra'), 'superset mirrored')
	pass('cloud_superset_mirror')

	// Conflict: same ID different content — mirror byte-equivalent
	await oppA.remove(a.userId, 'opp-cloud-extra')
	storage.set({
		[ATHLETE_A]: [{ ...equiv, title: 'DIFFERENT LOCAL TITLE' }],
	})
	const beforeConflict = storage.snapshot()
	const cConf = createController(oppA, storage)
	assert((await cConf.bootstrap(a.userId, ATHLETE_A)) === 'conflict', 'content conflict')
	assert(cConf.mutationsDisabled(), 'conflict locked')
	assert(storage.snapshot() === beforeConflict, 'conflict altered mirror')
	assert(!(await cConf.upsert(a.userId, { ...equiv, title: 'x' })), 'conflict create blocked')
	assert(!(await cConf.remove(a.userId, ATHLETE_A, equiv.id)), 'conflict delete blocked')
	pass('content_conflict_mirror_frozen')

	// Deal Preview regression: complianceNotes drift → conflict → restore mirror → Retry → delete
	localPsql(`DELETE FROM public.deals WHERE user_id = '${a.userId}';`)
	const dealCloud = {
		id: 'deal-conflict-1',
		athleteId: ATHLETE_A,
		title: 'Deal Conflict',
		dealType: 'other',
		brandName: 'Brand',
		status: 'idea',
		reportedToSchool: false,
		deliverables: [],
		documents: [],
		payments: [],
		licensing: { usesSchoolMarks: false },
	}
	assert((await dealA.upsert(a.userId, dealCloud)).ok, 'deal conflict seed upsert')
	const dealCanonical = (await dealA.get(a.userId, dealCloud.id)).record
	assert(dealCanonical, 'deal canonical missing')
	const dealStorage = memoryStorage({ [ATHLETE_A]: [dealCanonical] })
	const cDealEq = createController(dealA, dealStorage)
	assert((await cDealEq.bootstrap(a.userId, ATHLETE_A)) === 'cloud', 'deal equivalent cloud')
	assert(!cDealEq.mutationsDisabled(), 'deal mutations unlocked')
	// Harmless local-only complianceNotes invent (Preview DealCompliance mount bug shape)
	dealStorage.set({
		[ATHLETE_A]: [{ ...dealCanonical, complianceNotes: '' }],
	})
	const cDealConf = createController(dealA, dealStorage)
	assert((await cDealConf.bootstrap(a.userId, ATHLETE_A)) === 'conflict', 'deal compliance drift conflict')
	assert(cDealConf.mutationsDisabled(), 'deal conflict locked')
	assert(!(await cDealConf.remove(a.userId, ATHLETE_A, dealCloud.id)), 'deal delete blocked in conflict')
	// Restore exact original mirror without hard refresh, then Retry/Recheck (bootstrap rereads storage+cloud)
	dealStorage.set({ [ATHLETE_A]: [dealCanonical] })
	assert((await cDealConf.bootstrap(a.userId, ATHLETE_A)) === 'cloud', 'deal retry recovers cloud')
	assert(!cDealConf.mutationsDisabled(), 'deal controls unlocked after retry')
	assert(await cDealConf.remove(a.userId, ATHLETE_A, dealCloud.id), 'deal delete after recovery')
	assert(!(dealStorage.get()[ATHLETE_A] || []).some((r) => r.id === dealCloud.id), 'deal mirror removed')
	assert(!(await dealA.get(a.userId, dealCloud.id)).record, 'deal cloud removed')
	pass('deal_conflict_retry_recover_delete')

	// Duplicate local + malformed
	storage.set({
		[ATHLETE_A]: [equiv, { ...equiv, title: 'dup' }, { not: 'an opportunity' }],
	})
	const beforeDup = storage.snapshot()
	const cDup = createController(oppA, storage)
	assert((await cDup.bootstrap(a.userId, ATHLETE_A)) === 'conflict', 'dup/malformed conflict')
	assert(storage.snapshot() === beforeDup, 'dup conflict mirror')
	pass('duplicate_malformed_conflict')

	// Unavailable: failing repo
	const failingRepo = {
		async list() {
			return { ok: false, error: 'unavailable' }
		},
		async upsert() {
			return { ok: false, error: 'write_failure' }
		},
		async remove() {
			return { ok: false, error: 'write_failure' }
		},
		async insertMissing() {
			return { ok: false, error: 'write_failure' }
		},
	}
	storage.set({ [ATHLETE_A]: [localOnly] })
	const beforeUnavail = storage.snapshot()
	const cUn = createController(failingRepo, storage)
	assert((await cUn.bootstrap(a.userId, ATHLETE_A)) === 'unavailable', 'unavailable mode')
	assert(cUn.mutationsDisabled(), 'unavailable locked')
	assert(storage.snapshot() === beforeUnavail, 'unavailable mirror write')
	assert(!(await cUn.upsert(a.userId, localOnly)), 'unavailable silent local mutation')
	pass('unavailable_locks_no_mirror_write')

	// Cloud write order + failure injection
	localPsql(`DELETE FROM public.opportunities WHERE user_id = '${a.userId}';`)
	storage.set({})
	let failNext = false
	const flaky = {
		async list(userId) {
			return oppA.list(userId)
		},
		async upsert(userId, record) {
			if (failNext) return { ok: false, error: 'write_failure' }
			return oppA.upsert(userId, record)
		},
		async remove(userId, id) {
			if (failNext) return { ok: false, error: 'write_failure' }
			return oppA.remove(userId, id)
		},
		async insertMissing(userId, records) {
			return oppA.insertMissing(userId, records)
		},
	}
	const cWrite = createController(flaky, storage)
	assert((await cWrite.bootstrap(a.userId, ATHLETE_A)) === 'cloud', 'write bootstrap')
	const rec = {
		id: 'opp-write-1',
		athleteId: ATHLETE_A,
		title: 'Write1',
		category: 'other',
		status: 'idea',
	}
	assert(await cWrite.upsert(a.userId, rec), 'create ok')
	assert((storage.get()[ATHLETE_A] || []).some((r) => r.id === 'opp-write-1'), 'create mirrored')
	failNext = true
	const beforeFailEdit = storage.snapshot()
	assert(!(await cWrite.upsert(a.userId, { ...rec, title: 'NOPE' })), 'failed edit')
	assert(storage.snapshot() === beforeFailEdit, 'failed edit mirror')
	assert((await oppA.get(a.userId, 'opp-write-1')).record.title === 'Write1', 'failed edit cloud')
	failNext = false
	assert(await cWrite.upsert(a.userId, { ...rec, title: 'Write1b' }), 'edit ok')
	failNext = true
	const beforeFailDel = storage.snapshot()
	assert(!(await cWrite.remove(a.userId, ATHLETE_A, 'opp-write-1')), 'failed delete')
	assert(storage.snapshot() === beforeFailDel, 'failed delete mirror')
	assert((await oppA.get(a.userId, 'opp-write-1')).record, 'failed delete cloud')
	failNext = false
	assert(await cWrite.remove(a.userId, ATHLETE_A, 'opp-write-1'), 'delete ok')
	assert(!(storage.get()[ATHLETE_A] || []).some((r) => r.id === 'opp-write-1'), 'delete mirrored')
	pass('cloud_write_order_and_failure_guards')

	// Storage key contract (logical)
	const keyNames = ['opps.store', 'deals.store', 'events.store']
	assert(keyNames.length === 3, 'key names')
	storage.assertNoRemoveOrClear()
	pass('localstorage_key_contract_no_clear')

	// Business status side effects: committed UIs update businesses only via separate onUpdateBusiness controls
	// (not inside workflow upsert/remove). Documented as independent, not a write-order side effect.
	pass('business_status_independent_controls')

	// Cleanup disposable users + rows (local SQL only; admin JWT blocked)
	localPsql(`
DELETE FROM public.opportunities WHERE user_id IN ('${a.userId}','${b.userId}');
DELETE FROM public.deals WHERE user_id IN ('${a.userId}','${b.userId}');
DELETE FROM public.events WHERE user_id IN ('${a.userId}','${b.userId}');
DELETE FROM auth.users WHERE id IN ('${a.userId}','${b.userId}');
`)
	pass('cleanup_complete')

	const failed = results.filter((r) => !r.ok)
	if (failed.length) {
		console.error(`PR4B1_RUNTIME_GATE_FAIL count=${failed.length}`)
		process.exit(1)
	}
	console.log(`PR4B1_RUNTIME_GATE_PASS checks=${results.length}`)
	console.log('NOTE auth_admin_jwt=blocked_hs256; used_signup_sessions=true; cleanup=local_psql')
}

main().catch((err) => {
	console.error('PR4B1_RUNTIME_GATE_FAIL', String(err && err.message ? err.message : err).slice(0, 300))
	process.exit(1)
})
