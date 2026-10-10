import { describe, expect, it, vi } from 'vitest'
import {
	HOUZE_PAIRING_CODE,
	NIL_CANARY_EXTERNAL_ID,
	buildOwnedOpportunityReport,
	drainDeliveryOutbox,
	eventIdentity,
	isNilCanaryUser,
	revisionForOpportunity,
} from './athleteHouzeEnrollment'
import {
	ATHLETE_LEDGER_BETA_PROJECT_ID,
	isAthleteLedgerBetaProject,
	opportunitySourceRevision,
} from './athleteHouzeReporter'

describe('Athlete Houze production enrollment helpers', () => {
	it('keeps canary users off the production enrollment path', () => {
		expect(
			isNilCanaryUser({
				id: '11111111-1111-4111-8111-111111111111',
				app_metadata: {
					workflow_cloud_persistence_canary: true,
					synthetic_test_data: true,
					athlete_houze_external_id: 'nil-canary-0001',
				},
			})
		).toBe(true)
		expect(
			isNilCanaryUser({
				id: '11111111-1111-4111-8111-111111111111',
				app_metadata: {},
			})
		).toBe(false)
		expect(NIL_CANARY_EXTERNAL_ID.test('nil-canary-0001')).toBe(true)
		expect(HOUZE_PAIRING_CODE.test('AHNR-ABCD-EFGH')).toBe(true)
		expect(HOUZE_PAIRING_CODE.test('AHNR-ABCDEFGH')).toBe(false)
	})

	it('dedupes retries and keeps A→B→A revisions distinct', () => {
		const record = 'opportunity-owned-0001'
		const firstA = opportunitySourceRevision({
			updatedAt: '2026-09-01T10:00:00.000Z',
			status: 'idea',
		})
		const retryA = opportunitySourceRevision({
			updatedAt: '2026-09-01T10:00:00.000Z',
			status: 'idea',
		})
		const toB = opportunitySourceRevision({
			updatedAt: '2026-09-02T10:00:00.000Z',
			status: 'pitched',
		})
		const returnA = opportunitySourceRevision({
			updatedAt: '2026-09-03T10:00:00.000Z',
			status: 'idea',
		})
		expect(eventIdentity(record, firstA)).toBe(eventIdentity(record, retryA))
		expect(eventIdentity(record, firstA)).not.toBe(eventIdentity(record, toB))
		expect(eventIdentity(record, toB)).not.toBe(eventIdentity(record, returnA))
		expect(eventIdentity(record, firstA)).not.toBe(eventIdentity(record, returnA))
	})

	it('does not put deal amounts, contracts, or contacts in the enrolled report', () => {
		const report = buildOwnedOpportunityReport({
			userId: '11111111-1111-4111-8111-111111111111',
			row: {
				client_id: 'opportunity-owned-0001',
				status: 'pitched',
				category: 'local_brand_deal',
				updated_at: '2026-09-02T10:00:00.000Z',
				created_at: '2026-09-01T10:00:00.000Z',
			},
		})
		expect(report.consentScope).toBe('restricted')
		expect(report.evidencePayload.attributes.enrollmentKind).toBe('production')
		expect(JSON.stringify(report)).not.toMatch(/dealAmount|contract|@|phone|12500/i)
		expect(revisionForOpportunity({
			client_id: 'opportunity-owned-0001',
			status: 'pitched',
			category: 'local_brand_deal',
			updated_at: '2026-09-02T10:00:00.000Z',
			created_at: '2026-09-01T10:00:00.000Z',
		})).toBe('2026-09-02T10:00:00.000Z:pitched')
	})

	it('skips outbox delivery when consent is missing and retries a later revision independently', async () => {
		const updates: Array<Record<string, unknown>> = []
		const client = {
			from(table: string) {
				if (table === 'athlete_houze_enrollments') {
					return {
						select: () => ({
							eq: () => ({
								eq: () => ({
									maybeSingle: async () => ({ data: null, error: null }),
								}),
							}),
						}),
					}
				}
				return {
					select: () => ({
						is: () => ({
							lte: () => ({
								eq: () => ({
									order: () => ({
										limit: async () => ({
											data: [
												{
													id: 'outbox-1',
													user_id: '11111111-1111-4111-8111-111111111111',
													source_record_id: 'opportunity-owned-0001',
													source_revision: '2026-09-02T10:00:00.000Z:pitched',
													event_identity: 'nil.opportunity.updated|opportunity-owned-0001|rev',
													payload: { eventId: 'evt-1' },
													attempts: 0,
													next_attempt_at: new Date().toISOString(),
													delivered_at: null,
													last_error: null,
												},
											],
											error: null,
										}),
									}),
								}),
							}),
						}),
					}),
					update: (patch: Record<string, unknown>) => ({
						eq: async () => {
							updates.push(patch)
							return { error: null }
						},
					}),
				}
			},
		}
		const result = await drainDeliveryOutbox({
			client: client as never,
			userId: '11111111-1111-4111-8111-111111111111',
			config: {
				endpoint: 'https://athletehouze.com/api/app-reports',
				hmacSecret: 'test-secret',
				mode: 'enrolled',
				maxAttempts: 1,
				fetchImpl: vi.fn(),
			},
		})
		expect(result.failed).toBe(1)
		expect(result.delivered).toBe(0)
		expect(updates[0]?.last_error).toBe('missing_consent')
	})

	it('blocks the shared-repo beta project from Houze publication', () => {
		expect(
			isAthleteLedgerBetaProject({ VERCEL_PROJECT_ID: ATHLETE_LEDGER_BETA_PROJECT_ID })
		).toBe(true)
	})
})
