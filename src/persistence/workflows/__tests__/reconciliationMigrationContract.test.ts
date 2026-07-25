import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const reconciliationPath = path.join(
	root,
	'supabase/migrations/20260724_reconcile_nil_roster_production_schema.sql'
)
const workflowPath = path.join(
	root,
	'supabase/migrations/20260723_nil_roster_workflow_cloud_persistence.sql'
)
const fixturePath = path.join(
	root,
	'supabase/tests/fixtures/production_shaped_baseline.sql'
)

describe('production reconciliation migration static contract', () => {
	const sql = fs.readFileSync(reconciliationPath, 'utf8')
	const lower = sql.toLowerCase()

	it('creates proven-missing application tables', () => {
		for (const table of [
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
			expect(lower).toContain(`create table if not exists public.${table}`)
		}
	})

	it('adds org_contacts notes and source_url safely', () => {
		expect(lower).toContain('add column if not exists notes text')
		expect(lower).toContain('add column if not exists source_url text')
	})

	it('does not convert athlete_profiles.user_id or drop tables', () => {
		expect(lower).not.toMatch(/alter\s+table\s+public\.athlete_profiles[\s\S]{0,200}user_id[\s\S]{0,80}uuid/)
		expect(lower).not.toMatch(/(^|\n)\s*truncate\s+/)
		expect(lower).not.toMatch(/(^|\n)\s*drop\s+table\b/)
		expect(lower).not.toMatch(/(^|\n)\s*delete\s+from\b/)
	})

	it('does not replace shared set_updated_at', () => {
		expect(lower).not.toMatch(/create\s+or\s+replace\s+function\s+public\.set_updated_at\s*\(/)
		expect(lower).toContain('create or replace function public.set_workflow_updated_at()')
	})

	it('enables RLS and authenticated ownership policies on user-owned tables', () => {
		for (const table of [
			'athlete_profile',
			'onboarding_progress',
			'orgs',
			'org_contacts',
			'user_targets',
			'recruiting_targets',
			'user_data',
		]) {
			expect(lower).toContain(`alter table public.${table} enable row level security`)
		}
		expect(lower).toMatch(/to authenticated[\s\S]*auth\.uid\(\)/)
		expect(lower).not.toMatch(/for all\s+to authenticated/)
	})

	it('keeps search_cache service_role-only and denies anon workflow tables', () => {
		expect(lower).toContain('to service_role')
		expect(lower).not.toContain('create table if not exists public.opportunities')
		expect(lower).not.toContain('create table if not exists public.deals')
		expect(lower).not.toContain('create table if not exists public.events')
	})

	it('includes explicit grants for authenticated ownership tables', () => {
		expect(lower).toContain('grant select, insert, update, delete on public.user_targets to authenticated')
		expect(lower).toContain('grant select, insert, update, delete on public.org_contacts to authenticated')
	})

	it('production-shaped fixture models text athlete_profiles and empty ledger condition', () => {
		const fixture = fs.readFileSync(fixturePath, 'utf8').toLowerCase()
		expect(fixture).toContain('create table if not exists public.athlete_profiles')
		expect(fixture).toContain('user_id text primary key')
		expect(fixture).toContain('create table if not exists public.waitlist')
		expect(fixture).toContain('create table if not exists public.saved_businesses')
		expect(fixture).toContain('create table if not exists public.businesses')
		expect(fixture).not.toContain('create table if not exists public.orgs')
		expect(fixture).not.toContain('create table if not exists public.opportunities')
	})

	it('workflow migration remains additive and uses workflow updated-at', () => {
		const workflow = fs.readFileSync(workflowPath, 'utf8').toLowerCase()
		expect(workflow).toContain('set_workflow_updated_at')
		expect(workflow).not.toMatch(/create\s+or\s+replace\s+function\s+public\.set_updated_at\s*\(/)
		expect(workflow).not.toMatch(/\btruncate\b/)
		expect(workflow).not.toMatch(/drop\s+table\b/)
	})
})

describe('protected localStorage keys remain unchanged by reconciliation package', () => {
	it('still references opps.store in OpportunityBoard', () => {
		const board = fs.readFileSync(path.join(root, 'src/components/OpportunityBoard.tsx'), 'utf8')
		expect(board).toContain("'opps.store'")
	})
})
