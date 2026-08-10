import { createHash, createHmac } from 'node:crypto'

export type DeliveryResult =
	| { ok: true; status: number; body: unknown; attempts: number }
	| {
			ok: false
			status: number | null
			error: string
			permanent: boolean
			attempts: number
	  }

export type ReporterConfig = {
	endpoint: string
	hmacSecret: string
	mode: 'canary'
	canaryExternalAthleteId: string
	maxAttempts?: number
	fetchImpl?: typeof fetch
}

type ReporterEnvironment = Readonly<Record<string, string | undefined>>

export type NilRosterOpportunityReport = {
	externalAthleteId: string
	sourceRecordId: string
	occurredAt: string
	status: string
	category: string
	environment?: 'local' | 'test' | 'staging' | 'preview' | 'production'
}

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function isPermanentStatus(status: number): boolean {
	return status === 400 || status === 401 || status === 403 || status === 413
}

export function loadAthleteHouzeReporterConfig(
	env: ReporterEnvironment = process.env
): ReporterConfig | null {
	const endpoint = env.ATHLETE_HOUZE_REPORT_URL?.trim()
	const hmacSecret = env.ATHLETE_HOUZE_REPORT_HMAC_SECRET?.trim()
	const mode = env.ATHLETE_HOUZE_REPORTING_MODE?.trim().toLowerCase()
	const canaryExternalAthleteId =
		env.ATHLETE_HOUZE_REPORT_CANARY_EXTERNAL_ID?.trim()
	if (!endpoint || !hmacSecret || mode !== 'canary' || !canaryExternalAthleteId) {
		return null
	}
	return { endpoint, hmacSecret, mode: 'canary', canaryExternalAthleteId }
}

export function signAthleteHouzeBody(
	rawBody: string,
	timestampSeconds: number,
	secret: string
): string {
	return createHmac('sha256', secret)
		.update(`${timestampSeconds}.`)
		.update(rawBody)
		.digest('hex')
}

export async function sendAthleteHouzeReport(
	report: Record<string, unknown>,
	config: ReporterConfig
): Promise<DeliveryResult> {
	const rawBody = JSON.stringify(report)
	const fetchImpl = config.fetchImpl ?? fetch
	const maxAttempts = config.maxAttempts ?? 4
	let attempts = 0

	while (attempts < maxAttempts) {
		attempts += 1
		const timestamp = Math.floor(Date.now() / 1000)
		const signature = signAthleteHouzeBody(rawBody, timestamp, config.hmacSecret)

		try {
			const response = await fetchImpl(config.endpoint, {
				method: 'POST',
				headers: {
					accept: 'application/json',
					'content-type': 'application/json',
					'x-ah-timestamp': String(timestamp),
					'x-ah-signature': `sha256=${signature}`,
				},
				body: rawBody,
			})
			const responseText = await response.text()
			let body: unknown = null
			try {
				body = responseText ? JSON.parse(responseText) : null
			} catch {
				body = null
			}

			if (response.ok) return { ok: true, status: response.status, body, attempts }
			if (isPermanentStatus(response.status)) {
				return {
					ok: false,
					status: response.status,
					error: `permanent_${response.status}`,
					permanent: true,
					attempts,
				}
			}
			if (attempts >= maxAttempts) {
				return {
					ok: false,
					status: response.status,
					error: `temporary_${response.status}`,
					permanent: false,
					attempts,
				}
			}
		} catch (error) {
			if (attempts >= maxAttempts) {
				return {
					ok: false,
					status: null,
					error: error instanceof Error ? error.name : 'network_error',
					permanent: false,
					attempts,
				}
			}
		}

		await sleep(Math.min(8_000, 250 * 2 ** (attempts - 1)))
	}

	return { ok: false, status: null, error: 'exhausted', permanent: false, attempts }
}

export function buildNilRosterOpportunityReport(input: NilRosterOpportunityReport) {
	const idempotencyDigest = createHash('sha256')
		.update(
			[
				'nil.opportunity.updated',
				input.externalAthleteId,
				input.sourceRecordId,
				input.status,
				input.category,
			].join('|')
		)
		.digest('hex')
		.slice(0, 40)
	const reportedAt = new Date().toISOString()

	return {
		schemaVersion: '1.0.0',
		eventId: `nil-opportunity-${idempotencyDigest}`,
		eventType: 'nil.opportunity.updated',
		sourceSystem: 'nil_roster',
		sourceEnvironment: input.environment ?? 'production',
		externalAthleteId: input.externalAthleteId,
		occurredAt: input.occurredAt,
		receivedAt: reportedAt,
		sourceRecordId: input.sourceRecordId,
		evidenceCategory: 'nil_readiness',
		verificationStatus: 'source_attested',
		consentScope: 'support_team',
		idempotencyKey: `nil_roster:${idempotencyDigest}`,
		evidencePayload: {
			title: 'NIL opportunity updated',
			metrics: {
				status: input.status,
				category: input.category,
			},
			domainHints: ['nil_market'],
			attributes: { synthetic_test_data: true },
		},
		units: {},
		provenance: {
			sourceReferences: [
				{ type: 'nil_roster_opportunity', id: input.sourceRecordId },
			],
			deviceOrSystem: 'nil-roster',
		},
		confidence: { dataQuality: 'high' },
	}
}

export function sourceEnvironment(
	env: ReporterEnvironment = process.env
): NilRosterOpportunityReport['environment'] {
	if (env.VERCEL_ENV === 'production') return 'production'
	if (env.VERCEL_ENV === 'preview') return 'preview'
	if (env.NODE_ENV === 'test') return 'test'
	return 'local'
}
