import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

describe('Dashboard recruiting source-of-truth protections', () => {
	it('does not import or call the legacy recruiting pipeline', () => {
		const dashboard = fs.readFileSync(path.join(root, 'components/Dashboard.tsx'), 'utf8')
		expect(dashboard).not.toMatch(/recruiting\/pipeline/)
		expect(dashboard).not.toMatch(/getTargetsFor/)
		expect(dashboard).not.toMatch(/loadRecruitingTargets/)
		expect(dashboard).not.toMatch(/athleteLedger:recruitingTargets/)
		expect(dashboard).not.toMatch(/RecruitingFinder/)
		expect(dashboard).toMatch(/useRecruitingBoardSummary/)
	})

	it('keeps legacy pipeline storage helpers available for migration', () => {
		const pipeline = fs.readFileSync(path.join(root, 'recruiting/pipeline.ts'), 'utf8')
		expect(pipeline).toContain('athleteLedger:recruitingTargets:')
		expect(pipeline).toContain('export function getTargetsFor')
		expect(pipeline).toContain('export function upsertTarget')
		expect(pipeline).toContain('export function upsertByProgram')
	})

	it('routes summary through the shared Supabase board service', () => {
		const hook = fs.readFileSync(path.join(root, 'hooks/useRecruitingBoardSummary.ts'), 'utf8')
		const service = fs.readFileSync(path.join(root, 'services/recruitingBoardSummary.ts'), 'utf8')
		expect(hook).toContain('getRecruitingBoardSummary')
		expect(service).toContain("from('user_targets')")
		expect(service).toContain("select('id, status')")
		expect(service).toContain('.eq(')
		expect(service).toContain('user_id')
	})
})
