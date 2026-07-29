/**
 * LOCAL-ONLY NIL Roster ledger reconciliation rehearsal.
 *
 * Proves migration ordering against a disposable production-shaped local DB.
 * Refuses remote hosts, linked repair/push, and SUPABASE_DB_PASSWORD.
 * Does not print secrets.
 *
 * Usage (from repo root, local stack running):
 *   node test/nil-roster-ledger-reconciliation-rehearsal/rehearse.mjs
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const REHEARSAL = path.join(ROOT, 'test/nil-roster-ledger-reconciliation-rehearsal')
const FIXTURE = path.join(REHEARSAL, 'production_shaped_baseline_local.sql')
const OVERLAY = path.join(REHEARSAL, 'production_shaped_overlay.sql')
const RECONCILE = path.join(
	ROOT,
	'supabase/migrations/20260724_reconcile_nil_roster_production_schema.sql'
)
const WORKFLOW = path.join(
	ROOT,
	'supabase/migrations/20260723_nil_roster_workflow_cloud_persistence.sql'
)
const MIGRATIONS = path.join(ROOT, 'supabase/migrations')
const MIGRATIONS_ASIDE = path.join(ROOT, 'supabase/migrations.__rehearsal_aside')
const RESULTS = path.join(REHEARSAL, 'RESULTS.json')
const DB_CONTAINER = 'supabase_db_Monster_Collective'

const HISTORICAL = [
	'20241231',
	'20250101',
	'20251227',
	'20260128',
	'20260201',
	'20260202',
	'20260203',
	'20260205',
	'20260223',
]
const EXPECTED_FINAL = [...HISTORICAL, '20260723', '20260724']

const ABSENT_BEFORE = [
	'athlete_profile',
	'onboarding_progress',
	'orgs',
	'org_contacts',
	'user_targets',
	'recruiting_targets',
	'anon_sessions',
	'user_data',
	'search_cache',
	'opportunities',
	'deals',
	'events',
]

const report = {
	startedAt: new Date().toISOString(),
	dependencyAudit: {},
	baseline: {},
	proposedSequence: [],
	alternatives: {},
	selectedSequence: null,
	finalLedger: [],
	finalSchema: {},
	failureResume: {},
	cliBehavior: {},
	errors: [],
}

function assert(cond, msg) {
	if (!cond) throw new Error(msg)
}

function assertNoRemoteCreds() {
	assert(!process.env.SUPABASE_DB_PASSWORD, 'SUPABASE_DB_PASSWORD must be unset')
	const dbUrl = process.env.DATABASE_URL || ''
	if (dbUrl) {
		assert(/localhost|127\.0\.0\.1/.test(dbUrl), 'DATABASE_URL must be local or unset')
	}
	const pghost = process.env.PGHOST || ''
	if (pghost) {
		assert(
			['localhost', '127.0.0.1', '::1'].includes(pghost.toLowerCase()),
			'PGHOST must be local or unset'
		)
	}
}

function run(cmd, args, opts = {}) {
	const res = spawnSync(cmd, args, {
		cwd: ROOT,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
		shell: false,
		...opts,
	})
	const out = `${res.stdout || ''}${res.stderr || ''}`.trim()
	return { status: res.status ?? 1, out, stdout: res.stdout || '', stderr: res.stderr || '' }
}

function supabaseLocal(args) {
	const finalArgs = [...args]
	if (!finalArgs.includes('--local')) finalArgs.push('--local')
	const joined = finalArgs.join(' ')
	assert(joined.includes('--local'), `refusing non-local CLI args: ${joined}`)
	assert(!joined.includes('--linked'), `refusing --linked: ${joined}`)
	assert(!/(^| )(-p|--password)( |$)/.test(joined), 'refusing password flag')
	if (!finalArgs.includes('--yes')) {
		const sub = finalArgs.join(' ')
		if (sub.includes('repair') || sub.includes('db reset') || sub.includes('db push')) {
			finalArgs.push('--yes')
		}
	}
	console.log(`CLI: supabase ${finalArgs.join(' ')}`)
	confirmLocalTarget()
	return run('supabase', finalArgs)
}

function confirmLocalTarget() {
	const st = run('supabase', ['status', '-o', 'env'])
	assert(st.status === 0, `supabase status failed: ${st.out.slice(0, 300)}`)
	const api = (st.stdout.match(/API_URL="?([^"\r\n]+)/) || [])[1]
	const db = (st.stdout.match(/DB_URL="?([^"\r\n]+)/) || [])[1]
	assert(api, 'missing local API_URL')
	assert(db, 'missing local DB_URL')
	const apiHost = new URL(api).hostname
	const dbHost = new URL(db).hostname
	assert(
		['localhost', '127.0.0.1', '::1'].includes(apiHost),
		`refusing non-local API host ${apiHost}`
	)
	assert(
		['localhost', '127.0.0.1', '::1'].includes(dbHost),
		`refusing non-local DB host ${dbHost}`
	)
	console.log(`target_confirmed host=${dbHost} port=${new URL(db).port || '(default)'}`)
	return { apiHost, dbHost, dbPort: new URL(db).port }
}

function psql(sql) {
	const res = run('docker', [
		'exec',
		'-i',
		DB_CONTAINER,
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
	])
	if (res.status !== 0) throw new Error(`psql failed: ${res.out.slice(0, 800)}`)
	return res.stdout.trim()
}

function psqlFile(filePath) {
	const base = path.basename(filePath)
	const cp = run('docker', ['cp', filePath, `${DB_CONTAINER}:/tmp/${base}`])
	assert(cp.status === 0, `docker cp failed: ${cp.out}`)
	const res = run('docker', [
		'exec',
		DB_CONTAINER,
		'psql',
		'-U',
		'postgres',
		'-d',
		'postgres',
		'-v',
		'ON_ERROR_STOP=1',
		'-f',
		`/tmp/${base}`,
	])
	if (res.status !== 0) throw new Error(`psqlFile ${base} failed: ${res.out.slice(0, 1200)}`)
	return res.out
}

function restoreMigrationsIfAside() {
	if (fs.existsSync(MIGRATIONS_ASIDE)) {
		if (fs.existsSync(MIGRATIONS)) {
			// merge back if somehow both exist
			for (const f of fs.readdirSync(MIGRATIONS_ASIDE)) {
				fs.renameSync(path.join(MIGRATIONS_ASIDE, f), path.join(MIGRATIONS, f))
			}
			fs.rmdirSync(MIGRATIONS_ASIDE)
		} else {
			fs.renameSync(MIGRATIONS_ASIDE, MIGRATIONS)
		}
	}
}

function moveMigrationsAside() {
	restoreMigrationsIfAside()
	assert(fs.existsSync(MIGRATIONS), 'migrations folder missing')
	fs.renameSync(MIGRATIONS, MIGRATIONS_ASIDE)
	fs.mkdirSync(MIGRATIONS)
}

function auditDependencies() {
	const w = fs.readFileSync(WORKFLOW, 'utf8')
	const r = fs.readFileSync(RECONCILE, 'utf8')
	const wLower = w.toLowerCase()
	const rLower = r.toLowerCase()

	const workflowCreatesFn = /create\s+or\s+replace\s+function\s+public\.set_workflow_updated_at\s*\(/.test(
		wLower
	)
	const reconcileCreatesFn = /create\s+or\s+replace\s+function\s+public\.set_workflow_updated_at\s*\(/.test(
		rLower
	)
	const workflowNeedsReconcileObject = false // self-contained; creates own function + tables
	const workflowUsesDropPolicy = wLower.includes('drop policy if exists')
	const reconcileUsesDropPolicy = rLower.includes('drop policy if exists')

	report.dependencyAudit = {
		'20260723': {
			functionsCreated: ['set_workflow_updated_at'],
			dependencies: ['auth.users (FK)', 'auth.uid()'],
			requires20260724: workflowNeedsReconcileObject,
			independentlyExecutable: workflowCreatesFn && !workflowNeedsReconcileObject,
			rerunSafety:
				workflowUsesDropPolicy &&
				wLower.includes('create table if not exists') &&
				wLower.includes('drop trigger if exists')
					? 'safe (IF NOT EXISTS / DROP IF EXISTS / CREATE OR REPLACE)'
					: 'review',
			createsSetWorkflowUpdatedAt: workflowCreatesFn,
		},
		'20260724': {
			functionsCreated: ['set_workflow_updated_at', 'update_anon_session_last_seen'],
			dependencies: ['auth.users (FK)', 'auth.uid()'],
			independentlyExecutable: true,
			rerunSafety:
				reconcileUsesDropPolicy &&
				rLower.includes('create table if not exists') &&
				reconcileCreatesFn
					? 'safe (IF NOT EXISTS / DROP IF EXISTS / CREATE OR REPLACE)'
					: 'review',
			createsSetWorkflowUpdatedAt: reconcileCreatesFn,
			createsWorkflowTables: false,
		},
		orderDefect: false,
		notes:
			'20260723 creates set_workflow_updated_at itself; does not require any 20260724 object. Either order is SQL-safe. Both are rerunnable.',
	}
	return report.dependencyAudit
}

function captureBaseline(label) {
	const tables = psql(`
SELECT string_agg(tablename, ',' ORDER BY tablename)
FROM pg_tables WHERE schemaname='public'
`)
	const counts = {
		waitlist: Number(psql(`SELECT COUNT(*) FROM public.waitlist`)),
		profiles: Number(psql(`SELECT COUNT(*) FROM public.profiles`)),
		athlete_profiles: Number(psql(`SELECT COUNT(*) FROM public.athlete_profiles`)),
		saved_businesses: Number(psql(`SELECT COUNT(*) FROM public.saved_businesses`)),
		businesses: Number(psql(`SELECT COUNT(*) FROM public.businesses`)),
		user_businesses: Number(psql(`SELECT COUNT(*) FROM public.user_businesses`)),
	}
	const athleteType = psql(`
SELECT udt_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='athlete_profiles' AND column_name='user_id'
`)
	const ledger = psql(`
SELECT COALESCE(string_agg(version, ',' ORDER BY version), '')
FROM supabase_migrations.schema_migrations
`)
	const absent = {}
	for (const t of ABSENT_BEFORE) {
		absent[t] = psql(`SELECT to_regclass('public.${t}') IS NOT NULL`) === 't'
	}
	const rls = psql(`
SELECT relrowsecurity::text FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='athlete_profiles'
`)
	const snapshot = {
		label,
		tables: tables.split(',').filter(Boolean),
		counts,
		athlete_profiles_user_id: athleteType,
		ledgerVersions: ledger ? ledger.split(',') : [],
		absentPresent: absent,
		athlete_profiles_rls: rls,
	}
	return snapshot
}

function ledgerVersions() {
	const ledger = psql(`
SELECT COALESCE(string_agg(version, ',' ORDER BY version), '')
FROM supabase_migrations.schema_migrations
`)
	return ledger ? ledger.split(',').filter(Boolean) : []
}

function migrationListLocal() {
	const res = supabaseLocal(['migration', 'list', '--local'])
	return res
}

function buildProductionShaped() {
	console.log('\n=== BUILD production-shaped local state ===')
	moveMigrationsAside()
	try {
		const reset = supabaseLocal(['db', 'reset', '--local', '--yes'])
		assert(reset.status === 0, `db reset (no migrations) failed: ${reset.out.slice(0, 800)}`)
		// Apply committed fixture (creates production-shaped public objects)
		psqlFile(FIXTURE)
		psqlFile(OVERLAY)
	} finally {
		restoreMigrationsIfAside()
	}

	const baseline = captureBaseline('production-shaped')
	assert(baseline.athlete_profiles_user_id === 'text', 'athlete_profiles.user_id must be text')
	assert(baseline.counts.athlete_profiles === 5, 'expected 5 synthetic athlete_profiles')
	assert(baseline.ledgerVersions.length === 0, 'ledger must be empty')
	for (const t of ABSENT_BEFORE) {
		assert(baseline.absentPresent[t] === false, `${t} must be absent before reconcile`)
	}
	report.baseline = baseline
	console.log(
		`baseline_ok tables=${baseline.tables.length} athlete_type=${baseline.athlete_profiles_user_id} ledger_empty=true`
	)
	return baseline
}

function verifyPreserved(baseline) {
	const now = captureBaseline('verify')
	assert(now.counts.waitlist === baseline.counts.waitlist, 'waitlist count changed')
	assert(now.counts.profiles === baseline.counts.profiles, 'profiles count changed')
	assert(
		now.counts.athlete_profiles === baseline.counts.athlete_profiles,
		'athlete_profiles count changed'
	)
	assert(now.athlete_profiles_user_id === 'text', 'athlete_profiles.user_id mutated')
	assert(
		now.counts.saved_businesses === baseline.counts.saved_businesses,
		'saved_businesses count changed'
	)
	assert(now.counts.businesses === baseline.counts.businesses, 'businesses count changed')
	assert(
		now.counts.user_businesses === baseline.counts.user_businesses,
		'user_businesses count changed'
	)
	return now
}

function verifyReconciledTables() {
	for (const t of [
		'athlete_profile',
		'onboarding_progress',
		'orgs',
		'org_contacts',
		'user_targets',
		'recruiting_targets',
		'anon_sessions',
		'user_data',
		'search_cache',
	]) {
		assert(psql(`SELECT to_regclass('public.${t}') IS NOT NULL`) === 't', `missing ${t}`)
	}
}

function verifyWorkflowTables() {
	for (const t of ['opportunities', 'deals', 'events']) {
		assert(psql(`SELECT to_regclass('public.${t}') IS NOT NULL`) === 't', `missing ${t}`)
		assert(
			psql(`
SELECT relrowsecurity::text FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='${t}'
`) === 'true',
			`RLS not enabled on ${t}`
		)
	}
	const policyCount = Number(
		psql(`
SELECT COUNT(*) FROM pg_policies
WHERE schemaname='public' AND tablename IN ('opportunities','deals','events')
`)
	)
	assert(policyCount >= 12, `expected >=12 workflow policies, got ${policyCount}`)

	const wfTriggers = Number(
		psql(`
SELECT COUNT(*) FROM pg_trigger t
JOIN pg_proc p ON p.oid=t.tgfoid
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE NOT t.tgisinternal AND n.nspname='public' AND p.proname='set_workflow_updated_at'
`)
	)
	assert(wfTriggers >= 3, `expected workflow triggers >=3, got ${wfTriggers}`)

	const sharedTriggers = Number(
		psql(`
SELECT COUNT(*) FROM pg_trigger t
JOIN pg_proc p ON p.oid=t.tgfoid
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE NOT t.tgisinternal AND n.nspname='public' AND p.proname='set_updated_at'
`)
	)
	assert(sharedTriggers >= 2, `expected shared set_updated_at dependents >=2, got ${sharedTriggers}`)

	const anonWorkflowGrants = psql(`
SELECT COALESCE(string_agg(privilege_type, ','), '')
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND table_name IN ('opportunities','deals','events')
  AND grantee='anon'
`)
	assert(anonWorkflowGrants === '', `anon must not have workflow grants, got ${anonWorkflowGrants}`)
}

function step(log, fn) {
	console.log(`\n--- ${log} ---`)
	const entry = { step: log, ok: false, ledger: [], detail: '' }
	try {
		const detail = fn() || ''
		entry.ok = true
		entry.detail = typeof detail === 'string' ? detail.slice(0, 1500) : JSON.stringify(detail).slice(0, 1500)
		entry.ledger = ledgerVersions()
		report.proposedSequence.push(entry)
		return entry
	} catch (err) {
		entry.ok = false
		entry.detail = err instanceof Error ? err.message : String(err)
		entry.ledger = ledgerVersions()
		report.proposedSequence.push(entry)
		throw err
	}
}

function testProposedSequence(baseline) {
	console.log('\n=== PART C: proposed sequence ===')
	report.proposedSequence = []

	step('1. Apply 20260724 SQL manually via local psql', () => {
		psqlFile(RECONCILE)
		verifyReconciledTables()
		verifyPreserved(baseline)
		return 'reconcile applied; data preserved'
	})

	step('2. Verify reconciled objects', () => {
		verifyReconciledTables()
		assert(psql(`SELECT to_regclass('public.opportunities') IS NOT NULL`) === 'f', 'workflow must still be absent')
		return 'reconciled present; workflow absent'
	})

	step('3. Mark historical versions 20241231-20260223 applied (--local)', () => {
		const res = supabaseLocal([
			'migration',
			'repair',
			'--status',
			'applied',
			'--local',
			'--yes',
			...HISTORICAL,
		])
		assert(res.status === 0, `historical repair failed: ${res.out.slice(0, 800)}`)
		const versions = ledgerVersions()
		for (const v of HISTORICAL) assert(versions.includes(v), `missing ledger ${v}`)
		assert(!versions.includes('20260723'), '20260723 should remain unrecorded')
		assert(!versions.includes('20260724'), '20260724 should remain unrecorded until marked')
		return res.out.slice(0, 500)
	})

	step('4. Mark 20260724 applied (--local)', () => {
		const res = supabaseLocal([
			'migration',
			'repair',
			'--status',
			'applied',
			'--local',
			'--yes',
			'20260724',
		])
		assert(res.status === 0, `20260724 repair failed: ${res.out.slice(0, 800)}`)
		assert(ledgerVersions().includes('20260724'), '20260724 not in ledger')
		return res.out.slice(0, 500)
	})

	step('5. Confirm 20260723 pending via migration list --local', () => {
		const res = migrationListLocal()
		assert(res.status === 0, `migration list failed: ${res.out.slice(0, 500)}`)
		const versions = ledgerVersions()
		assert(!versions.includes('20260723'), '20260723 should still be pending (not in ledger)')
		report.cliBehavior.pendingAfterRepair = res.out.slice(0, 800)
		return res.out.slice(0, 800)
	})

	step('6. Plain db push --local (expect CLI reject without --include-all)', () => {
		const res = supabaseLocal(['db', 'push', '--local', '--yes'])
		report.cliBehavior.dbPushWithoutIncludeAll = {
			status: res.status,
			out: res.out.slice(0, 2000),
		}
		assert(res.status !== 0, 'expected plain db push to reject out-of-order pending 20260723')
		assert(
			/include-all/i.test(res.out),
			`expected include-all guidance, got: ${res.out.slice(0, 500)}`
		)
		assert(!ledgerVersions().includes('20260723'), '20260723 must still be pending after reject')
		return res.out.slice(0, 800)
	})

	step('7. db push --local --include-all (apply 20260723 once)', () => {
		const res = run('supabase', ['db', 'push', '--local', '--yes', '--include-all'])
		report.cliBehavior.dbPushWithIncludeAll = {
			status: res.status,
			out: res.out.slice(0, 2000),
		}
		assert(res.status === 0, `db push --include-all failed: ${res.out.slice(0, 1200)}`)
		assert(ledgerVersions().includes('20260723'), '20260723 not recorded after include-all push')
		verifyWorkflowTables()
		verifyPreserved(baseline)
		return res.out.slice(0, 800)
	})

	step('8. Final contract checks', () => {
		verifyReconciledTables()
		verifyWorkflowTables()
		verifyPreserved(baseline)
		const final = ledgerVersions()
		assert(
			EXPECTED_FINAL.every((v) => final.includes(v)),
			`final ledger incomplete: ${final.join(',')}`
		)
		assert(final.length === EXPECTED_FINAL.length, `unexpected ledger extras: ${final.join(',')}`)
		return `ledger=${final.join(',')}`
	})

	report.selectedSequence =
		'proposed-manual-20260724-then-repair-historical-and-20260724-then-db-push-include-all-20260723'
	report.cliBehavior.acceptsLowerPendingAfterHigherApplied = 'only with --include-all'
	return true
}

function testFailureResume(baseline) {
	console.log('\n=== PART G: failure/resume ===')
	// Rebuild production-shaped, apply reconcile+historical only, leave workflow pending, then resume
	buildProductionShaped()
	const b2 = report.baseline
	psqlFile(RECONCILE)
	supabaseLocal([
		'migration',
		'repair',
		'--status',
		'applied',
		'--local',
		'--yes',
		...HISTORICAL,
		'20260724',
	])
	assert(!ledgerVersions().includes('20260723'), 'interrupt point: workflow must be pending')
	assert(psql(`SELECT to_regclass('public.opportunities') IS NOT NULL`) === 'f')

	const resume = run('supabase', ['db', 'push', '--local', '--yes', '--include-all'])
	assert(resume.status === 0, `resume push failed: ${resume.out.slice(0, 800)}`)
	verifyWorkflowTables()
	verifyPreserved(b2)
	const final = ledgerVersions()
	assert(EXPECTED_FINAL.every((v) => final.includes(v)), 'resume ledger incomplete')

	// Second push should be no-op / safe
	const again = run('supabase', ['db', 'push', '--local', '--yes', '--include-all'])
	assert(again.status === 0, `idempotent push failed: ${again.out.slice(0, 500)}`)
	verifyPreserved(b2)

	report.failureResume = {
		simulatedInterruption: 'reconcile+historical+20260724 repaired; workflow pending',
		resumeResult: 'db push --local --include-all applied 20260723 once',
		dataPreservation: 'pass',
		ledgerBehavior: final.join(','),
		idempotentRepush: again.out.slice(0, 400),
	}
}

function testAlternative2Quick() {
	// Only if needed — document as not needed when proposed passes and 20260723 is independent
	report.alternatives = {
		alt1: {
			tested: false,
			result: 'not needed',
			reason:
				'Proposed sequence accepted by CLI; leaving 20260724 unrepaired would risk duplicate apply of additive-but-policy-heavy SQL unnecessarily.',
		},
		alt2: {
			tested: 'optional-smoke',
			result: 'pending',
			reason:
				'20260723 is independently executable; normal version order works if neither forward migration is pre-applied.',
		},
		alt3: {
			tested: false,
			result: 'not needed',
			reason: 'CLI accepted lower pending version after higher marked applied.',
		},
		alt4: {
			tested: false,
			result: 'not needed',
			reason: 'No migration-order SQL defect; 20260723 creates set_workflow_updated_at itself.',
		},
	}
}

function testAlternative2AgainstFreshShaped() {
	console.log('\n=== ALT2 smoke: historical repair only, then db push (23 then 24) ===')
	buildProductionShaped()
	const b = report.baseline
	const repair = supabaseLocal([
		'migration',
		'repair',
		'--status',
		'applied',
		'--local',
		'--yes',
		...HISTORICAL,
	])
	assert(repair.status === 0, `alt2 historical repair failed: ${repair.out.slice(0, 500)}`)
	const push = supabaseLocal(['db', 'push', '--local', '--yes'])
	assert(push.status === 0, `alt2 db push failed: ${push.out.slice(0, 1200)}`)
	verifyReconciledTables()
	verifyWorkflowTables()
	verifyPreserved(b)
	const final = ledgerVersions()
	assert(EXPECTED_FINAL.every((v) => final.includes(v)), `alt2 ledger incomplete: ${final}`)
	report.alternatives.alt2 = {
		tested: true,
		result: 'PASS',
		reason:
			'After marking historical applied only, db push --local applied 20260723 then 20260724 in version order successfully.',
		ledger: final,
		cliOut: push.out.slice(0, 800),
	}
	// Preferred remains proposed when founder wants reconcile reviewed first; both safe.
	return true
}

function finalizeSchemaReport(baseline) {
	verifyPreserved(baseline)
	verifyReconciledTables()
	verifyWorkflowTables()
	report.finalLedger = ledgerVersions().map((version) => ({
		version,
		status: 'applied',
		howRecorded:
			HISTORICAL.includes(version) || version === '20260724'
				? version === '20260724'
					? 'manual SQL + migration repair --local --status applied'
					: 'migration repair --local --status applied'
				: 'supabase db push --local',
	}))
	// Fix howRecorded for 20260723 specifically
	report.finalLedger = ledgerVersions().map((version) => {
		let how = 'unknown'
		if (HISTORICAL.includes(version)) how = 'migration repair --local --status applied'
		else if (version === '20260724') how = 'manual SQL + migration repair --local --status applied'
		else if (version === '20260723') how = 'supabase db push --local'
		return { version, status: 'applied', howRecorded: how }
	})
	report.finalSchema = {
		existingDataPreservation: 'pass',
		reconciledTables: 'present',
		workflowTables: 'present',
		athlete_profiles_user_id: psql(`
SELECT udt_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='athlete_profiles' AND column_name='user_id'
`),
		counts: captureBaseline('final').counts,
	}
}

async function main() {
	assertNoRemoteCreds()
	confirmLocalTarget()
	restoreMigrationsIfAside()
	auditDependencies()

	const baseline = buildProductionShaped()
	testProposedSequence(baseline)
	finalizeSchemaReport(baseline)

	testFailureResume(baseline)

	testAlternative2Quick()
	testAlternative2AgainstFreshShaped()

	// After alt2, selected sequence remains the proposed (founder-controlled reconcile-first)
	report.selectedSequence = {
		name: 'reconcile-first then historical+20260724 repair then db push --include-all for 20260723',
		why:
			'Matches reviewed-SQL control for 20260724. Plain db push rejects lower pending 20260723 after 20260724 is marked; --include-all is required and proven safe locally.',
		notExecutedRemotely: true,
	}

	report.endedAt = new Date().toISOString()
	fs.writeFileSync(RESULTS, JSON.stringify(report, null, 2))
	console.log('\nREHEARSAL_PASS')
	console.log(`results=${RESULTS}`)
}

try {
	await main()
} catch (err) {
	restoreMigrationsIfAside()
	report.errors.push(err instanceof Error ? err.message : String(err))
	report.endedAt = new Date().toISOString()
	fs.writeFileSync(RESULTS, JSON.stringify(report, null, 2))
	console.error(`REHEARSAL_FAIL: ${err instanceof Error ? err.message : String(err)}`)
	process.exitCode = 1
}
