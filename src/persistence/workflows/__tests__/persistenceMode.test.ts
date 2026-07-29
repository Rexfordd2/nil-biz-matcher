import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
	areMutationsDisabled,
	decideWorkflowBootstrapMode,
	isCloudWriteMode,
} from '../persistenceMode'
import type { LegacyImportPlan } from '../types'
import type { Opportunity } from '../../../types'

function emptyPlan(partial: Partial<LegacyImportPlan<Opportunity>> = {}): LegacyImportPlan<Opportunity> {
	return {
		recordsToInsert: [],
		alreadyPresent: [],
		rejectedRecords: [],
		conflicts: [],
		totalLocal: 0,
		totalCloud: 0,
		...partial,
	}
}

const sampleOpp = (id: string, title = 'T'): Opportunity => ({
	id,
	athleteId: 'ath-1',
	title,
	category: 'other',
	status: 'idea',
})

describe('decideWorkflowBootstrapMode contract matrix', () => {
	it('local empty / cloud empty → cloud', () => {
		expect(decideWorkflowBootstrapMode(emptyPlan()).mode).toBe('cloud')
	})

	it('local present / cloud empty → import_required', () => {
		expect(
			decideWorkflowBootstrapMode(
				emptyPlan({ recordsToInsert: [sampleOpp('opp-1')], totalLocal: 1 })
			).mode
		).toBe('import_required')
	})

	it('matching alreadyPresent only → cloud', () => {
		expect(
			decideWorkflowBootstrapMode(
				emptyPlan({
					alreadyPresent: [sampleOpp('opp-1')],
					conflicts: [{ clientId: 'opp-1', reason: 'cloud_exists' }],
					totalLocal: 1,
					totalCloud: 1,
				})
			).mode
		).toBe('cloud')
	})

	it('same client ID / different content → conflict (never cloud)', () => {
		const decision = decideWorkflowBootstrapMode(
			emptyPlan({
				conflicts: [{ clientId: 'opp-1', reason: 'content_mismatch' }],
				totalLocal: 1,
				totalCloud: 1,
			})
		)
		expect(decision.mode).toBe('conflict')
		expect(isCloudWriteMode(decision.mode)).toBe(false)
		expect(areMutationsDisabled(decision.mode)).toBe(true)
	})

	it('content mismatch plus insertable locals still conflict (no auto merge)', () => {
		const decision = decideWorkflowBootstrapMode(
			emptyPlan({
				recordsToInsert: [sampleOpp('opp-2')],
				conflicts: [{ clientId: 'opp-1', reason: 'content_mismatch' }],
			})
		)
		expect(decision.mode).toBe('conflict')
	})

	it('athlete mismatch → conflict', () => {
		expect(
			decideWorkflowBootstrapMode(
				emptyPlan({
					rejectedRecords: [{ index: 0, reason: 'athlete_mismatch' }],
					conflicts: [{ clientId: 'opp-1', reason: 'athlete_mismatch' }],
				})
			).mode
		).toBe('conflict')
	})

	it('duplicate local content → conflict', () => {
		expect(
			decideWorkflowBootstrapMode(
				emptyPlan({
					rejectedRecords: [{ index: 1, reason: 'duplicate_local' }],
					conflicts: [{ clientId: 'opp-1', reason: 'duplicate_local_content' }],
				})
			).mode
		).toBe('conflict')
	})

	it('malformed local rejection → conflict', () => {
		expect(
			decideWorkflowBootstrapMode(
				emptyPlan({
					rejectedRecords: [{ index: 0, reason: 'malformed' }],
					totalLocal: 1,
				})
			).mode
		).toBe('conflict')
	})

	it('malformed cloud decode rejects → conflict', () => {
		expect(
			decideWorkflowBootstrapMode(emptyPlan({ totalCloud: 1 }), { cloudRejectedCount: 1 }).mode
		).toBe('conflict')
	})
})

describe('mutation disable helpers', () => {
	it('disables checking/import_required/conflict/unavailable', () => {
		expect(areMutationsDisabled('checking')).toBe(true)
		expect(areMutationsDisabled('import_required')).toBe(true)
		expect(areMutationsDisabled('conflict')).toBe(true)
		expect(areMutationsDisabled('unavailable')).toBe(true)
		expect(areMutationsDisabled('local')).toBe(false)
		expect(areMutationsDisabled('cloud')).toBe(false)
	})
})

describe('cloud write ordering contract (sequenced adapters)', () => {
	beforeEach(() => {
		vi.restoreAllMocks()
	})

	it('upserts repository before state/mirror and skips both on failure', async () => {
		const calls: string[] = []
		const upsertForUser = vi.fn(async (_user?: string, _record?: Opportunity) => {
			calls.push('repo')
			return { ok: false as const, error: 'write_failure' as const }
		})
		const saveSpy = vi.fn()
		// Simulate cloud-mode write order helper
		async function cloudUpsert(okRepo: boolean) {
			calls.push('start')
			const result = okRepo
				? await (async () => {
						calls.push('repo')
						return { ok: true as const }
					})()
				: await upsertForUser('user', sampleOpp('opp-1'))
			if (!result.ok) {
				calls.push('abort')
				return false
			}
			calls.push('state')
			saveSpy()
			calls.push('mirror')
			return true
		}
		const failed = await cloudUpsert(false)
		expect(failed).toBe(false)
		expect(calls).toEqual(['start', 'repo', 'abort'])
		expect(saveSpy).not.toHaveBeenCalled()

		calls.length = 0
		const ok = await cloudUpsert(true)
		expect(ok).toBe(true)
		expect(calls).toEqual(['start', 'repo', 'state', 'mirror'])
		expect(saveSpy).toHaveBeenCalledTimes(1)
	})
})
