import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DealLogEntry, EventPlan, Opportunity } from '../../../types'

const fromMock = vi.fn()

vi.mock('../../../lib/supabaseClient', () => ({
	supabaseEnvConfigured: true,
	supabase: {
		from: (...args: unknown[]) => fromMock(...args),
	},
}))

type Chain = {
	select: ReturnType<typeof vi.fn>
	eq: ReturnType<typeof vi.fn>
	order: ReturnType<typeof vi.fn>
	upsert: ReturnType<typeof vi.fn>
	delete: ReturnType<typeof vi.fn>
	maybeSingle: ReturnType<typeof vi.fn>
}

function createChain(final: { data: unknown; error: unknown }): Chain {
	const chain: Chain = {
		select: vi.fn(),
		eq: vi.fn(),
		order: vi.fn(),
		upsert: vi.fn(),
		delete: vi.fn(),
		maybeSingle: vi.fn(),
	}
	chain.select.mockReturnValue(chain)
	chain.eq.mockReturnValue(chain)
	chain.delete.mockReturnValue(chain)
	chain.order.mockResolvedValue(final)
	chain.maybeSingle.mockResolvedValue(final)
	chain.upsert.mockResolvedValue(final)
	// Allow awaiting a terminal eq() for delete paths
	chain.eq.mockImplementation(() => {
		const next = Object.assign(Promise.resolve(final), chain)
		return next
	})
	return chain
}

const sampleOpp: Opportunity = {
	id: 'opp-1',
	athleteId: 'ath-1',
	title: 'T',
	category: 'other',
	status: 'idea',
}

const sampleDeal: DealLogEntry = {
	id: 'deal-1',
	athleteId: 'ath-1',
	title: 'T',
	dealType: 'other',
	brandName: 'B',
	status: 'idea',
}

const sampleEvent: EventPlan = {
	id: 'evt-1',
	athleteId: 'ath-1',
	type: 'other',
	name: 'N',
	date: '2026-01-01',
	location: 'L',
}

describe('workflow repositories', () => {
	beforeEach(() => {
		vi.resetModules()
		fromMock.mockReset()
	})

	it('does not query when userId is empty (opportunities)', async () => {
		const { listOpportunitiesForUser, getOpportunityByClientId } = await import(
			'../opportunityRepository'
		)
		await listOpportunitiesForUser('')
		await getOpportunityByClientId('', 'opp-1')
		expect(fromMock).not.toHaveBeenCalled()
	})

	it('list filters by user_id and get filters user_id + client_id', async () => {
		const listChain = createChain({ data: [], error: null })
		const getChain = createChain({ data: null, error: null })
		fromMock
			.mockReturnValueOnce(listChain)
			.mockReturnValueOnce(getChain)

		const { listOpportunitiesForUser, getOpportunityByClientId } = await import(
			'../opportunityRepository'
		)
		await listOpportunitiesForUser('user-1')
		expect(fromMock).toHaveBeenCalledWith('opportunities')
		expect(listChain.select).toHaveBeenCalledWith('*')
		expect(listChain.eq).toHaveBeenCalledWith('user_id', 'user-1')

		await getOpportunityByClientId('user-1', 'opp-1')
		expect(getChain.eq).toHaveBeenCalledWith('user_id', 'user-1')
		expect(getChain.eq).toHaveBeenCalledWith('client_id', 'opp-1')
	})

	it('upsert forces supplied user_id and uses user_id/client_id conflict key', async () => {
		const chain = createChain({ data: null, error: null })
		fromMock.mockReturnValue(chain)
		const { upsertOpportunityForUser } = await import('../opportunityRepository')
		const result = await upsertOpportunityForUser('user-1', sampleOpp)
		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.record).toEqual(sampleOpp)
		expect(chain.upsert).toHaveBeenCalled()
		const [row, opts] = chain.upsert.mock.calls[0]
		expect(row.user_id).toBe('user-1')
		expect(row.client_id).toBe('opp-1')
		expect(opts).toEqual({ onConflict: 'user_id,client_id' })
	})

	it('upsert returns canonical encode→decode record for mirror safety', async () => {
		const chain = createChain({ data: null, error: null })
		fromMock.mockReturnValue(chain)
		const { upsertDealForUser } = await import('../dealRepository')
		const input: DealLogEntry = {
			...sampleDeal,
			valueEstimate: 0,
			reportedToSchool: false,
			reportedToCollective: false,
			deliverables: [],
			payments: [],
			documents: [],
			licensing: { usesSchoolMarks: false },
		}
		const result = await upsertDealForUser('user-1', input)
		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.record.valueEstimate).toBe(0)
		expect(result.record.reportedToSchool).toBe(false)
		expect(result.record.reportedToCollective).toBe(false)
		expect(result.record.deliverables).toEqual([])
		expect(result.record.payments).toEqual([])
		expect(result.record.documents).toEqual([])
		expect(result.record.licensing).toEqual({ usesSchoolMarks: false })
	})

	it('delete filters both user_id and client_id', async () => {
		const chain = createChain({ data: null, error: null })
		fromMock.mockReturnValue(chain)
		const { deleteOpportunityForUser } = await import('../opportunityRepository')
		await deleteOpportunityForUser('user-1', 'opp-1')
		expect(chain.delete).toHaveBeenCalled()
		expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1')
		expect(chain.eq).toHaveBeenCalledWith('client_id', 'opp-1')
	})

	it('normalizes raw backend errors without exposing details', async () => {
		const chain = createChain({
			data: null,
			error: { message: 'permission denied for table opportunities', code: '42501' },
		})
		fromMock.mockReturnValue(chain)
		const { listOpportunitiesForUser } = await import('../opportunityRepository')
		const result = await listOpportunitiesForUser('user-1')
		expect(result).toEqual({ ok: false, error: 'unavailable' })
		expect(JSON.stringify(result)).not.toContain('permission denied')
		expect(JSON.stringify(result)).not.toContain('42501')
	})

	it('malformed row does not crash full list; reports rejectedCount', async () => {
		const goodRow = {
			user_id: 'user-1',
			client_id: 'opp-1',
			athlete_id: 'ath-1',
			title: 'T',
			status: 'idea',
			category: 'other',
			target_brand_name: null,
			expected_start_date: null,
			expected_end_date: null,
			linked_deal_client_id: null,
			payload: { ...sampleOpp },
			source: 'nil_roster_app',
		}
		const chain = createChain({
			data: [goodRow, { client_id: 'bad', payload: null }],
			error: null,
		})
		fromMock.mockReturnValue(chain)
		const { listOpportunitiesForUser } = await import('../opportunityRepository')
		const result = await listOpportunitiesForUser('user-1')
		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.records).toHaveLength(1)
		expect(result.rejectedCount).toBe(1)
	})

	it('insertMissingLegacyRecords does not overwrite existing client ids', async () => {
		// Select client_id only — includes IDs even when payload would fail decode.
		const idChain = createChain({ data: [{ client_id: 'opp-1' }, { client_id: 'opp-corrupt' }], error: null })
		const upsertChain = createChain({ data: null, error: null })
		fromMock.mockReturnValueOnce(idChain).mockReturnValueOnce(upsertChain)

		const { insertMissingLegacyOpportunities } = await import('../opportunityRepository')
		const result = await insertMissingLegacyOpportunities('user-1', [
			sampleOpp,
			{ ...sampleOpp, id: 'opp-2', title: 'New' },
			{ ...sampleOpp, id: 'opp-corrupt', title: 'Would overwrite corrupt' },
		])
		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.skippedExisting).toBe(2)
		expect(result.skippedInvalid).toBe(0)
		expect(result.inserted).toBe(1)
		expect(idChain.select).toHaveBeenCalledWith('client_id')
		const [rows, opts] = upsertChain.upsert.mock.calls[0]
		expect(Array.isArray(rows)).toBe(true)
		expect(rows).toHaveLength(1)
		expect(rows[0].client_id).toBe('opp-2')
		expect(opts).toEqual({ onConflict: 'user_id,client_id', ignoreDuplicates: true })
	})

	it('insertMissing reports write_failure without claiming inserts', async () => {
		const idChain = createChain({ data: [], error: null })
		const upsertChain = createChain({
			data: null,
			error: { message: 'disk full secret deal payload', code: 'XX000' },
		})
		fromMock.mockReturnValueOnce(idChain).mockReturnValueOnce(upsertChain)
		const { insertMissingLegacyOpportunities } = await import('../opportunityRepository')
		const result = await insertMissingLegacyOpportunities('user-1', [sampleOpp])
		expect(result).toEqual({ ok: false, error: 'write_failure' })
		expect(JSON.stringify(result)).not.toContain('disk full')
		expect(JSON.stringify(result)).not.toContain('secret')
	})

	it('deal repository scopes queries and forces user_id on upsert', async () => {
		const chain = createChain({ data: [], error: null })
		fromMock.mockReturnValue(chain)
		const repo = await import('../dealRepository')
		await repo.listDealsForUser('user-1')
		expect(fromMock).toHaveBeenCalledWith('deals')
		expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1')

		await repo.upsertDealForUser('user-1', sampleDeal)
		const [row, opts] = chain.upsert.mock.calls[0]
		expect(row.user_id).toBe('user-1')
		expect(opts.onConflict).toBe('user_id,client_id')

		await repo.deleteDealForUser('user-1', 'deal-1')
		expect(chain.eq).toHaveBeenCalledWith('client_id', 'deal-1')
	})

	it('event repository empty user does not query; get scopes both ids', async () => {
		const { listEventsForUser, getEventByClientId } = await import('../eventRepository')
		await listEventsForUser('')
		expect(fromMock).not.toHaveBeenCalled()

		const chain = createChain({ data: null, error: null })
		fromMock.mockReturnValue(chain)
		await getEventByClientId('user-1', 'evt-1')
		expect(fromMock).toHaveBeenCalledWith('events')
		expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1')
		expect(chain.eq).toHaveBeenCalledWith('client_id', 'evt-1')
	})

	it('does not log private payloads (no console calls during upsert)', async () => {
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		const chain = createChain({ data: null, error: null })
		fromMock.mockReturnValue(chain)
		const { upsertDealForUser } = await import('../dealRepository')
		await upsertDealForUser('user-1', {
			...sampleDeal,
			payments: [{ date: '2026-01-01', amount: 999, currency: 'USD' }],
			complianceNotes: 'secret',
		})
		expect(logSpy).not.toHaveBeenCalled()
		expect(warnSpy).not.toHaveBeenCalled()
		expect(errorSpy).not.toHaveBeenCalled()
		logSpy.mockRestore()
		warnSpy.mockRestore()
		errorSpy.mockRestore()
	})
})
