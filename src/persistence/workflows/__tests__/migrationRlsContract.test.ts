import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const migrationPath = path.join(
	root,
	'supabase/migrations/20260723_nil_roster_workflow_cloud_persistence.sql'
)

describe('PR-4A workflow migration SQL/RLS static contract', () => {
	const sql = fs.readFileSync(migrationPath, 'utf8')
	const lower = sql.toLowerCase()

	it('creates all three workflow tables', () => {
		expect(lower).toContain('create table if not exists public.opportunities')
		expect(lower).toContain('create table if not exists public.deals')
		expect(lower).toContain('create table if not exists public.events')
	})

	it('enables RLS on all three tables', () => {
		expect(lower).toContain('alter table public.opportunities enable row level security')
		expect(lower).toContain('alter table public.deals enable row level security')
		expect(lower).toContain('alter table public.events enable row level security')
	})

	it('defines SELECT policies scoped to auth.uid() = user_id', () => {
		for (const table of ['opportunities', 'deals', 'events']) {
			expect(sql).toMatch(new RegExp(`${table}_select_own[\\s\\S]*?FOR SELECT[\\s\\S]*?auth\\.uid\\(\\) = user_id`, 'i'))
		}
	})

	it('defines INSERT policies scoped to auth.uid() = user_id', () => {
		for (const table of ['opportunities', 'deals', 'events']) {
			expect(sql).toMatch(new RegExp(`${table}_insert_own[\\s\\S]*?FOR INSERT[\\s\\S]*?auth\\.uid\\(\\) = user_id`, 'i'))
		}
	})

	it('defines UPDATE policies with USING and WITH CHECK', () => {
		for (const table of ['opportunities', 'deals', 'events']) {
			expect(sql).toMatch(
				new RegExp(
					`${table}_update_own[\\s\\S]*?FOR UPDATE[\\s\\S]*?USING \\(auth\\.uid\\(\\) = user_id\\)[\\s\\S]*?WITH CHECK \\(auth\\.uid\\(\\) = user_id\\)`,
					'i'
				)
			)
		}
	})

	it('defines DELETE policies scoped to auth.uid() = user_id', () => {
		for (const table of ['opportunities', 'deals', 'events']) {
			expect(sql).toMatch(new RegExp(`${table}_delete_own[\\s\\S]*?FOR DELETE[\\s\\S]*?auth\\.uid\\(\\) = user_id`, 'i'))
		}
	})

	it('enforces unique (user_id, client_id) and payload JSON object checks', () => {
		expect(lower).toContain('unique (user_id, client_id)')
		expect(lower).toContain("jsonb_typeof(payload) = 'object'")
		expect((lower.match(/unique \(user_id, client_id\)/g) || []).length).toBeGreaterThanOrEqual(3)
		expect((lower.match(/jsonb_typeof\(payload\) = 'object'/g) || []).length).toBeGreaterThanOrEqual(3)
	})

	it('adds useful user indexes', () => {
		expect(lower).toContain('idx_opportunities_user_id')
		expect(lower).toContain('idx_deals_user_id')
		expect(lower).toContain('idx_events_user_id')
	})

	it('does not grant anonymous or public policies', () => {
		expect(lower).not.toMatch(/to\s+anon\b/)
		expect(lower).not.toMatch(/to\s+public\b/)
		expect(lower).not.toContain('using (true)')
		expect(lower).not.toContain('with check (true)')
	})

	it('does not embed service-role keys or secrets', () => {
		expect(lower).not.toContain('service_role')
		expect(lower).not.toContain('service role')
		expect(sql).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/)
	})

	it('contains no destructive DROP/TRUNCATE of data tables', () => {
		expect(lower).not.toMatch(/\btruncate\b/)
		expect(lower).not.toMatch(/drop table\b/)
		// DROP POLICY / DROP TRIGGER are allowed for idempotent policy setup
		expect(lower).not.toMatch(/drop\s+table\s+if\s+exists\s+public\.(athlete_profiles|user_targets|businesses|user_businesses|profiles)/)
	})

	it('does not modify existing unrelated tables', () => {
		const alterMatches = [...sql.matchAll(/alter\s+table\s+public\.(\w+)/gi)].map((m) => m[1].toLowerCase())
		for (const table of alterMatches) {
			expect(['opportunities', 'deals', 'events']).toContain(table)
		}
	})

	it('uses workflow-specific updated_at function, not shared set_updated_at', () => {
		expect(lower).toContain('create or replace function public.set_workflow_updated_at()')
		expect(lower).toContain('execute function public.set_workflow_updated_at()')
		expect(lower).not.toMatch(/create\s+or\s+replace\s+function\s+public\.set_updated_at\s*\(/)
		expect(lower).not.toMatch(/execute\s+function\s+public\.set_updated_at\s*\(/)
	})

	it('documents payload privacy in SQL comments', () => {
		expect(lower).toContain('must remain private')
		expect(lower).toContain('financial')
	})
})
