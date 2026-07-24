import type { Opportunity } from '../../types'
import {
	cloneRecordPayload,
	isPlainObject,
	optionalString,
	resolveClientId,
} from './stableId'
import type { CodecFailure, CodecSuccess, OpportunityDbRow } from './types'
import { WORKFLOW_SOURCE } from './types'

function opportunityFingerprint(raw: Record<string, unknown>): Record<string, unknown> {
	return {
		athleteId: raw.athleteId ?? null,
		title: raw.title ?? null,
		category: raw.category ?? null,
		status: raw.status ?? null,
		targetBrandName: raw.targetBrandName ?? null,
		linkedDealId: raw.linkedDealId ?? null,
		expectedStartDate: raw.expectedStartDate ?? null,
		expectedEndDate: raw.expectedEndDate ?? null,
		description: raw.description ?? null,
		notes: raw.notes ?? null,
	}
}

export function opportunityClientId(record: Opportunity | Record<string, unknown>): string {
	const raw = record as Record<string, unknown>
	return resolveClientId(raw.id, 'opp', opportunityFingerprint(raw))
}

/**
 * Encode Opportunity → DB row. userId is supplied separately; never taken from payload.
 */
export function encodeOpportunity(
	userId: string,
	record: Opportunity
): CodecSuccess<OpportunityDbRow> | CodecFailure {
	if (!userId || typeof userId !== 'string') return { ok: false, error: 'invalid_record' }
	if (!record || typeof record !== 'object') return { ok: false, error: 'invalid_record' }

	const payload = cloneRecordPayload(record)
	// Strip any spoofed ownership fields from payload before persistence of summary identity
	delete payload.user_id
	delete payload.userId

	const clientId = opportunityClientId(record)
	payload.id = clientId

	return {
		ok: true,
		value: {
			user_id: userId,
			client_id: clientId,
			athlete_id: optionalString(record.athleteId) ?? null,
			title: optionalString(record.title) ?? null,
			status: optionalString(record.status) ?? null,
			category: optionalString(record.category) ?? null,
			target_brand_name: optionalString(record.targetBrandName) ?? null,
			expected_start_date: optionalString(record.expectedStartDate) ?? null,
			expected_end_date: optionalString(record.expectedEndDate) ?? null,
			linked_deal_client_id: optionalString(record.linkedDealId) ?? null,
			payload,
			source: WORKFLOW_SOURCE,
		},
	}
}

/**
 * Decode DB row → Opportunity. Payload is source of truth; unknown fields preserved.
 */
export function decodeOpportunity(
	row: unknown
): CodecSuccess<Opportunity> | CodecFailure {
	if (!isPlainObject(row)) return { ok: false, error: 'decode_failure' }
	const clientId = optionalString(row.client_id)
	if (!clientId) return { ok: false, error: 'decode_failure' }

	const payload = row.payload
	if (!isPlainObject(payload)) return { ok: false, error: 'decode_failure' }

	// Start from payload so unknown future fields survive round trip
	const record = { ...payload } as Opportunity & Record<string, unknown>
	record.id = clientId

	const athleteId = optionalString(payload.athleteId) ?? optionalString(row.athlete_id)
	if (athleteId !== undefined) record.athleteId = athleteId

	const title = optionalString(payload.title) ?? optionalString(row.title)
	if (title !== undefined) record.title = title
	else if (!('title' in payload)) return { ok: false, error: 'decode_failure' }

	const category = optionalString(payload.category) ?? optionalString(row.category)
	if (category !== undefined) (record as Opportunity).category = category as Opportunity['category']
	else if (!('category' in payload)) return { ok: false, error: 'decode_failure' }

	const status = optionalString(payload.status) ?? optionalString(row.status)
	if (status !== undefined) (record as Opportunity).status = status as Opportunity['status']
	else if (!('status' in payload)) return { ok: false, error: 'decode_failure' }

	// Optional fields: only set when present in payload (do not invent empty strings from null columns)
	const description = optionalString(payload.description)
	if (description !== undefined) record.description = description
	else delete record.description

	const targetBrandName = optionalString(payload.targetBrandName)
	if (targetBrandName !== undefined) record.targetBrandName = targetBrandName
	else delete record.targetBrandName

	const linkedDealId = optionalString(payload.linkedDealId)
	if (linkedDealId !== undefined) record.linkedDealId = linkedDealId
	else delete record.linkedDealId

	const expectedStartDate = optionalString(payload.expectedStartDate)
	if (expectedStartDate !== undefined) record.expectedStartDate = expectedStartDate
	else delete record.expectedStartDate

	const expectedEndDate = optionalString(payload.expectedEndDate)
	if (expectedEndDate !== undefined) record.expectedEndDate = expectedEndDate
	else delete record.expectedEndDate

	const notes = optionalString(payload.notes)
	if (notes !== undefined) record.notes = notes
	else delete record.notes

	// Never accept user identity from payload/row into the domain record
	delete record.user_id
	delete record.userId

	if (typeof record.athleteId !== 'string' || !record.athleteId) {
		return { ok: false, error: 'decode_failure' }
	}

	return { ok: true, value: record as Opportunity }
}
