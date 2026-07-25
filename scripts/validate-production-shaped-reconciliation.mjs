/**
 * Disposable production-shaped fixture validation.
 * Spins up ephemeral Postgres in Docker, applies fixture + reconciliation SQL,
 * asserts text user_id preserved and missing tables created.
 * Refuses remote hosts. Does not print secrets.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURE = path.join(ROOT, 'supabase/tests/fixtures/production_shaped_baseline.sql')
const RECONCILE = path.join(
	ROOT,
	'supabase/migrations/20260724_reconcile_nil_roster_production_schema.sql'
)
const CONTAINER = 'nil-roster-prod-shaped-fixture'
const IMAGE = 'postgres:16-alpine'

function run(cmd, args, opts = {}) {
	const res = spawnSync(cmd, args, {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
		...opts,
	})
	if (res.status !== 0) {
		const err = (res.stderr || res.stdout || '').trim()
		throw new Error(`${cmd} ${args.join(' ')} failed: ${err.slice(0, 500)}`)
	}
	return (res.stdout || '').trim()
}

function dockerAvailable() {
	const res = spawnSync('docker', ['version'], { encoding: 'utf8', stdio: 'ignore' })
	return res.status === 0
}

function waitReady() {
	for (let i = 0; i < 40; i++) {
		const res = spawnSync(
			'docker',
			['exec', CONTAINER, 'pg_isready', '-U', 'postgres'],
			{ encoding: 'utf8', stdio: 'ignore' }
		)
		if (res.status === 0) return
		Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)
	}
	throw new Error('fixture postgres not ready')
}

function psql(sqlOrFile, isFile = false) {
	const args = [
		'exec',
		'-i',
		CONTAINER,
		'psql',
		'-U',
		'postgres',
		'-v',
		'ON_ERROR_STOP=1',
		...(isFile ? ['-f', sqlOrFile] : ['-t', '-A', '-c', sqlOrFile]),
	]
	if (isFile) {
		// copy file into container then execute
		const base = path.basename(sqlOrFile)
		run('docker', ['cp', sqlOrFile, `${CONTAINER}:/tmp/${base}`])
		return run('docker', [
			'exec',
			CONTAINER,
			'psql',
			'-U',
			'postgres',
			'-v',
			'ON_ERROR_STOP=1',
			'-f',
			`/tmp/${base}`,
		])
	}
	return run('docker', args)
}

function cleanup() {
	spawnSync('docker', ['rm', '-f', CONTAINER], { stdio: 'ignore' })
}

function main() {
	if (!fs.existsSync(FIXTURE) || !fs.existsSync(RECONCILE)) {
		throw new Error('fixture or reconciliation SQL missing')
	}
	if (!dockerAvailable()) throw new Error('docker required for disposable fixture')

	cleanup()
	run('docker', [
		'run',
		'-d',
		'--name',
		CONTAINER,
		'-e',
		'POSTGRES_HOST_AUTH_METHOD=trust',
		IMAGE,
	])
	waitReady()

  // Minimal auth stubs used by FKs in reconciliation (fixture already creates auth.users)
  psql(FIXTURE, true)

  const beforeType = psql(
    `SELECT udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name='athlete_profiles' AND column_name='user_id'`
  )
  if (beforeType !== 'text') {
    throw new Error(`expected athlete_profiles.user_id text before reconcile, got ${beforeType}`)
  }

  psql(RECONCILE, true)

	const afterType = psql(
		`SELECT udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name='athlete_profiles' AND column_name='user_id'`
	)
	if (afterType !== 'text') {
		throw new Error(`athlete_profiles.user_id mutated to ${afterType}`)
	}

	const required = [
		'athlete_profile',
		'onboarding_progress',
		'orgs',
		'org_contacts',
		'user_targets',
		'recruiting_targets',
		'anon_sessions',
		'user_data',
		'search_cache',
	]
	for (const table of required) {
		const exists = psql(`SELECT to_regclass('public.${table}') IS NOT NULL`)
		if (exists !== 't') throw new Error(`missing table after reconcile: ${table}`)
	}

	const notes = psql(
		`SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='org_contacts' AND column_name IN ('notes','source_url')`
	)
	if (notes !== '2') throw new Error('org_contacts notes/source_url missing')

	const shared = psql(
		`SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='set_updated_at'`
	)
	const workflow = psql(
		`SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='set_workflow_updated_at'`
	)
	if (shared !== '1' || workflow !== '1') {
		throw new Error(`function counts shared=${shared} workflow=${workflow}`)
	}

	const dependents = psql(
		`SELECT COUNT(*) FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE NOT t.tgisinternal AND n.nspname='public' AND p.proname='set_updated_at'`
	)
	if (Number(dependents) < 2) {
		throw new Error(`expected shared set_updated_at dependents >= 2, got ${dependents}`)
	}

	console.log('PRODUCTION_SHAPED_RECONCILIATION_PASS')
}

try {
	main()
} catch (err) {
	console.error(
		`PRODUCTION_SHAPED_RECONCILIATION_FAIL: ${err instanceof Error ? err.message : String(err)}`
	)
	process.exitCode = 1
} finally {
	cleanup()
}
