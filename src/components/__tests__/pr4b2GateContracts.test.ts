import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

/**
 * Source contracts proving login can be enabled independently of signup,
 * and that components do not independently inspect the master env flag.
 */
describe('PR-4B2 auth + workflow gate contracts', () => {
	it('components do not independently inspect VITE_WORKFLOW_CLOUD_PERSISTENCE', () => {
		for (const rel of [
			'src/components/OpportunityBoard.tsx',
			'src/components/Deals.tsx',
			'src/components/EventsPlanner.tsx',
		]) {
			const src = fs.readFileSync(path.join(root, rel), 'utf8')
			expect(src).not.toContain('VITE_WORKFLOW_CLOUD_PERSISTENCE')
			expect(src).not.toContain('isWorkflowCloudPersistenceEnabled')
			expect(src).toContain('useWorkflowDomainPersistence')
		}
	})

	it('hook centralizes eligibility (master + mode + claim)', () => {
		const hook = fs.readFileSync(path.join(root, 'src/hooks/useWorkflowDomainPersistence.ts'), 'utf8')
		expect(hook).toContain('evaluateWorkflowCloudEligibility')
		expect(hook).toContain('getWorkflowCloudPersistenceMode')
		expect(hook).toContain('isWorkflowCloudPersistenceEnabled')
		expect(hook).toContain('workflowCloudPersistenceCanary')
	})

	it('AuthContext uses mapSupabaseUserToCurrent (app_metadata claim)', () => {
		const auth = fs.readFileSync(path.join(root, 'src/context/AuthContext.tsx'), 'utf8')
		expect(auth).toContain('mapSupabaseUserToCurrent')
		expect(auth).not.toContain('user_metadata?.workflow_cloud_persistence_canary')
		expect(auth).not.toContain('updateUser')
	})
})
