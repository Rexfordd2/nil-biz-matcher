import { describe, expect, it } from 'vitest'
import {
	aggregateRecruitingBoardSummary,
	RECRUITING_BOARD_STATUSES,
} from '../boardSummary'

describe('aggregateRecruitingBoardSummary', () => {
	it('returns zeroes for empty rows', () => {
		const summary = aggregateRecruitingBoardSummary([])
		expect(summary.total).toBe(0)
		expect(summary.normalizedToContact).toBe(0)
		for (const status of RECRUITING_BOARD_STATUSES) {
			expect(summary.byStatus[status]).toBe(0)
		}
	})

	it('handles null/undefined input as empty', () => {
		expect(aggregateRecruitingBoardSummary(null).total).toBe(0)
		expect(aggregateRecruitingBoardSummary(undefined).total).toBe(0)
	})

	it('counts each known board status exactly once', () => {
		const rows = RECRUITING_BOARD_STATUSES.map((status) => ({ status }))
		const summary = aggregateRecruitingBoardSummary(rows)
		expect(summary.total).toBe(RECRUITING_BOARD_STATUSES.length)
		expect(summary.normalizedToContact).toBe(0)
		for (const status of RECRUITING_BOARD_STATUSES) {
			expect(summary.byStatus[status]).toBe(1)
		}
	})

	it('aggregates mixed statuses without double-counting', () => {
		const rows = [
			{ status: 'To Contact' },
			{ status: 'To Contact' },
			{ status: 'Contacted' },
			{ status: 'In Progress' },
			{ status: 'Offer/Visit' },
			{ status: 'Closed' },
			{ status: 'Closed' },
		]
		const summary = aggregateRecruitingBoardSummary(rows)
		expect(summary.total).toBe(7)
		expect(summary.byStatus['To Contact']).toBe(2)
		expect(summary.byStatus.Contacted).toBe(1)
		expect(summary.byStatus['In Progress']).toBe(1)
		expect(summary.byStatus['Offer/Visit']).toBe(1)
		expect(summary.byStatus.Closed).toBe(2)
		const sumColumns = Object.values(summary.byStatus).reduce((a, b) => a + b, 0)
		expect(sumColumns).toBe(summary.total)
	})

	it('maps null and empty status to To Contact', () => {
		const summary = aggregateRecruitingBoardSummary([
			{ status: null },
			{ status: undefined },
			{ status: '' },
			{ status: '   ' },
		])
		expect(summary.total).toBe(4)
		expect(summary.byStatus['To Contact']).toBe(4)
		expect(summary.normalizedToContact).toBe(4)
	})

	it('maps unknown status to To Contact without inventing columns', () => {
		const summary = aggregateRecruitingBoardSummary([
			{ status: 'archived' },
			{ status: 'pursue' },
			{ status: 'In Progress' },
		])
		expect(summary.total).toBe(3)
		expect(summary.byStatus['To Contact']).toBe(2)
		expect(summary.byStatus['In Progress']).toBe(1)
		expect(summary.normalizedToContact).toBe(2)
		expect(Object.keys(summary.byStatus).sort()).toEqual([...RECRUITING_BOARD_STATUSES].sort())
	})

	it('is deterministic for the same input order', () => {
		const rows = [
			{ status: 'Contacted' },
			{ status: 'Closed' },
			{ status: null },
			{ status: 'weird' },
		]
		expect(aggregateRecruitingBoardSummary(rows)).toEqual(aggregateRecruitingBoardSummary(rows))
	})
})
