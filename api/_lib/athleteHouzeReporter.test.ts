import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
	buildNilRosterOpportunityReport,
	loadAthleteHouzeReporterConfig,
	sendAthleteHouzeReport,
} from './athleteHouzeReporter'

describe('Athlete Houze NILRoster reporter', () => {
	it('fails closed when either server-only setting is missing', () => {
		expect(loadAthleteHouzeReporterConfig({})).toBeNull()
		expect(
			loadAthleteHouzeReporterConfig({ ATHLETE_HOUZE_REPORT_URL: 'https://example.test' })
		).toBeNull()
	})

	it('builds deterministic, privacy-minimized NIL opportunity evidence', () => {
		const input = {
			externalAthleteId: 'nil-canary-0001',
			sourceRecordId: 'opportunity-canary-0001',
			occurredAt: '2026-08-09T20:00:00.000Z',
			status: 'idea',
			category: 'local_brand_deal',
			environment: 'production' as const,
		}
		const first = buildNilRosterOpportunityReport(input)
		const second = buildNilRosterOpportunityReport(input)
		expect(first.eventId).toBe(second.eventId)
		expect(first.idempotencyKey).toBe(second.idempotencyKey)
		expect(first.sourceSystem).toBe('nil_roster')
		expect(JSON.stringify(first)).not.toContain('email')
		expect(JSON.stringify(first)).not.toContain('phone')
		expect(JSON.stringify(first)).not.toContain('school')
	})

	it('signs the exact body and retries temporary failures', async () => {
		const secret = 'test-secret-do-not-use-in-production'
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(new Response('{}', { status: 503 }))
			.mockResolvedValueOnce(new Response('{"accepted":true}', { status: 202 }))
		const report = { eventId: 'event-0001' }
		const result = await sendAthleteHouzeReport(report, {
			endpoint: 'https://example.test/api/app-reports',
			hmacSecret: secret,
			maxAttempts: 2,
			fetchImpl,
		})

		expect(result).toMatchObject({ ok: true, status: 202, attempts: 2 })
		const [, request] = fetchImpl.mock.calls[1]
		const timestamp = request.headers['x-ah-timestamp']
		const expected = createHmac('sha256', secret)
			.update(`${timestamp}.`)
			.update(JSON.stringify(report))
			.digest('hex')
		expect(request.headers['x-ah-signature']).toBe(`sha256=${expected}`)
	})
})
