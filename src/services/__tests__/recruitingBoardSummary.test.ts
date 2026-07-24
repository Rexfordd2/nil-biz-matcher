import { beforeEach, describe, expect, it, vi } from 'vitest'
import { aggregateRecruitingBoardSummary } from '../../recruiting/boardSummary'

const fromMock = vi.fn()
const selectMock = vi.fn()
const eqMock = vi.fn()

vi.mock('../../lib/supabaseClient', () => ({
	supabaseEnvConfigured: true,
	supabase: {
		from: (...args: unknown[]) => fromMock(...args),
	},
}))

describe('getRecruitingBoardSummary', () => {
	beforeEach(() => {
		vi.resetModules()
		fromMock.mockReset()
		selectMock.mockReset()
		eqMock.mockReset()
		eqMock.mockResolvedValue({ data: [], error: null })
		selectMock.mockReturnValue({ eq: eqMock })
		fromMock.mockReturnValue({ select: selectMock })
	})

	it('does not query user_targets when userId is missing', async () => {
		const { getRecruitingBoardSummary } = await import('../recruitingBoardSummary')
		const result = await getRecruitingBoardSummary(null)
		expect(fromMock).not.toHaveBeenCalled()
		expect(result).toEqual({ ok: true, summary: aggregateRecruitingBoardSummary([]) })
	})

	it('does not query user_targets when userId is empty', async () => {
		const { getRecruitingBoardSummary } = await import('../recruitingBoardSummary')
		const result = await getRecruitingBoardSummary('')
		expect(fromMock).not.toHaveBeenCalled()
		expect(result.ok).toBe(true)
	})

	it('queries user_targets scoped to user id and aggregates statuses', async () => {
		eqMock.mockResolvedValue({
			data: [
				{ id: '1', status: 'To Contact' },
				{ id: '2', status: 'In Progress' },
				{ id: '3', status: 'In Progress' },
			],
			error: null,
		})
		const { getRecruitingBoardSummary } = await import('../recruitingBoardSummary')
		const result = await getRecruitingBoardSummary('user-123')
		expect(fromMock).toHaveBeenCalledWith('user_targets')
		expect(selectMock).toHaveBeenCalledWith('id, status')
		expect(eqMock).toHaveBeenCalledWith('user_id', 'user-123')
		expect(result.ok).toBe(true)
		if (result.ok) {
			expect(result.summary.total).toBe(3)
			expect(result.summary.byStatus['In Progress']).toBe(2)
			expect(result.summary.byStatus['To Contact']).toBe(1)
		}
	})

	it('returns unavailable without exposing raw backend error details', async () => {
		eqMock.mockResolvedValue({
			data: null,
			error: { message: 'permission denied for table user_targets', code: '42501' },
		})
		const { getRecruitingBoardSummary } = await import('../recruitingBoardSummary')
		const result = await getRecruitingBoardSummary('user-123')
		expect(result).toEqual({ ok: false, error: 'unavailable' })
		expect(JSON.stringify(result)).not.toContain('permission denied')
		expect(JSON.stringify(result)).not.toContain('42501')
	})
})