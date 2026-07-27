import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { decideWorkflowBootstrapMode } from '../persistenceMode'
import { planOpportunityLegacyImport } from '../importPlanners'
import type { Opportunity } from '../../../types'

/**
 * Integration-style planner + decision tests for conflict visibility:
 * same-ID/different-content must not select cloud and must not imply local replacement.
 */
describe('same-ID different-content conflict semantics', () => {
	const local: Opportunity = {
		id: 'opp-shared',
		athleteId: 'ath-1',
		title: 'Local title',
		category: 'other',
		status: 'idea',
	}
	const cloud: Opportunity = {
		id: 'opp-shared',
		athleteId: 'ath-1',
		title: 'Cloud title',
		category: 'other',
		status: 'pitched',
	}

	it('plans content_mismatch and decides conflict', () => {
		const plan = planOpportunityLegacyImport([local], {
			activeAthleteId: 'ath-1',
			existingCloudClientIds: ['opp-shared'],
			existingCloudByClientId: new Map([['opp-shared', cloud]]),
		})
		expect(plan.recordsToInsert).toEqual([])
		expect(plan.conflicts).toContainEqual({
			clientId: 'opp-shared',
			reason: 'content_mismatch',
		})
		const decision = decideWorkflowBootstrapMode(plan)
		expect(decision.mode).toBe('conflict')
	})

	it('does not treat mismatch as alreadyPresent merge candidate', () => {
		const plan = planOpportunityLegacyImport([local], {
			activeAthleteId: 'ath-1',
			existingCloudClientIds: ['opp-shared'],
			existingCloudByClientId: new Map([['opp-shared', cloud]]),
		})
		expect(plan.alreadyPresent).toEqual([])
	})
})

describe('unavailable / cloud write failure save guards', () => {
	beforeEach(() => {
		vi.restoreAllMocks()
	})
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('documents that failed cloud writes must not call save', async () => {
		const save = vi.fn()
		const upsert = vi.fn(async () => ({ ok: false as const, error: 'write_failure' as const }))
		async function guardedCloudWrite() {
			const result = await upsert()
			if (!result.ok) return { saved: false }
			save()
			return { saved: true }
		}
		const out = await guardedCloudWrite()
		expect(out.saved).toBe(false)
		expect(save).not.toHaveBeenCalled()
	})
})
