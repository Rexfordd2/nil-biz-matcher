import type { EventPlan } from '../../types'
import {
	cloneRecordPayload,
	isPlainObject,
	optionalNumber,
	optionalString,
	optionalStringArray,
	resolveClientId,
} from './stableId'
import type { CodecFailure, CodecSuccess, EventDbRow } from './types'
import { WORKFLOW_SOURCE } from './types'

function eventFingerprint(raw: Record<string, unknown>): Record<string, unknown> {
	return {
		athleteId: raw.athleteId ?? null,
		type: raw.type ?? null,
		name: raw.name ?? null,
		date: raw.date ?? null,
		location: raw.location ?? null,
		hostOrganization: raw.hostOrganization ?? null,
		linkedDealId: raw.linkedDealId ?? null,
		notes: raw.notes ?? null,
	}
}

export function eventClientId(record: EventPlan | Record<string, unknown>): string {
	const raw = record as Record<string, unknown>
	return resolveClientId(raw.id, 'evt', eventFingerprint(raw))
}

export function encodeEvent(
	userId: string,
	record: EventPlan
): CodecSuccess<EventDbRow> | CodecFailure {
	if (!userId || typeof userId !== 'string') return { ok: false, error: 'invalid_record' }
	if (!record || typeof record !== 'object') return { ok: false, error: 'invalid_record' }

	const payload = cloneRecordPayload(record)
	delete payload.user_id
	delete payload.userId

	const clientId = eventClientId(record)
	payload.id = clientId

	return {
		ok: true,
		value: {
			user_id: userId,
			client_id: clientId,
			athlete_id: optionalString(record.athleteId) ?? null,
			name: optionalString(record.name) ?? null,
			event_type: optionalString(record.type) ?? null,
			event_date: optionalString(record.date) ?? null,
			location: optionalString(record.location) ?? null,
			host_organization: optionalString(record.hostOrganization) ?? null,
			linked_deal_client_id: optionalString(record.linkedDealId) ?? null,
			payload,
			source: WORKFLOW_SOURCE,
		},
	}
}

export function decodeEvent(row: unknown): CodecSuccess<EventPlan> | CodecFailure {
	if (!isPlainObject(row)) return { ok: false, error: 'decode_failure' }
	const clientId = optionalString(row.client_id)
	if (!clientId) return { ok: false, error: 'decode_failure' }

	const payload = row.payload
	if (!isPlainObject(payload)) return { ok: false, error: 'decode_failure' }

	const record = { ...payload } as EventPlan & Record<string, unknown>
	record.id = clientId

	const athleteId = optionalString(payload.athleteId) ?? optionalString(row.athlete_id)
	if (athleteId !== undefined) record.athleteId = athleteId

	const type = optionalString(payload.type) ?? optionalString(row.event_type)
	if (type !== undefined) record.type = type as EventPlan['type']
	else if (!('type' in payload)) return { ok: false, error: 'decode_failure' }

	const name = optionalString(payload.name) ?? optionalString(row.name)
	if (name !== undefined) record.name = name
	else if (!('name' in payload)) return { ok: false, error: 'decode_failure' }

	const date = optionalString(payload.date) ?? optionalString(row.event_date)
	if (date !== undefined) record.date = date
	else if (!('date' in payload)) return { ok: false, error: 'decode_failure' }

	const location = optionalString(payload.location) ?? optionalString(row.location)
	if (location !== undefined) record.location = location
	else if (!('location' in payload)) return { ok: false, error: 'decode_failure' }

	const hostOrganization = optionalString(payload.hostOrganization)
	if (hostOrganization !== undefined) record.hostOrganization = hostOrganization
	else delete record.hostOrganization

	const expectedAttendees = optionalNumber(payload.expectedAttendees)
	if (expectedAttendees !== undefined) record.expectedAttendees = expectedAttendees
	else delete record.expectedAttendees

	const sponsors = optionalStringArray(payload.sponsors)
	if (sponsors !== undefined) record.sponsors = sponsors
	else delete record.sponsors

	const runOfShowUrl = optionalString(payload.runOfShowUrl)
	if (runOfShowUrl !== undefined) record.runOfShowUrl = runOfShowUrl
	else delete record.runOfShowUrl

	const waiversUrl = optionalString(payload.waiversUrl)
	if (waiversUrl !== undefined) record.waiversUrl = waiversUrl
	else delete record.waiversUrl

	const notes = optionalString(payload.notes)
	if (notes !== undefined) record.notes = notes
	else delete record.notes

	const linkedDealId = optionalString(payload.linkedDealId)
	if (linkedDealId !== undefined) record.linkedDealId = linkedDealId
	else delete record.linkedDealId

	delete record.user_id
	delete record.userId

	if (typeof record.athleteId !== 'string' || !record.athleteId) {
		return { ok: false, error: 'decode_failure' }
	}

	return { ok: true, value: record as EventPlan }
}
