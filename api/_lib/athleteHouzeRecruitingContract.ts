import { createHmac, timingSafeEqual } from 'node:crypto'
import { signAthleteHouzeBody } from './athleteHouzeReporter'

/** Inbound event contract coordinated with Athlete Houze. Distinct from nil.opportunity.updated. */
export const RECRUITING_EVENT_SCHEMA_VERSION = 'athlete-houze.recruiting.event.v1' as const
export const RECRUITING_ACK_SCHEMA_VERSION = 'athlete-houze.recruiting.ack.v1' as const

export const RECRUITING_EVENT_FIELDS = [
	'schemaVersion',
	'eventId',
	'idempotencyKey',
	'houzeAthleteId',
	'claimedNilAccountId',
	'claimedClerkUserId',
	'entityType',
	'entityId',
	'revision',
	'occurredAt',
	'payload',
] as const

export const RECRUITING_PAYLOAD_FIELDS = ['note', 'status', 'title'] as const

export const RECRUITING_ACK_FIELDS = [
	'schemaVersion',
	'eventId',
	'idempotencyKey',
	'houzeAthleteId',
	'nilAccountId',
	'entityType',
	'entityId',
	'requestedRevision',
	'currentRevision',
	'revisionOutcome',
	'applied',
] as const

export const RECRUITING_STATUSES = [
	'prospect',
	'contacted',
	'visiting',
	'committed',
	'paused',
] as const

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/
const CLERK_ID_PATTERN = /^user_[A-Za-z0-9]{8,64}$/
const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const OCCURRED_AT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/

export type RecruitingStatus = (typeof RECRUITING_STATUSES)[number]

export type ValidatedRecruitingEvent = {
	schemaVersion: typeof RECRUITING_EVENT_SCHEMA_VERSION
	eventId: string
	idempotencyKey: string
	houzeAthleteId: string
	claimedNilAccountId: string | null
	claimedClerkUserId: string | null
	entityType: 'recruiting_record'
	entityId: string
	revision: number
	occurredAt: string
	payload: {
		title: string
		status: RecruitingStatus
		note: string | null
	}
}

export type RevisionOutcome = 'applied' | 'current_revision_newer' | 'current_revision_matches'

export type RecruitingAcknowledgement = {
	schemaVersion: typeof RECRUITING_ACK_SCHEMA_VERSION
	eventId: string
	idempotencyKey: string
	houzeAthleteId: string
	nilAccountId: string
	entityType: 'recruiting_record'
	entityId: string
	requestedRevision: number
	currentRevision: number
	revisionOutcome: RevisionOutcome
	applied: boolean
}

export class RecruitingEventRejected extends Error {
	readonly code: 'unknown_field' | 'invalid_event' | 'invalid_json'

	constructor(code: 'unknown_field' | 'invalid_event' | 'invalid_json') {
		super(code)
		this.name = 'RecruitingEventRejected'
		this.code = code
	}
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function rejectUnknown(value: Record<string, unknown>, allowed: readonly string[]): void {
	for (const key of Object.keys(value)) {
		if (!allowed.includes(key)) throw new RecruitingEventRejected('unknown_field')
	}
}

function requireId(value: unknown): string {
	if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
		throw new RecruitingEventRejected('invalid_event')
	}
	return value
}

function jsonString(value: string): string {
	return JSON.stringify(value)
}

/**
 * Canonical content used for equal-revision comparison.
 * Key order matches public.recruiting_receiver_content_canonical.
 */
export function canonicalRecruitingContent(event: ValidatedRecruitingEvent): string {
	const payload =
		event.payload.note === null
			? `{"status":${jsonString(event.payload.status)},"title":${jsonString(event.payload.title)}}`
			: `{"note":${jsonString(event.payload.note)},"status":${jsonString(event.payload.status)},"title":${jsonString(event.payload.title)}}`
	return (
		`{"entityId":${jsonString(event.entityId)}` +
		`,"entityType":${jsonString(event.entityType)}` +
		`,"houzeAthleteId":${jsonString(event.houzeAthleteId)}` +
		`,"occurredAt":${jsonString(event.occurredAt)}` +
		`,"payload":${payload}` +
		`,"revision":${event.revision}` +
		`,"schemaVersion":${jsonString(event.schemaVersion)}}`
	)
}

export function parseRecruitingEvent(raw: Buffer): ValidatedRecruitingEvent {
	let parsed: unknown
	try {
		parsed = JSON.parse(raw.toString('utf8')) as unknown
	} catch {
		throw new RecruitingEventRejected('invalid_json')
	}
	if (!isPlainObject(parsed)) throw new RecruitingEventRejected('invalid_event')
	rejectUnknown(parsed, RECRUITING_EVENT_FIELDS)
	if (parsed.schemaVersion !== RECRUITING_EVENT_SCHEMA_VERSION) {
		throw new RecruitingEventRejected('invalid_event')
	}
	const eventId = requireId(parsed.eventId)
	const idempotencyKey = requireId(parsed.idempotencyKey)
	const houzeAthleteId = requireId(parsed.houzeAthleteId)
	if (eventId === idempotencyKey) throw new RecruitingEventRejected('invalid_event')

	let claimedNilAccountId: string | null = null
	if (parsed.claimedNilAccountId !== undefined) {
		if (typeof parsed.claimedNilAccountId !== 'string' || !UUID_PATTERN.test(parsed.claimedNilAccountId)) {
			throw new RecruitingEventRejected('invalid_event')
		}
		claimedNilAccountId = parsed.claimedNilAccountId.toLowerCase()
	}

	let claimedClerkUserId: string | null = null
	if (parsed.claimedClerkUserId !== undefined) {
		if (typeof parsed.claimedClerkUserId !== 'string' || !CLERK_ID_PATTERN.test(parsed.claimedClerkUserId)) {
			throw new RecruitingEventRejected('invalid_event')
		}
		if (UUID_PATTERN.test(parsed.claimedClerkUserId)) {
			throw new RecruitingEventRejected('invalid_event')
		}
		claimedClerkUserId = parsed.claimedClerkUserId
	}

	if (parsed.entityType !== 'recruiting_record') throw new RecruitingEventRejected('invalid_event')
	const entityId = requireId(parsed.entityId)
	if (typeof parsed.revision !== 'number' || !Number.isInteger(parsed.revision) || parsed.revision < 0) {
		throw new RecruitingEventRejected('invalid_event')
	}
	if (parsed.revision > 2_147_483_647) throw new RecruitingEventRejected('invalid_event')
	if (typeof parsed.occurredAt !== 'string' || !OCCURRED_AT_PATTERN.test(parsed.occurredAt)) {
		throw new RecruitingEventRejected('invalid_event')
	}
	const occurredAt = new Date(parsed.occurredAt).toISOString()
	if (Number.isNaN(Date.parse(parsed.occurredAt))) throw new RecruitingEventRejected('invalid_event')

	if (!isPlainObject(parsed.payload)) throw new RecruitingEventRejected('invalid_event')
	rejectUnknown(parsed.payload, RECRUITING_PAYLOAD_FIELDS)
	if (typeof parsed.payload.title !== 'string') throw new RecruitingEventRejected('invalid_event')
	const title = parsed.payload.title.trim()
	if (title.length < 1 || title.length > 200) throw new RecruitingEventRejected('invalid_event')
	if (
		typeof parsed.payload.status !== 'string' ||
		!RECRUITING_STATUSES.includes(parsed.payload.status as RecruitingStatus)
	) {
		throw new RecruitingEventRejected('invalid_event')
	}
	let note: string | null = null
	if (parsed.payload.note !== undefined) {
		if (typeof parsed.payload.note !== 'string') throw new RecruitingEventRejected('invalid_event')
		const trimmed = parsed.payload.note.trim()
		if (trimmed.length > 2000) throw new RecruitingEventRejected('invalid_event')
		note = trimmed.length === 0 ? null : trimmed
	}

	return {
		schemaVersion: RECRUITING_EVENT_SCHEMA_VERSION,
		eventId,
		idempotencyKey,
		houzeAthleteId,
		claimedNilAccountId,
		claimedClerkUserId,
		entityType: 'recruiting_record',
		entityId,
		revision: parsed.revision,
		occurredAt,
		payload: {
			title,
			status: parsed.payload.status as RecruitingStatus,
			note,
		},
	}
}

export function verifyRecruitingSignature(
	rawBody: Buffer,
	timestampHeader: string | undefined,
	signatureHeader: string | undefined,
	secret: string,
	nowSeconds: number,
	skewSeconds: number
): boolean {
	if (!timestampHeader || !/^\d{1,12}$/.test(timestampHeader)) return false
	if (!signatureHeader || !/^sha256=[0-9a-f]{64}$/i.test(signatureHeader)) return false
	const timestamp = Number(timestampHeader)
	if (!Number.isSafeInteger(timestamp)) return false
	if (Math.abs(nowSeconds - timestamp) > skewSeconds) return false
	const expected = signAthleteHouzeBody(rawBody.toString('utf8'), timestamp, secret)
	const provided = signatureHeader.slice('sha256='.length)
	const expectedBuf = Buffer.from(expected, 'hex')
	const providedBuf = Buffer.from(provided, 'hex')
	if (expectedBuf.length !== providedBuf.length) return false
	return timingSafeEqual(expectedBuf, providedBuf)
}

export function signRecruitingRequest(rawBody: string, timestampSeconds: number, secret: string): string {
	return `sha256=${signAthleteHouzeBody(rawBody, timestampSeconds, secret)}`
}

export function reconstructedSignatureWouldDiffer(rawBody: string, secret: string, timestampSeconds: number): boolean {
	let parsed: unknown
	try {
		parsed = JSON.parse(rawBody) as unknown
	} catch {
		return true
	}
	const rebuilt = JSON.stringify(parsed)
	if (rebuilt === rawBody) return false
	const original = createHmac('sha256', secret).update(`${timestampSeconds}.`).update(rawBody).digest('hex')
	const reconstructed = createHmac('sha256', secret)
		.update(`${timestampSeconds}.`)
		.update(rebuilt)
		.digest('hex')
	return original !== reconstructed
}

export function parseRecruitingAcknowledgement(value: unknown): RecruitingAcknowledgement {
	if (!isPlainObject(value)) throw new Error('invalid_acknowledgement')
	rejectUnknown(value, RECRUITING_ACK_FIELDS)
	for (const field of RECRUITING_ACK_FIELDS) {
		if (!(field in value)) throw new Error('invalid_acknowledgement')
	}
	if (value.schemaVersion !== RECRUITING_ACK_SCHEMA_VERSION) throw new Error('invalid_acknowledgement')
	if (value.entityType !== 'recruiting_record') throw new Error('invalid_acknowledgement')
	if (typeof value.eventId !== 'string' || typeof value.idempotencyKey !== 'string') {
		throw new Error('invalid_acknowledgement')
	}
	if (typeof value.houzeAthleteId !== 'string' || !UUID_PATTERN.test(String(value.nilAccountId))) {
		throw new Error('invalid_acknowledgement')
	}
	if (typeof value.entityId !== 'string') throw new Error('invalid_acknowledgement')
	if (typeof value.requestedRevision !== 'number' || typeof value.currentRevision !== 'number') {
		throw new Error('invalid_acknowledgement')
	}
	if (
		value.revisionOutcome !== 'applied' &&
		value.revisionOutcome !== 'current_revision_newer' &&
		value.revisionOutcome !== 'current_revision_matches'
	) {
		throw new Error('invalid_acknowledgement')
	}
	if (typeof value.applied !== 'boolean') throw new Error('invalid_acknowledgement')
	if (value.revisionOutcome === 'current_revision_newer' && value.currentRevision <= value.requestedRevision) {
		throw new Error('invalid_acknowledgement')
	}
	if (value.revisionOutcome === 'current_revision_newer' && value.applied !== false) {
		throw new Error('invalid_acknowledgement')
	}
	return {
		schemaVersion: RECRUITING_ACK_SCHEMA_VERSION,
		eventId: value.eventId,
		idempotencyKey: value.idempotencyKey,
		houzeAthleteId: value.houzeAthleteId,
		nilAccountId: String(value.nilAccountId).toLowerCase(),
		entityType: 'recruiting_record',
		entityId: value.entityId,
		requestedRevision: value.requestedRevision,
		currentRevision: value.currentRevision,
		revisionOutcome: value.revisionOutcome,
		applied: value.applied,
	}
}
