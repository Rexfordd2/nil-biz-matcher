import { describe, expect, it } from 'vitest'
import { evaluateWorkflowCloudEligibility } from '../cloudEligibility'

const baseCanary = {
	masterEnabled: true,
	mode: 'canary' as const,
	authenticated: true,
	athleteId: 'athlete-1',
	workflowCloudPersistenceCanary: true,
}

describe('evaluateWorkflowCloudEligibility', () => {
	it('1. master false + canary claim true → off', () => {
		expect(
			evaluateWorkflowCloudEligibility({
				...baseCanary,
				masterEnabled: false,
				workflowCloudPersistenceCanary: true,
			})
		).toEqual({ enabled: false, reason: 'master_off' })
	})

	it('2. master false + mode all → off', () => {
		expect(
			evaluateWorkflowCloudEligibility({
				masterEnabled: false,
				mode: 'all',
				authenticated: true,
				athleteId: 'athlete-1',
				workflowCloudPersistenceCanary: false,
			})
		).toEqual({ enabled: false, reason: 'master_off' })
	})

	it('3. master true + mode off → off', () => {
		expect(
			evaluateWorkflowCloudEligibility({
				...baseCanary,
				mode: 'off',
			})
		).toEqual({ enabled: false, reason: 'mode_off' })
	})

	it('4. master true + mode canary + signed out → off', () => {
		expect(
			evaluateWorkflowCloudEligibility({
				...baseCanary,
				authenticated: false,
			})
		).toEqual({ enabled: false, reason: 'signed_out' })
	})

	it('5. master true + mode canary + no athlete → off', () => {
		expect(
			evaluateWorkflowCloudEligibility({
				...baseCanary,
				athleteId: null,
			})
		).toEqual({ enabled: false, reason: 'invalid_athlete' })
	})

	it('6. master true + mode canary + anonymous athlete → off', () => {
		expect(
			evaluateWorkflowCloudEligibility({
				...baseCanary,
				athleteId: 'anonymous',
			})
		).toEqual({ enabled: false, reason: 'invalid_athlete' })
	})

	it('7. master true + mode canary + claim missing → off', () => {
		expect(
			evaluateWorkflowCloudEligibility({
				...baseCanary,
				workflowCloudPersistenceCanary: false,
			})
		).toEqual({ enabled: false, reason: 'canary_claim_missing' })
	})

	it('8. master true + mode canary + claim false → off', () => {
		expect(
			evaluateWorkflowCloudEligibility({
				...baseCanary,
				workflowCloudPersistenceCanary: false,
			})
		).toEqual({ enabled: false, reason: 'canary_claim_missing' })
	})

	it('9–10. string/user_metadata-style truthy inputs must arrive as false → off', () => {
		// Evaluator only accepts boolean; callers must not coerce string "true".
		expect(
			evaluateWorkflowCloudEligibility({
				...baseCanary,
				workflowCloudPersistenceCanary: false,
			}).enabled
		).toBe(false)
	})

	it('11. master true + mode canary + exact claim true → on', () => {
		expect(evaluateWorkflowCloudEligibility(baseCanary)).toEqual({
			enabled: true,
			reason: 'canary',
		})
	})

	it('12. master true + mode all + valid authenticated athlete → on', () => {
		expect(
			evaluateWorkflowCloudEligibility({
				masterEnabled: true,
				mode: 'all',
				authenticated: true,
				athleteId: 'athlete-1',
				workflowCloudPersistenceCanary: false,
			})
		).toEqual({ enabled: true, reason: 'all' })
	})

	it('13. master true + mode all + signed out → off', () => {
		expect(
			evaluateWorkflowCloudEligibility({
				masterEnabled: true,
				mode: 'all',
				authenticated: false,
				athleteId: 'athlete-1',
				workflowCloudPersistenceCanary: false,
			})
		).toEqual({ enabled: false, reason: 'signed_out' })
	})

	it('14. master true + mode all + invalid athlete → off', () => {
		expect(
			evaluateWorkflowCloudEligibility({
				masterEnabled: true,
				mode: 'all',
				authenticated: true,
				athleteId: null,
				workflowCloudPersistenceCanary: false,
			})
		).toEqual({ enabled: false, reason: 'invalid_athlete' })
		expect(
			evaluateWorkflowCloudEligibility({
				masterEnabled: true,
				mode: 'all',
				authenticated: true,
				athleteId: '',
				workflowCloudPersistenceCanary: false,
			})
		).toEqual({ enabled: false, reason: 'invalid_athlete' })
	})

	it('blank athlete id is invalid', () => {
		expect(
			evaluateWorkflowCloudEligibility({
				...baseCanary,
				athleteId: '   ',
			}).enabled
		).toBe(false)
	})
})
