import type { DealLogEntry, LicensingUsage, CollectiveRelationship, PaymentRecord } from '../../types'
import {
	cloneRecordPayload,
	isPlainObject,
	optionalBoolean,
	optionalNumber,
	optionalString,
	optionalStringArray,
	resolveClientId,
} from './stableId'
import type { CodecFailure, CodecSuccess, DealDbRow } from './types'
import { WORKFLOW_SOURCE } from './types'

function dealFingerprint(raw: Record<string, unknown>): Record<string, unknown> {
	return {
		athleteId: raw.athleteId ?? null,
		title: raw.title ?? null,
		dealType: raw.dealType ?? null,
		brandName: raw.brandName ?? null,
		status: raw.status ?? null,
		valueEstimate: raw.valueEstimate ?? null,
		currency: raw.currency ?? null,
		startDate: raw.startDate ?? null,
		endDate: raw.endDate ?? null,
		businessId: raw.businessId ?? null,
	}
}

export function dealClientId(record: DealLogEntry | Record<string, unknown>): string {
	const raw = record as Record<string, unknown>
	return resolveClientId(raw.id, 'deal', dealFingerprint(raw))
}

function decodeLicensing(value: unknown): LicensingUsage | undefined {
	if (!isPlainObject(value)) return undefined
	const usesSchoolMarks = optionalBoolean(value.usesSchoolMarks)
	if (usesSchoolMarks === undefined) return undefined
	const notes = optionalString(value.notes)
	const out: LicensingUsage = { usesSchoolMarks }
	if (notes !== undefined) out.notes = notes
	return out
}

function decodeCollective(value: unknown): CollectiveRelationship | undefined {
	if (!isPlainObject(value)) return undefined
	const name = optionalString(value.name)
	if (name === undefined) return undefined
	const out: CollectiveRelationship = { name }
	const contactName = optionalString(value.contactName)
	if (contactName !== undefined) out.contactName = contactName
	const contactEmail = optionalString(value.contactEmail)
	if (contactEmail !== undefined) out.contactEmail = contactEmail
	const notes = optionalString(value.notes)
	if (notes !== undefined) out.notes = notes
	return out
}

function decodePayments(value: unknown): PaymentRecord[] | undefined {
	if (value === undefined || value === null) return undefined
	if (!Array.isArray(value)) return undefined
	const out: PaymentRecord[] = []
	for (const item of value) {
		if (!isPlainObject(item)) continue
		const date = optionalString(item.date)
		const amount = optionalNumber(item.amount)
		const currency = optionalString(item.currency)
		if (date === undefined || amount === undefined || currency === undefined) continue
		const p: PaymentRecord = { date, amount, currency }
		const method = optionalString(item.method)
		if (method !== undefined) p.method = method as PaymentRecord['method']
		const notes = optionalString(item.notes)
		if (notes !== undefined) p.notes = notes
		out.push(p)
	}
	return out
}

export function encodeDeal(
	userId: string,
	record: DealLogEntry
): CodecSuccess<DealDbRow> | CodecFailure {
	if (!userId || typeof userId !== 'string') return { ok: false, error: 'invalid_record' }
	if (!record || typeof record !== 'object') return { ok: false, error: 'invalid_record' }

	const payload = cloneRecordPayload(record)
	delete payload.user_id
	delete payload.userId

	const clientId = dealClientId(record)
	payload.id = clientId

	const valueEstimate =
		typeof record.valueEstimate === 'number' && Number.isFinite(record.valueEstimate)
			? record.valueEstimate
			: null

	return {
		ok: true,
		value: {
			user_id: userId,
			client_id: clientId,
			athlete_id: optionalString(record.athleteId) ?? null,
			title: optionalString(record.title) ?? null,
			status: optionalString(record.status) ?? null,
			brand_name: optionalString(record.brandName) ?? null,
			deal_type: optionalString(record.dealType) ?? null,
			value_estimate: valueEstimate,
			currency: optionalString(record.currency) ?? null,
			start_date: optionalString(record.startDate) ?? null,
			end_date: optionalString(record.endDate) ?? null,
			payload,
			source: WORKFLOW_SOURCE,
		},
	}
}

export function decodeDeal(row: unknown): CodecSuccess<DealLogEntry> | CodecFailure {
	if (!isPlainObject(row)) return { ok: false, error: 'decode_failure' }
	const clientId = optionalString(row.client_id)
	if (!clientId) return { ok: false, error: 'decode_failure' }

	const payload = row.payload
	if (!isPlainObject(payload)) return { ok: false, error: 'decode_failure' }

	const record = { ...payload } as DealLogEntry & Record<string, unknown>
	record.id = clientId

	const athleteId = optionalString(payload.athleteId) ?? optionalString(row.athlete_id)
	if (athleteId !== undefined) record.athleteId = athleteId

	const title = optionalString(payload.title) ?? optionalString(row.title)
	if (title !== undefined) record.title = title
	else if (!('title' in payload)) return { ok: false, error: 'decode_failure' }

	const dealType = optionalString(payload.dealType) ?? optionalString(row.deal_type)
	if (dealType !== undefined) record.dealType = dealType as DealLogEntry['dealType']
	else if (!('dealType' in payload)) return { ok: false, error: 'decode_failure' }

	const brandName = optionalString(payload.brandName) ?? optionalString(row.brand_name)
	if (brandName !== undefined) record.brandName = brandName
	else if (!('brandName' in payload)) return { ok: false, error: 'decode_failure' }

	const status = optionalString(payload.status) ?? optionalString(row.status)
	if (status !== undefined) record.status = status as DealLogEntry['status']
	else if (!('status' in payload)) return { ok: false, error: 'decode_failure' }

	const businessId = optionalString(payload.businessId)
	if (businessId !== undefined) record.businessId = businessId
	else delete record.businessId

	const valueEstimate = optionalNumber(payload.valueEstimate)
	if (valueEstimate !== undefined) record.valueEstimate = valueEstimate
	else delete record.valueEstimate

	const currency = optionalString(payload.currency)
	if (currency !== undefined) record.currency = currency
	else delete record.currency

	const startDate = optionalString(payload.startDate)
	if (startDate !== undefined) record.startDate = startDate
	else delete record.startDate

	const endDate = optionalString(payload.endDate)
	if (endDate !== undefined) record.endDate = endDate
	else delete record.endDate

	const deliverables = optionalStringArray(payload.deliverables)
	if (deliverables !== undefined) record.deliverables = deliverables
	else delete record.deliverables

	const exclusivityNotes = optionalString(payload.exclusivityNotes)
	if (exclusivityNotes !== undefined) record.exclusivityNotes = exclusivityNotes
	else delete record.exclusivityNotes

	const licensing = decodeLicensing(payload.licensing)
	if (licensing !== undefined) record.licensing = licensing
	else delete record.licensing

	const reportedToSchool = optionalBoolean(payload.reportedToSchool)
	if (reportedToSchool !== undefined) record.reportedToSchool = reportedToSchool
	else delete record.reportedToSchool

	const reportedToCollective = optionalBoolean(payload.reportedToCollective)
	if (reportedToCollective !== undefined) record.reportedToCollective = reportedToCollective
	else delete record.reportedToCollective

	const complianceNotes = optionalString(payload.complianceNotes)
	if (complianceNotes !== undefined) record.complianceNotes = complianceNotes
	else delete record.complianceNotes

	const collective = decodeCollective(payload.collective)
	if (collective !== undefined) record.collective = collective
	else delete record.collective

	const documents = optionalStringArray(payload.documents)
	if (documents !== undefined) record.documents = documents
	else delete record.documents

	const payments = decodePayments(payload.payments)
	if (payments !== undefined) record.payments = payments
	else delete record.payments

	delete record.user_id
	delete record.userId

	if (typeof record.athleteId !== 'string' || !record.athleteId) {
		return { ok: false, error: 'decode_failure' }
	}

	return { ok: true, value: record as DealLogEntry }
}
