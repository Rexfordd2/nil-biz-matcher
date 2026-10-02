#!/usr/bin/env node
/**
 * Build a disposable local database from the real supabase/migrations files,
 * then apply them with `supabase db push --include-all` twice.
 * Does not edit already-applied migration files and does not contact a remote project.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const DB_NAME = 'nil_recruiting_receiver_dev'
export const POSTGRES_PASSWORD = 'dev-only-postgres'
export const RECEIVER_PASSWORD = 'nil-receiver-dev-only'
export const ADMIN_URL = `postgresql://postgres:${POSTGRES_PASSWORD}@127.0.0.1:5432/${DB_NAME}`
export const RECEIVER_URL = `postgresql://nil_recruiting_receiver:${RECEIVER_PASSWORD}@127.0.0.1:5432/${DB_NAME}`

function assertLocalOnly() {
	if (process.env.SUPABASE_DB_PASSWORD) {
		throw new Error('SUPABASE_DB_PASSWORD must be unset')
	}
	for (const value of [process.env.DATABASE_URL, process.env.NIL_RECRUITING_RECEIVER_DATABASE_URL]) {
		if (value && !/localhost|127\.0\.0\.1/.test(value)) {
			throw new Error('database URLs must be local or unset')
		}
	}
	if (/prod/i.test(DB_NAME)) throw new Error('refusing a production-like database name')
}

function run(command, args, env = {}) {
	const result = spawnSync(command, args, {
		cwd: ROOT,
		encoding: 'utf8',
		env: { ...process.env, ...env },
	})
	return {
		status: result.status ?? 1,
		stdout: result.stdout || '',
		stderr: result.stderr || '',
	}
}

function requireOk(result, label) {
	if (result.status !== 0) {
		throw new Error(`${label} failed (${result.status})\n${result.stdout}\n${result.stderr}`)
	}
	return result
}

function psql(database, sql) {
	return requireOk(
		run(
			'psql',
			['-h', '127.0.0.1', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-c', sql],
			{ PGPASSWORD: POSTGRES_PASSWORD }
		),
		`psql ${database}`
	)
}

function psqlFile(database, file) {
	return requireOk(
		run(
			'psql',
			['-h', '127.0.0.1', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-f', file],
			{ PGPASSWORD: POSTGRES_PASSWORD }
		),
		`psql -f ${file}`
	)
}

export function applyFreshDatabase() {
	assertLocalOnly()
	requireOk(
		run('sudo', [
			'-u',
			'postgres',
			'psql',
			'-d',
			'postgres',
			'-v',
			'ON_ERROR_STOP=1',
			'-c',
			`ALTER USER postgres PASSWORD '${POSTGRES_PASSWORD}'`,
		]),
		'set local postgres password'
	)

	psql(
		'postgres',
		`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid()`
	)
	requireOk(
		run(
			'psql',
			[
				'-h',
				'127.0.0.1',
				'-U',
				'postgres',
				'-d',
				'postgres',
				'-v',
				'ON_ERROR_STOP=1',
				'-c',
				`DROP DATABASE IF EXISTS ${DB_NAME}`,
			],
			{ PGPASSWORD: POSTGRES_PASSWORD }
		),
		'drop database'
	)
	requireOk(
		run(
			'psql',
			[
				'-h',
				'127.0.0.1',
				'-U',
				'postgres',
				'-d',
				'postgres',
				'-v',
				'ON_ERROR_STOP=1',
				'-c',
				`CREATE DATABASE ${DB_NAME}`,
			],
			{ PGPASSWORD: POSTGRES_PASSWORD }
		),
		'create database'
	)

	psqlFile(DB_NAME, path.join(ROOT, 'scripts/recruiting-receiver/disposable-auth-bootstrap.sql'))

	const pushArgs = ['db', 'push', '--db-url', ADMIN_URL, '--include-all', '--yes']
	const firstPush = requireOk(run('supabase', pushArgs), 'first supabase db push')
	const secondPush = requireOk(run('supabase', pushArgs), 'second supabase db push')
	if (!secondPush.stdout.includes('"upToDate":true') || !secondPush.stdout.includes('"migrations":[]')) {
		throw new Error(`second supabase db push was not a no-op\n${secondPush.stdout}\n${secondPush.stderr}`)
	}
	const replay = psqlFile(
		DB_NAME,
		path.join(ROOT, 'supabase/migrations/20261001_nil_recruiting_houze_receiver.sql')
	)

	psql(
		DB_NAME,
		`ALTER ROLE nil_recruiting_receiver LOGIN PASSWORD '${RECEIVER_PASSWORD}';
		 GRANT CONNECT ON DATABASE ${DB_NAME} TO nil_recruiting_receiver;
		 GRANT USAGE ON SCHEMA public TO nil_recruiting_receiver;`
	)

	const versions = psql(
		DB_NAME,
		`SELECT version FROM supabase_migrations.schema_migrations ORDER BY version`
	).stdout

	return {
		firstPush: `${firstPush.stdout}\n${firstPush.stderr}`.trim(),
		secondPush: `${secondPush.stdout}\n${secondPush.stderr}`.trim(),
		replayStatus: replay.status,
		versions: versions.trim(),
	}
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	const result = applyFreshDatabase()
	console.log(JSON.stringify(result, null, 2))
}
