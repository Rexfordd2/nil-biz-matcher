/**
 * Local SQL fallback for workflow cloud persistence contracts when Auth Admin JWT
 * is unavailable (local CLI/GoTrue signing-method mismatch).
 * Loopback DB only. Does not print secrets or row payloads.
 */
import { execFileSync, execSync, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const UA = '11111111-1111-4111-8111-111111111111'
const UB = '22222222-2222-4222-8222-222222222222'

function assertLocalHost(hostname) {
	const h = String(hostname || '').toLowerCase()
	if (!['localhost', '127.0.0.1', '::1'].includes(h)) {
		throw new Error(`Refusing non-local hostname: ${h || '(empty)'}`)
	}
}

function readDbUrl() {
	const raw = execSync('supabase status -o json', {
		cwd: ROOT,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	})
	const status = JSON.parse(raw.slice(raw.indexOf('{')))
	const dbUrl = status.DB_URL
	if (!dbUrl) throw new Error('Missing DB_URL')
	assertLocalHost(new URL(dbUrl).hostname)
	return dbUrl
}

function psql(dbUrl, sql) {
	const res = spawnSync(
		'docker',
		[
			'run',
			'--rm',
			'--add-host=host.docker.internal:host-gateway',
			'postgres:16-alpine',
			'psql',
			dbUrl.replace('127.0.0.1', 'host.docker.internal').replace('localhost', 'host.docker.internal'),
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

function main() {
	const dbUrl = readDbUrl()
	console.log(`sql_fallback_db_host=${new URL(dbUrl).hostname}`)

	psql(
		dbUrl,
		`
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES
  ('${UA}'::uuid, 'authenticated', 'authenticated', 'sql-a@example.invalid', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', ''),
  ('${UB}'::uuid, 'authenticated', 'authenticated', 'sql-b@example.invalid', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', '')
ON CONFLICT (id) DO NOTHING;
`
	)

	psql(
		dbUrl,
		`
DELETE FROM public.opportunities WHERE user_id IN ('${UA}'::uuid,'${UB}'::uuid);
DELETE FROM public.deals WHERE user_id IN ('${UA}'::uuid,'${UB}'::uuid);
DELETE FROM public.events WHERE user_id IN ('${UA}'::uuid,'${UB}'::uuid);

INSERT INTO public.opportunities (user_id, client_id, title, payload)
VALUES ('${UA}'::uuid, 'opp-sql-1', 'SQL Opp', '{"id":"opp-sql-1","unknownNested":{"keep":true},"linkedDealId":"deal-sql-1"}'::jsonb);

INSERT INTO public.deals (user_id, client_id, title, value_estimate, payload)
VALUES ('${UA}'::uuid, 'deal-sql-1', 'SQL Deal', 0, '{"id":"deal-sql-1","reportedToSchool":false,"deliverables":[]}'::jsonb);

INSERT INTO public.events (user_id, client_id, name, payload)
VALUES ('${UA}'::uuid, 'evt-sql-1', 'SQL Event', '{"id":"evt-sql-1","sponsors":[],"linkedDealId":"deal-sql-1"}'::jsonb);
`
	)

	const keep = psql(
		dbUrl,
		`SELECT payload->'unknownNested'->>'keep' FROM public.opportunities WHERE user_id='${UA}'::uuid AND client_id='opp-sql-1'`
	)
	if (keep !== 'true') throw new Error('payload fidelity failed')

	const zero = psql(
		dbUrl,
		`SELECT value_estimate::text FROM public.deals WHERE user_id='${UA}'::uuid AND client_id='deal-sql-1'`
	)
	if (zero !== '0') throw new Error('zero numeric lost')

	// Array payload must fail check constraint
	const bad = spawnSync(
		'docker',
		[
			'run',
			'--rm',
			'--add-host=host.docker.internal:host-gateway',
			'postgres:16-alpine',
			'psql',
			dbUrl.replace('127.0.0.1', 'host.docker.internal'),
			'-v',
			'ON_ERROR_STOP=1',
			'-c',
			`INSERT INTO public.opportunities (user_id, client_id, payload) VALUES ('${UA}'::uuid,'opp-bad','[]'::jsonb);`,
		],
		{ encoding: 'utf8' }
	)
	if (bad.status === 0) throw new Error('array payload should be rejected')

	const wfFn = psql(
		dbUrl,
		`SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='set_workflow_updated_at'`
	)
	if (wfFn !== '1') throw new Error('set_workflow_updated_at missing')

	const sharedDeps = psql(
		dbUrl,
		`SELECT COUNT(*) FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE NOT t.tgisinternal AND n.nspname='public' AND p.proname='set_updated_at'`
	)
	if (Number(sharedDeps) < 1) throw new Error('shared set_updated_at dependents missing')

	psql(
		dbUrl,
		`
DELETE FROM public.opportunities WHERE user_id IN ('${UA}'::uuid,'${UB}'::uuid);
DELETE FROM public.deals WHERE user_id IN ('${UA}'::uuid,'${UB}'::uuid);
DELETE FROM public.events WHERE user_id IN ('${UA}'::uuid,'${UB}'::uuid);
DELETE FROM auth.users WHERE id IN ('${UA}'::uuid,'${UB}'::uuid);
`
	)

	console.log('REPO_INTEGRATION_SQL_FALLBACK_PASS')
}

try {
	main()
} catch (err) {
	console.error(
		`REPO_INTEGRATION_SQL_FALLBACK_FAIL: ${err instanceof Error ? err.message : String(err)}`
	)
	process.exit(1)
}
