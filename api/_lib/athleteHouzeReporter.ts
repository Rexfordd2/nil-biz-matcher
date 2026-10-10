import { createHash, createHmac } from 'node:crypto'

export const ATHLETE_LEDGER_PRODUCTION_PROJECT_ID = 'prj_h2A1iIMWow5RMu3qTPyrR9NTnZEy'
export const ATHLETE_LEDGER_BETA_PROJECT_ID = 'prj_WTkyOHR07dtGS1TOIlk94WoBNmfK'

export type DeliveryResult =
	| { ok: true; status: number; body: unknown; attempts: number }
	| {
			ok: false
			status: number | null
			error: string
			permanent: boolean
			attempts: number
	  }

export type CanaryReporterConfig = {
	endpoint: string
	hmacSecret: string
	mode: 'canary'
	canaryExternalAthleteId: string
	maxAttempts?: number
	fetchImpl?: typeof fetch
}

export type EnrolledReporterConfig = {
	endpoint: string
	hmacSecret: string
	mode: 'enrolled'
	maxAttempts?: number
	fetchImpl?: typeof fetch
}

export type ReporterConfig = CanaryReporterConfig | EnrolledReporterConfig

type ReporterEnvironment = Readonly<Record<string, string | undefined>>

export type NilRosterOpportunityReport = {
	externalAthleteId: string
	sourceRecordId: string
	/** Stable source row revision; retries retain the same value. */
	sourceRevision: string
	occurredAt: string
	status: string
	category: string
	environment?: 'local' | 'test' | 'staging' | 'preview' | 'production'
	enrollmentKind?: 'canary' | 'production'
}

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function isPermanentStatus(status: number): boolean {
	return status === 400 || status === 401 || status === 403 || status === 413
}

export function isAthleteLedgerBetaProject(
	env: ReporterEnvironment = process.env
): boolean {
	const projectId = env.VERCEL_PROJECT_ID?.trim()
	const allowed =
		env.ATHLETE_HOUZE_ALLOWED_PROJECT_ID?.trim() || ATHLETE_LEDGER_PRODUCTION_PROJECT_ID
	if (projectId === ATHLETE_LEDGER_BETA_PROJECT_ID) return true
	if (projectId && projectId !== allowed) return true
	return false
}

export function isAllowedHouzeEndpoint(
	endpoint: string,
	env: ReporterEnvironment = process.env
): boolean {
	try {
		const url = new URL(endpoint)
		const host = url.hostname.toLowerCase()
		if (host === 'beta.athletehouze.com') return false
		const path = url.pathname.replace(/\/$/, '')
		if (env.NODE_ENV === 'test' || env.ATHLETE_HOUZE_ALLOW_LOCAL_ENDPOINT === 'true') {
			const localHost =
				host === 'localhost' ||
				host === '127.0.0.1' ||
				host === 'athletehouze.com' ||
				host === 'www.athletehouze.com' ||
				host.endsWith('.test') ||
				host.endsWith('.vercel.app')
			return (url.protocol === 'http:' || url.protocol === 'https:') && localHost
		}
		return (
			url.protocol === 'https:' &&
			(host === 'athletehouze.com' || host === 'www.athletehouze.com') &&
			path === '/api/app-reports'
		)
	} catch {
		return false
	}
}

/**
 * Synthetic canary only. Production enrollment uses
 * `loadAthleteHouzeEnrolledReporterConfig`.
 */
export function loadAthleteHouzeReporterConfig(
	env: ReporterEnvironment = process.env
): CanaryReporterConfig | null {
	if (isAthleteLedgerBetaProject(env)) return null
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

export function loadAthleteHouzeEnrolledReporterConfig(
	env: ReporterEnvironment = process.env
): EnrolledReporterConfig | null {
	if (isAthleteLedgerBetaProject(env)) return null
	const endpoint = env.ATHLETE_HOUZE_REPORT_URL?.trim()
	const hmacSecret = env.ATHLETE_HOUZE_REPORT_HMAC_SECRET?.trim()
	const mode = env.ATHLETE_HOUZE_REPORTING_MODE?.trim().toLowerCase()
	if (!endpoint || !hmacSecret || mode !== 'enrolled') return null
	if (!isAllowedHouzeEndpoint(endpoint, env)) return null
	return { endpoint, hmacSecret, mode: 'enrolled' }
}

/** Stable revision for retries; status suffix keeps A→B→A distinct if timestamps collide. */
export function opportunitySourceRevision(input: {
	updatedAt: string
	status: string
}): string {
	return `${input.updatedAt}:${input.status}`
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
					...(config.mode === 'enrolled' ? { 'x-ah-source': 'nil_roster' } : {}),
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
	const revision = input.sourceRevision.trim()
	if (!revision || revision.length > 120) throw new Error('Missing or invalid source revision')
	const enrollmentKind =
		input.enrollmentKind ??
		(input.externalAthleteId.startsWith('nil-canary-') ? 'canary' : 'production')
	const isCanary = enrollmentKind === 'canary'
	// Canary keeps athlete-scoped digests; enrolled uses source record + revision only.
	const digestParts = isCanary
		? ['nil.opportunity.updated', input.externalAthleteId, input.sourceRecordId, revision]
		: ['nil.opportunity.updated', input.sourceRecordId, revision]
	const idempotencyDigest = createHash('sha256')
		.update(digestParts.join('|'))
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
		evidenceCategory: isCanary ? 'nil_readiness' : 'brand_nil',
		verificationStatus: 'source_attested',
		consentScope: isCanary ? 'support_team' : 'restricted',
		idempotencyKey: `nil_roster:${idempotencyDigest}`,
		evidencePayload: {
			title: 'NIL opportunity updated',
			summary: isCanary
				? undefined
				: 'Opportunity activity recorded. Not athletic merit and not guaranteed earnings.',
			metrics: {
				status: input.status,
				category: input.category,
			},
			domainHints: ['nil_market'],
			attributes: {
				sourceRevision: revision,
				enrollmentKind,
				...(isCanary
					? { synthetic_test_data: true }
					: { notAthleticMerit: true, notGuaranteedEarnings: true }),
			},
		},
		units: {},
		provenance: {
			sourceReferences: [
				{ type: 'nil_roster_opportunity', id: input.sourceRecordId },
			],
			deviceOrSystem: 'nil-roster',
			...(isCanary ? {} : { sourceRecordId: input.sourceRecordId }),
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
