import { describe, expect, it } from 'vitest'
import type { DealLogEntry, EventPlan, Opportunity } from '../../../types'
import {
	decodeDeal,
	decodeEvent,
	decodeOpportunity,
	dealClientId,
	encodeDeal,
	encodeEvent,
	encodeOpportunity,
	eventClientId,
	opportunityClientId,
	deriveLegacyClientId,
} from '../index'

const USER = 'user-1111-2222-3333'

function completeOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
	return {
		id: 'opp-1',
		athleteId: 'ath-1',
		title: 'Local coffee partnership',
		category: 'local_brand_deal',
		status: 'pitched',
		description: 'Seasonal campaign',
		targetBrandName: 'Bean Co',
		linkedDealId: 'deal-9',
		expectedStartDate: '2026-08-01',
		expectedEndDate: '2026-09-01',
		notes: 'Follow up Friday',
		...overrides,
	}
}

function completeDeal(overrides: Partial<DealLogEntry> = {}): DealLogEntry {
	return {
		id: 'deal-1',
		athleteId: 'ath-1',
		businessId: 'biz-1',
		title: 'Bean Co deal',
		dealType: 'brand_sponsorship',
		brandName: 'Bean Co',
		status: 'agreed',
		valueEstimate: 1500,
		currency: 'USD',
		startDate: '2026-08-01',
		endDate: '2026-12-01',
		deliverables: ['2 posts', '1 appearance'],
		exclusivityNotes: 'No rival coffee',
		licensing: { usesSchoolMarks: true, notes: 'Need approval' },
		reportedToSchool: true,
		reportedToCollective: false,
		complianceNotes: 'Form filed',
		collective: {
			name: 'Local Collective',
			contactName: 'Sam',
			contactEmail: 'sam@example.com',
			notes: 'Private',
		},
		documents: ['https://example.com/contract.pdf'],
		payments: [
			{ date: '2026-08-15', amount: 500, currency: 'USD', method: 'check', notes: 'Deposit' },
		],
		...overrides,
	}
}

function completeEvent(overrides: Partial<EventPlan> = {}): EventPlan {
	return {
		id: 'evt-1',
		athleteId: 'ath-1',
		type: 'camp_clinic',
		name: 'Summer camp',
		date: '2026-07-20',
		location: 'Main Gym',
		hostOrganization: 'Boosters',
		expectedAttendees: 40,
		sponsors: ['Bean Co', 'City Sports'],
		runOfShowUrl: 'https://example.com/run',
		waiversUrl: 'https://example.com/waiver',
		notes: 'Bring balls',
		linkedDealId: 'deal-1',
		...overrides,
	}
}

describe('opportunityCodec', () => {
	it('round-trips a complete active record', () => {
		const record = completeOpportunity()
		const encoded = encodeOpportunity(USER, record)
		expect(encoded.ok).toBe(true)
		if (!encoded.ok) return
		expect(encoded.value.user_id).toBe(USER)
		expect(encoded.value.client_id).toBe('opp-1')
		expect(encoded.value.linked_deal_client_id).toBe('deal-9')
		expect(encoded.value.target_brand_name).toBe('Bean Co')
		const decoded = decodeOpportunity(encoded.value)
		expect(decoded.ok).toBe(true)
		if (!decoded.ok) return
		expect(decoded.value).toEqual(record)
	})

	it('round-trips a minimal valid record without inventing optional empties', () => {
		const record = completeOpportunity({
			description: undefined,
			targetBrandName: undefined,
			linkedDealId: undefined,
			expectedStartDate: undefined,
			expectedEndDate: undefined,
			notes: undefined,
		})
		delete (record as Partial<Opportunity>).description
		delete (record as Partial<Opportunity>).targetBrandName
		delete (record as Partial<Opportunity>).linkedDealId
		delete (record as Partial<Opportunity>).expectedStartDate
		delete (record as Partial<Opportunity>).expectedEndDate
		delete (record as Partial<Opportunity>).notes

		const encoded = encodeOpportunity(USER, record)
		expect(encoded.ok).toBe(true)
		if (!encoded.ok) return
		expect(encoded.value.target_brand_name).toBeNull()
		expect(encoded.value.linked_deal_client_id).toBeNull()
		const decoded = decodeOpportunity(encoded.value)
		expect(decoded.ok).toBe(true)
		if (!decoded.ok) return
		expect(decoded.value.description).toBeUndefined()
		expect(decoded.value.targetBrandName).toBeUndefined()
		expect(decoded.value.linkedDealId).toBeUndefined()
	})

	it('preserves unknown future payload fields', () => {
		const record = completeOpportunity()
		const encoded = encodeOpportunity(USER, record)
		expect(encoded.ok).toBe(true)
		if (!encoded.ok) return
		encoded.value.payload.futureField = { nested: true }
		const decoded = decodeOpportunity(encoded.value)
		expect(decoded.ok).toBe(true)
		if (!decoded.ok) return
		expect((decoded.value as Opportunity & { futureField?: unknown }).futureField).toEqual({
			nested: true,
		})
	})

	it('returns controlled decode failure for invalid payload', () => {
		expect(decodeOpportunity(null).ok).toBe(false)
		expect(decodeOpportunity({ client_id: 'x', payload: [] }).ok).toBe(false)
		expect(decodeOpportunity({ client_id: 'x', payload: 'nope' }).ok).toBe(false)
	})

	it('uses stable client id and never accepts user id from payload', () => {
		const poisoned = completeOpportunity()
		;(poisoned as Opportunity & { userId?: string }).userId = 'attacker'
		const encoded = encodeOpportunity(USER, poisoned)
		expect(encoded.ok).toBe(true)
		if (!encoded.ok) return
		expect(encoded.value.user_id).toBe(USER)
		expect(encoded.value.payload.userId).toBeUndefined()
		expect(opportunityClientId(poisoned)).toBe('opp-1')
	})

	it('derives deterministic legacy client id when id is missing', () => {
		const withoutId = {
			athleteId: 'ath-1',
			title: 'Untitled',
			category: 'other',
			status: 'idea',
		}
		const a = opportunityClientId(withoutId)
		const b = opportunityClientId({ ...withoutId })
		expect(a).toBe(b)
		expect(a.startsWith('legacy-opp-')).toBe(true)
		expect(a).toBe(deriveLegacyClientId('opp', {
			athleteId: 'ath-1',
			title: 'Untitled',
			category: 'other',
			status: 'idea',
			targetBrandName: null,
			linkedDealId: null,
			expectedStartDate: null,
			expectedEndDate: null,
			description: null,
			notes: null,
		}))
	})

	it('preserves exact status, category, and linkedDealId', () => {
		const record = completeOpportunity({
			status: 'in_discussion',
			category: 'merch_drop',
			linkedDealId: 'deal-linked',
		})
		const encoded = encodeOpportunity(USER, record)
		expect(encoded.ok).toBe(true)
		if (!encoded.ok) return
		expect(encoded.value.status).toBe('in_discussion')
		expect(encoded.value.category).toBe('merch_drop')
		expect(encoded.value.linked_deal_client_id).toBe('deal-linked')
		const decoded = decodeOpportunity(encoded.value)
		expect(decoded.ok).toBe(true)
		if (!decoded.ok) return
		expect(decoded.value.status).toBe('in_discussion')
		expect(decoded.value.category).toBe('merch_drop')
		expect(decoded.value.linkedDealId).toBe('deal-linked')
	})

	it('does not mutate the original record during encode', () => {
		const record = completeOpportunity()
		const snapshot = JSON.stringify(record)
		encodeOpportunity(USER, record)
		expect(JSON.stringify(record)).toBe(snapshot)
	})

	it('preserves unknown fields across decode → encode → decode', () => {
		const record = completeOpportunity()
		const encoded = encodeOpportunity(USER, record)
		expect(encoded.ok).toBe(true)
		if (!encoded.ok) return
		encoded.value.payload.unknownNested = { keep: true, n: 0 }
		const once = decodeOpportunity(encoded.value)
		expect(once.ok).toBe(true)
		if (!once.ok) return
		const again = encodeOpportunity(USER, once.value)
		expect(again.ok).toBe(true)
		if (!again.ok) return
		expect(again.value.payload.unknownNested).toEqual({ keep: true, n: 0 })
		const twice = decodeOpportunity(again.value)
		expect(twice.ok).toBe(true)
		if (!twice.ok) return
		expect((twice.value as Opportunity & { unknownNested?: unknown }).unknownNested).toEqual({
			keep: true,
			n: 0,
		})
	})

	it('produces different fallback IDs for minimally different content', () => {
		const a = { athleteId: 'ath-1', title: 'A', category: 'other', status: 'idea' }
		const b = { athleteId: 'ath-1', title: 'B', category: 'other', status: 'idea' }
		expect(opportunityClientId(a)).not.toBe(opportunityClientId(b))
	})
})

describe('dealCodec', () => {
	it('round-trips a complete active record including nested fields', () => {
		const record = completeDeal()
		const encoded = encodeDeal(USER, record)
		expect(encoded.ok).toBe(true)
		if (!encoded.ok) return
		expect(encoded.value.brand_name).toBe('Bean Co')
		expect(encoded.value.deal_type).toBe('brand_sponsorship')
		expect(encoded.value.value_estimate).toBe(1500)
		const decoded = decodeDeal(encoded.value)
		expect(decoded.ok).toBe(true)
		if (!decoded.ok) return
		expect(decoded.value).toEqual(record)
	})

	it('round-trips minimal deal without inventing payments/documents', () => {
		const record: DealLogEntry = {
			id: 'deal-min',
			athleteId: 'ath-1',
			title: '',
			dealType: 'other',
			brandName: '',
			status: 'idea',
		}
		const encoded = encodeDeal(USER, record)
		expect(encoded.ok).toBe(true)
		if (!encoded.ok) return
		expect(encoded.value.value_estimate).toBeNull()
		const decoded = decodeDeal(encoded.value)
		expect(decoded.ok).toBe(true)
		if (!decoded.ok) return
		expect(decoded.value.payments).toBeUndefined()
		expect(decoded.value.documents).toBeUndefined()
		expect(decoded.value.deliverables).toBeUndefined()
	})

	it('preserves unknown payload fields and exact status/type', () => {
		const record = completeDeal({ status: 'in_discussion', dealType: 'merch_ecommerce' })
		const encoded = encodeDeal(USER, record)
		expect(encoded.ok).toBe(true)
		if (!encoded.ok) return
		encoded.value.payload.extraMeta = 'keep-me'
		const decoded = decodeDeal(encoded.value)
		expect(decoded.ok).toBe(true)
		if (!decoded.ok) return
		expect(decoded.value.status).toBe('in_discussion')
		expect(decoded.value.dealType).toBe('merch_ecommerce')
		expect((decoded.value as DealLogEntry & { extraMeta?: string }).extraMeta).toBe('keep-me')
	})

	it('fails controlled on invalid rows and ignores payload user id', () => {
		expect(decodeDeal({ client_id: 'd', payload: null }).ok).toBe(false)
		const poisoned = completeDeal()
		;(poisoned as DealLogEntry & { user_id?: string }).user_id = 'attacker'
		const encoded = encodeDeal(USER, poisoned)
		expect(encoded.ok).toBe(true)
		if (!encoded.ok) return
		expect(encoded.value.user_id).toBe(USER)
		expect(encoded.value.payload.user_id).toBeUndefined()
	})

	it('derives stable legacy client id without id', () => {
		const raw = {
			athleteId: 'ath-1',
			title: 'T',
			dealType: 'other',
			brandName: 'B',
			status: 'idea',
		}
		expect(dealClientId(raw)).toBe(dealClientId({ ...raw }))
	})

	it('preserves zero valueEstimate, false booleans, and empty nested arrays', () => {
		const record = completeDeal({
			valueEstimate: 0,
			reportedToSchool: false,
			reportedToCollective: false,
			deliverables: [],
			documents: [],
			payments: [],
			licensing: { usesSchoolMarks: false },
		})
		const encoded = encodeDeal(USER, record)
		expect(encoded.ok).toBe(true)
		if (!encoded.ok) return
		expect(encoded.value.value_estimate).toBe(0)
		expect(encoded.value.payload.valueEstimate).toBe(0)
		expect(encoded.value.payload.reportedToSchool).toBe(false)
		const decoded = decodeDeal(encoded.value)
		expect(decoded.ok).toBe(true)
		if (!decoded.ok) return
		expect(decoded.value.valueEstimate).toBe(0)
		expect(decoded.value.reportedToSchool).toBe(false)
		expect(decoded.value.reportedToCollective).toBe(false)
		expect(decoded.value.deliverables).toEqual([])
		expect(decoded.value.documents).toEqual([])
		expect(decoded.value.payments).toEqual([])
		expect(decoded.value.licensing).toEqual({ usesSchoolMarks: false })
	})

	it('does not coerce undefined valueEstimate to zero', () => {
		const record: DealLogEntry = {
			id: 'deal-noz',
			athleteId: 'ath-1',
			title: 'T',
			dealType: 'other',
			brandName: 'B',
			status: 'idea',
		}
		const encoded = encodeDeal(USER, record)
		expect(encoded.ok).toBe(true)
		if (!encoded.ok) return
		expect(encoded.value.value_estimate).toBeNull()
		expect('valueEstimate' in encoded.value.payload).toBe(false)
		const decoded = decodeDeal(encoded.value)
		expect(decoded.ok).toBe(true)
		if (!decoded.ok) return
		expect(decoded.value.valueEstimate).toBeUndefined()
	})
})

describe('eventCodec', () => {
	it('round-trips a complete active record', () => {
		const record = completeEvent()
		const encoded = encodeEvent(USER, record)
		expect(encoded.ok).toBe(true)
		if (!encoded.ok) return
		expect(encoded.value.event_type).toBe('camp_clinic')
		expect(encoded.value.event_date).toBe('2026-07-20')
		expect(encoded.value.linked_deal_client_id).toBe('deal-1')
		const decoded = decodeEvent(encoded.value)
		expect(decoded.ok).toBe(true)
		if (!decoded.ok) return
		expect(decoded.value).toEqual(record)
	})

	it('preserves date format and optional nested sponsors without inventing empties', () => {
		const record = completeEvent({
			sponsors: undefined,
			hostOrganization: undefined,
			expectedAttendees: undefined,
			runOfShowUrl: undefined,
			waiversUrl: undefined,
			notes: undefined,
			linkedDealId: undefined,
		})
		delete (record as Partial<EventPlan>).sponsors
		delete (record as Partial<EventPlan>).hostOrganization
		delete (record as Partial<EventPlan>).expectedAttendees
		delete (record as Partial<EventPlan>).runOfShowUrl
		delete (record as Partial<EventPlan>).waiversUrl
		delete (record as Partial<EventPlan>).notes
		delete (record as Partial<EventPlan>).linkedDealId

		const encoded = encodeEvent(USER, record)
		expect(encoded.ok).toBe(true)
		if (!encoded.ok) return
		expect(encoded.value.event_date).toBe('2026-07-20')
		expect(encoded.value.host_organization).toBeNull()
		const decoded = decodeEvent(encoded.value)
		expect(decoded.ok).toBe(true)
		if (!decoded.ok) return
		expect(decoded.value.date).toBe('2026-07-20')
		expect(decoded.value.sponsors).toBeUndefined()
		expect(decoded.value.linkedDealId).toBeUndefined()
	})

	it('preserves unknown fields and linkedDealId; fails on bad payload', () => {
		const record = completeEvent()
		const encoded = encodeEvent(USER, record)
		expect(encoded.ok).toBe(true)
		if (!encoded.ok) return
		encoded.value.payload.custom = 1
		const decoded = decodeEvent(encoded.value)
		expect(decoded.ok).toBe(true)
		if (!decoded.ok) return
		expect((decoded.value as EventPlan & { custom?: number }).custom).toBe(1)
		expect(decodeEvent({ client_id: 'e', payload: 'x' }).ok).toBe(false)
	})

	it('derives stable legacy client id without id', () => {
		const raw = {
			athleteId: 'ath-1',
			type: 'appearance',
			name: 'N',
			date: '2026-01-01',
			location: 'L',
		}
		expect(eventClientId(raw)).toBe(eventClientId({ ...raw }))
	})
})
