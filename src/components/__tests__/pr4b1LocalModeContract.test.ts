import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

/**
 * Flag-false / local-mode regression: components still use adapters keyed to legacy stores
 * and do not hard-require cloud UI when the gate returns null for mode=local.
 */
describe('PR-4B1 local-mode component contracts', () => {
	const files = [
		'src/components/OpportunityBoard.tsx',
		'src/components/Deals.tsx',
		'src/components/EventsPlanner.tsx',
	]

	it('all three domains still wire workflow adapters and mutation gates', () => {
		for (const rel of files) {
			const src = fs.readFileSync(path.join(root, rel), 'utf8')
			expect(src).toContain('useWorkflowDomainPersistence')
			expect(src).toContain('mutationsDisabled')
			expect(src).toContain('WorkflowImportGate')
			expect(src).toContain('onKeepUsingDevice')
			expect(src).not.toContain('Continue with cloud')
			expect(src).not.toContain('onContinueWithCloud')
		}
	})

	it('gate has no force-overwrite / use-cloud actions', () => {
		const gate = fs.readFileSync(
			path.join(root, 'src/components/workflows/WorkflowImportGate.tsx'),
			'utf8'
		)
		expect(gate).toContain('Records need review')
		expect(gate).toContain('Cloud saving is temporarily unavailable')
		expect(gate).toContain('Save your existing records to NIL Roster')
		expect(gate).toContain('Keep using this device for now')
		expect(gate).toContain('Saved to NIL Roster')
		expect(gate).toContain('Checking secure storage')
		expect(gate).not.toMatch(/Force overwrite|Use cloud|Continue with cloud/i)
	})

	it('hook blocks mutations and preserves write order comments/contract', () => {
		const hook = fs.readFileSync(path.join(root, 'src/hooks/useWorkflowDomainPersistence.ts'), 'utf8')
		expect(hook).toContain('areMutationsDisabled')
		expect(hook).toContain('sessionStayLocal')
		expect(hook).toContain('insertMissing')
		expect(hook).toContain('Could not save to secure storage')
		// Cloud write must not save on failure
		expect(hook).toMatch(/if \(!result\.ok\)[\s\S]{0,200}return false/)
	})
})
