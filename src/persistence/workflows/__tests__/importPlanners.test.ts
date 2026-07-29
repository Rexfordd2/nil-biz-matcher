import { describe, expect, it } from 'vitest'
import type { DealLogEntry, EventPlan, Opportunity } from '../../../types'
import {
	flattenAthleteKeyedStore,
	planDealLegacyImport,
	planEventLegacyImport,
	planOpportunityLegacyImport,
} from '../importPlanners'

function opp(partial: Partial<Opportunity> & Pick<Opportunity, 'id'>): Opportunity {
	return {
		athleteId: 'ath-active',
		title: 'Opp',
		category: 'other',
		status: 'idea',
		...partial,
	}
}

function deal(partial: Partial<DealLogEntry> & Pick<DealLogEntry, 'id'>): DealLogEntry {
	return {
		athleteId: 'ath-active',
		title: 'Deal',
		dealType: 'other',
		brandName: 'Brand',
		status: 'idea',
		...partial,
	}
}

function evt(partial: Partial<EventPlan> & Pick<EventPlan, 'id'>): EventPlan {
	return {
		athleteId: 'ath-active',
		type: 'other',
		name: 'Event',
		date: '2026-01-01',
		location: 'Here',
		...partial,
	}
}

describe('planOpportunityLegacyImport', () => {
	it('handles empty local and cloud', () => {
		const plan = planOpportunityLegacyImport([], {
			existingCloudClientIds: [],
			activeAthleteId: 'ath-active',
		})
		expect(plan).toEqual({
			recordsToInsert: [],
			alreadyPresent: [],
			rejectedRecords: [],
			conflicts: [],
			totalLocal: 0,
			totalCloud: 0,
		})
	})

	it('plans local-only inserts', () => {
		const local = [opp({ id: 'opp-1' }), opp({ id: 'opp-2', title: 'Two' })]
		const plan = planOpportunityLegacyImport(local, {
			existingCloudClientIds: [],
			activeAthleteId: 'ath-active',
		})
		expect(plan.recordsToInsert.map((r) => r.id)).toEqual(['opp-1', 'opp-2'])
		expect(plan.alreadyPresent).toEqual([])
		expect(plan.totalLocal).toBe(2)
	})

	it('marks already imported when cloud client id exists (cloud wins)', () => {
		const local = [opp({ id: 'opp-1', title: 'Local version' })]
		const plan = planOpportunityLegacyImport(local, {
			existingCloudClientIds: ['opp-1'],
			activeAthleteId: 'ath-active',
		})
		expect(plan.recordsToInsert).toEqual([])
		expect(plan.alreadyPresent).toHaveLength(1)
		expect(plan.conflicts).toContainEqual({ clientId: 'opp-1', reason: 'cloud_exists' })
	})

	it('reports and deduplicates duplicate local ids deterministically', () => {
		const local = [
			opp({ id: 'opp-dup', title: 'First' }),
			opp({ id: 'opp-dup', title: 'Second' }),
		]
		const plan = planOpportunityLegacyImport(local, {
			existingCloudClientIds: [],
			activeAthleteId: 'ath-active',
		})
		expect(plan.recordsToInsert).toHaveLength(1)
		expect(plan.recordsToInsert[0].title).toBe('First')
		expect(plan.rejectedRecords).toContainEqual({ index: 1, reason: 'duplicate_local' })
		expect(plan.conflicts.some((c) => c.reason === 'duplicate_local_content')).toBe(true)
	})

	it('reports malformed records without silent discard', () => {
		const plan = planOpportunityLegacyImport([null, { title: 'no athlete' }, opp({ id: 'ok' })], {
			existingCloudClientIds: [],
			activeAthleteId: 'ath-active',
		})
		expect(plan.rejectedRecords.filter((r) => r.reason === 'malformed')).toHaveLength(2)
		expect(plan.recordsToInsert).toHaveLength(1)
	})

	it('classifies athleteId mismatch as conflict requiring review', () => {
		const local = [opp({ id: 'opp-x', athleteId: 'ath-other' })]
		const plan = planOpportunityLegacyImport(local, {
			existingCloudClientIds: [],
			activeAthleteId: 'ath-active',
		})
		expect(plan.recordsToInsert).toEqual([])
		expect(plan.rejectedRecords).toContainEqual({ index: 0, reason: 'athlete_mismatch' })
		expect(plan.conflicts).toContainEqual({ clientId: 'opp-x', reason: 'athlete_mismatch' })
	})

	it('is deterministic and idempotent for the same inputs', () => {
		const local = [opp({ id: 'opp-1' }), { bad: true }, opp({ id: 'opp-2', athleteId: 'ath-other' })]
		const opts = { existingCloudClientIds: ['opp-cloud'], activeAthleteId: 'ath-active' }
		const a = planOpportunityLegacyImport(local, opts)
		const b = planOpportunityLegacyImport(local, opts)
		expect(a).toEqual(b)
		expect(planOpportunityLegacyImport(local, opts)).toEqual(a)
	})

	it('does not mutate original local records (deep equality before/after)', () => {
		const local = [
			opp({ id: 'opp-1', notes: 'private note', linkedDealId: 'deal-1' }),
			{ nested: { secret: 'keep' }, athleteId: 'ath-active', title: 'x', category: 'other', status: 'idea', id: 'opp-2' },
		]
		const before = structuredClone(local)
		planOpportunityLegacyImport(local, {
			existingCloudClientIds: ['opp-cloud'],
			activeAthleteId: 'ath-active',
		})
		expect(local).toEqual(before)
	})

	it('distinguishes exact already-present from same-ID different-content cloud conflicts', () => {
		const local = [
			opp({ id: 'opp-same', title: 'Local A' }),
			opp({ id: 'opp-diff', title: 'Local B' }),
		]
		const plan = planOpportunityLegacyImport(local, {
			existingCloudClientIds: ['opp-same', 'opp-diff'],
			existingCloudByClientId: {
				'opp-same': opp({ id: 'opp-same', title: 'Local A' }),
				'opp-diff': opp({ id: 'opp-diff', title: 'Cloud different' }),
			},
			activeAthleteId: 'ath-active',
		})
		expect(plan.alreadyPresent.map((r) => r.id)).toEqual(['opp-same'])
		expect(plan.conflicts).toContainEqual({ clientId: 'opp-diff', reason: 'content_mismatch' })
		expect(plan.recordsToInsert).toEqual([])
	})
})

describe('planDealLegacyImport', () => {
	it('covers empty, local-only, already imported, duplicates, malformed, athlete mismatch', () => {
		expect(
			planDealLegacyImport([], { existingCloudClientIds: [], activeAthleteId: 'ath-active' }).totalLocal
		).toBe(0)

		const localOnly = planDealLegacyImport([deal({ id: 'deal-1' })], {
			existingCloudClientIds: [],
			activeAthleteId: 'ath-active',
		})
		expect(localOnly.recordsToInsert).toHaveLength(1)

		const imported = planDealLegacyImport([deal({ id: 'deal-1' })], {
			existingCloudClientIds: ['deal-1'],
			activeAthleteId: 'ath-active',
		})
		expect(imported.alreadyPresent).toHaveLength(1)

		const dup = planDealLegacyImport([deal({ id: 'd' }), deal({ id: 'd', title: 'Other' })], {
			existingCloudClientIds: [],
			activeAthleteId: 'ath-active',
		})
		expect(dup.recordsToInsert).toHaveLength(1)
		expect(dup.rejectedRecords.some((r) => r.reason === 'duplicate_local')).toBe(true)

		const malformed = planDealLegacyImport([42], {
			existingCloudClientIds: [],
			activeAthleteId: 'ath-active',
		})
		expect(malformed.rejectedRecords[0].reason).toBe('malformed')

		const mismatch = planDealLegacyImport([deal({ id: 'd2', athleteId: 'other' })], {
			existingCloudClientIds: [],
			activeAthleteId: 'ath-active',
		})
		expect(mismatch.conflicts[0].reason).toBe('athlete_mismatch')
	})

	it('is idempotent', () => {
		const local = [deal({ id: 'deal-1' }), deal({ id: 'deal-1' })]
		const opts = { existingCloudClientIds: new Set(['x']), activeAthleteId: 'ath-active' }
		expect(planDealLegacyImport(local, opts)).toEqual(planDealLegacyImport(local, opts))
	})
})

describe('planEventLegacyImport', () => {
	it('covers empty, local-only, already imported, duplicates, malformed, athlete match/mismatch', () => {
		expect(
			planEventLegacyImport([], { existingCloudClientIds: [], activeAthleteId: 'ath-active' }).totalCloud
		).toBe(0)

		const match = planEventLegacyImport([evt({ id: 'evt-1' })], {
			existingCloudClientIds: [],
			activeAthleteId: 'ath-active',
		})
		expect(match.recordsToInsert).toHaveLength(1)

		const cloud = planEventLegacyImport([evt({ id: 'evt-1' })], {
			existingCloudClientIds: ['evt-1'],
			activeAthleteId: 'ath-active',
		})
		expect(cloud.alreadyPresent).toHaveLength(1)

		const dup = planEventLegacyImport([evt({ id: 'e' }), evt({ id: 'e' })], {
			existingCloudClientIds: [],
			activeAthleteId: 'ath-active',
		})
		expect(dup.rejectedRecords.some((r) => r.reason === 'duplicate_local')).toBe(true)

		expect(
			planEventLegacyImport(['bad'], { existingCloudClientIds: [], activeAthleteId: 'ath-active' })
				.rejectedRecords[0].reason
		).toBe('malformed')

		const mismatch = planEventLegacyImport([evt({ id: 'e2', athleteId: 'other' })], {
			existingCloudClientIds: [],
			activeAthleteId: 'ath-active',
		})
		expect(mismatch.conflicts[0].reason).toBe('athlete_mismatch')
	})

	it('same client id with different contents: first wins, second rejected as duplicate', () => {
		const plan = planEventLegacyImport(
			[evt({ id: 'same', name: 'A' }), evt({ id: 'same', name: 'B' })],
			{ existingCloudClientIds: [], activeAthleteId: 'ath-active' }
		)
		expect(plan.recordsToInsert[0].name).toBe('A')
		expect(plan.rejectedRecords).toHaveLength(1)
	})
})

describe('flattenAthleteKeyedStore', () => {
	it('flattens opps/deals/events store shape without mutating', () => {
		const store = {
			'ath-1': [opp({ id: 'o1', athleteId: 'ath-1' })],
			'ath-2': [opp({ id: 'o2', athleteId: 'ath-2' })],
		}
		const snap = JSON.stringify(store)
		const flat = flattenAthleteKeyedStore<Opportunity>(store)
		expect(flat.map((o) => o.id)).toEqual(['o1', 'o2'])
		expect(JSON.stringify(store)).toBe(snap)
		expect(flattenAthleteKeyedStore(null)).toEqual([])
	})
})
