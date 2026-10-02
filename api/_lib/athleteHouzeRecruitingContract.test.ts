import { describe, expect, it } from 'vitest'
import { signAthleteHouzeBody } from './athleteHouzeReporter'
import {
	canonicalRecruitingContent,
	parseRecruitingAcknowledgement,
	parseRecruitingEvent,
	RECRUITING_ACK_SCHEMA_VERSION,
	RECRUITING_EVENT_SCHEMA_VERSION,
	reconstructedSignatureWouldDiffer,
	signRecruitingRequest,
	verifyRecruitingSignature,
} from './athleteHouzeRecruitingContract'

const SECRET = 'development-secret-012345'

function eventJson(extra: Record<string, unknown> = {}, payloadExtra: Record<string, unknown> = {}) {
	return JSON.stringify({
		schemaVersion: RECRUITING_EVENT_SCHEMA_VERSION,
		eventId: 'evt_receive_0001',
		idempotencyKey: 'idem_receive_0001',
		houzeAthleteId: 'ath_houze_0001',
		entityType: 'recruiting_record',
		entityId: 'rec_record_0001',
		revision: 1,
		occurredAt: '2026-10-01T03:04:05.000Z',
		payload: {
			title: 'State camp',
			status: 'prospect',
			...payloadExtra,
		},
		...extra,
	})
}

describe('Athlete Houze recruiting event contract', () => {
	it('accepts the allowlisted event and canonicalizes optional notes', () => {
		const parsed = parseRecruitingEvent(Buffer.from(eventJson()))
		expect(parsed.payload).toEqual({ title: 'State camp', status: 'prospect', note: null })
		expect(canonicalRecruitingContent(parsed)).toContain('"payload":{"status":"prospect","title":"State camp"}')
		const withNote = parseRecruitingEvent(
			Buffer.from(eventJson({}, { note: '  bring a quote "film"  ' }))
		)
		expect(withNote.payload.note).toBe('bring a quote "film"')
		expect(canonicalRecruitingContent(withNote)).toContain('\\"film\\"')
	})

	it('rejects unknown fields instead of persisting them', () => {
		expect(() => parseRecruitingEvent(Buffer.from(eventJson({ email: 'a@b.test' })))).toThrow(
			/unknown_field/
		)
		expect(() =>
			parseRecruitingEvent(Buffer.from(eventJson({}, { internalNote: 'hidden' })))
		).toThrow(/unknown_field/)
	})

	it('does not treat a Clerk id as a NIL account id', () => {
		expect(() =>
			parseRecruitingEvent(Buffer.from(eventJson({ claimedNilAccountId: 'user_clerk12345678' })))
		).toThrow(/invalid_event/)
		const parsed = parseRecruitingEvent(
			Buffer.from(
				eventJson({
					claimedNilAccountId: '11111111-1111-4111-8111-111111111111',
					claimedClerkUserId: 'user_clerk12345678',
				})
			)
		)
		expect(parsed.claimedNilAccountId).toBe('11111111-1111-4111-8111-111111111111')
		expect(parsed.claimedClerkUserId).toBe('user_clerk12345678')
	})

	it('verifies the same HMAC construction Athlete Houze already uses for outbound reports', () => {
		const raw = '{\n  "schemaVersion": "athlete-houze.recruiting.event.v1",\n  "keep": " spacing"\n}\n'
		const timestamp = 1_780_000_000
		const signature = signRecruitingRequest(raw, timestamp, SECRET)
		expect(signature).toBe(`sha256=${signAthleteHouzeBody(raw, timestamp, SECRET)}`)
		expect(
			verifyRecruitingSignature(Buffer.from(raw), String(timestamp), signature, SECRET, timestamp, 300)
		).toBe(true)
		expect(reconstructedSignatureWouldDiffer(raw, SECRET, timestamp)).toBe(true)
		expect(
			verifyRecruitingSignature(
				Buffer.from(raw),
				String(timestamp),
				`sha256=${signAthleteHouzeBody(JSON.stringify(JSON.parse(raw)), timestamp, SECRET)}`,
				SECRET,
				timestamp,
				300
			)
		).toBe(false)
	})

	it('requires a newer current revision to be explicit on the acknowledgement', () => {
		expect(() =>
			parseRecruitingAcknowledgement({
				schemaVersion: RECRUITING_ACK_SCHEMA_VERSION,
				eventId: 'evt_receive_0001',
				idempotencyKey: 'idem_receive_0001',
				houzeAthleteId: 'ath_houze_0001',
				nilAccountId: '11111111-1111-4111-8111-111111111111',
				entityType: 'recruiting_record',
				entityId: 'rec_record_0001',
				requestedRevision: 4,
				currentRevision: 4,
				revisionOutcome: 'current_revision_newer',
				applied: false,
			})
		).toThrow(/invalid_acknowledgement/)
	})
})
