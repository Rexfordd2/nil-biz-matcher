import type { User } from '@supabase/supabase-js'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
	buildNilRosterOpportunityReport,
	isAthleteLedgerBetaProject,
	loadAthleteHouzeEnrolledReporterConfig,
	opportunitySourceRevision,
	sendAthleteHouzeReport,
	signAthleteHouzeBody,
	sourceEnvironment,
	type EnrolledReporterConfig,
} from './athleteHouzeReporter.js'

export const NIL_CANARY_EXTERNAL_ID = /^nil-canary-[A-Za-z0-9._:-]+$/
export const HOUZE_PAIRING_CODE = /^AHNR-[A-Z2-9]{4}-[A-Z2-9]{4}$/

export type OpportunityRow = {
	client_id: string
	status: string
	category: string | null
	updated_at: string
	created_at: string
}

export type EnrollmentRow = {
	user_id: string
	houze_athlete_id: string
	consent_scope: string
	status: string
	connected_at: string
	disconnected_at: string | null
	last_sync_at: string | null
	last_error: string | null
}

export type OutboxRow = {
	id: string
	user_id: string
	source_record_id: string
	source_revision: string
	event_identity: string
	payload: Record<string, unknown>
	attempts: number
	next_attempt_at: string
	delivered_at: string | null
	last_error: string | null
}

export function supabaseAnonCredentials(): { url: string; key: string } | null {
	const url =
		process.env.VITE_SUPABASE_URL ||
		process.env.NEXT_PUBLIC_SUPABASE_URL ||
		process.env.SUPABASE_URL
	const key =
		process.env.VITE_SUPABASE_ANON_KEY ||
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
		process.env.SUPABASE_ANON_KEY
	if (!url || !key) return null
	return { url, key }
}

export function createUserClient(accessToken: string): SupabaseClient | null {
	const creds = supabaseAnonCredentials()
	if (!creds) return null
	return createClient(creds.url, creds.key, {
		auth: { persistSession: false, autoRefreshToken: false },
		global: { headers: { Authorization: `Bearer ${accessToken}` } },
	})
}

export function createServiceClient(): SupabaseClient | null {
	const url =
		process.env.SUPABASE_URL ||
		process.env.VITE_SUPABASE_URL ||
		process.env.NEXT_PUBLIC_SUPABASE_URL
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY
	if (!url || !key) return null
	return createClient(url, key, {
		auth: { persistSession: false, autoRefreshToken: false },
	})
}

export function bearerToken(header: string | string[] | undefined): string | null {
	const value = Array.isArray(header) ? header[0] : header
	const match = header && typeof value === 'string' ? value.match(/^Bearer\s+(.+)$/i) : null
	return match?.[1]?.trim() || null
}

export function isNilCanaryUser(user: {
	id: string
	app_metadata?: Record<string, unknown>
}): boolean {
	const metadata = user.app_metadata ?? {}
	const externalAthleteId = metadata.athlete_houze_external_id
	return (
		metadata.workflow_cloud_persistence_canary === true &&
		metadata.synthetic_test_data === true &&
		typeof externalAthleteId === 'string' &&
		NIL_CANARY_EXTERNAL_ID.test(externalAthleteId)
	)
}

export function canaryExternalAthleteId(user: {
	app_metadata?: Record<string, unknown>
}): string | null {
	const configured = user.app_metadata?.athlete_houze_external_id
	return typeof configured === 'string' && NIL_CANARY_EXTERNAL_ID.test(configured)
		? configured
		: null
}

export async function loadOwnedOpportunity(
	client: SupabaseClient,
	userId: string,
	clientId: string
): Promise<OpportunityRow | null> {
	const { data, error } = await client
		.from('opportunities')
		.select('client_id, status, category, updated_at, created_at')
		.eq('user_id', userId)
		.eq('client_id', clientId)
		.maybeSingle()
	if (error || !data) return null
	return data as OpportunityRow
}

export async function loadActiveEnrollment(
	client: SupabaseClient,
	userId: string
): Promise<EnrollmentRow | null> {
	const { data, error } = await client
		.from('athlete_houze_enrollments')
		.select(
			'user_id, houze_athlete_id, consent_scope, status, connected_at, disconnected_at, last_sync_at, last_error'
		)
		.eq('user_id', userId)
		.eq('status', 'linked')
		.maybeSingle()
	if (error || !data || data.disconnected_at) return null
	return data as EnrollmentRow
}

export function eventIdentity(sourceRecordId: string, sourceRevision: string): string {
	return `nil.opportunity.updated|${sourceRecordId}|${sourceRevision}`
}

export function revisionForOpportunity(row: OpportunityRow): string {
	return opportunitySourceRevision({
		updatedAt: row.updated_at || row.created_at,
		status: row.status,
	})
}

export function buildOwnedOpportunityReport(input: {
	userId: string
	row: OpportunityRow
}): ReturnType<typeof buildNilRosterOpportunityReport> {
	const sourceRevision = revisionForOpportunity(input.row)
	return buildNilRosterOpportunityReport({
		externalAthleteId: input.userId,
		sourceRecordId: input.row.client_id,
		sourceRevision,
		status: input.row.status,
		category: input.row.category || 'other',
		occurredAt: input.row.updated_at || rowOccurredFallback(input.row),
		environment: sourceEnvironment(),
		enrollmentKind: 'production',
	})
}

function rowOccurredFallback(row: OpportunityRow): string {
	return row.created_at
}

export async function enqueueOwnedOpportunityDelivery(input: {
	client: SupabaseClient
	userId: string
	row: OpportunityRow
}): Promise<{ eventIdentity: string; sourceRevision: string }> {
	const sourceRevision = revisionForOpportunity(input.row)
	const identity = eventIdentity(input.row.client_id, sourceRevision)
	const report = buildOwnedOpportunityReport({ userId: input.userId, row: input.row })
	const { error } = await input.client.from('athlete_houze_delivery_outbox').upsert(
		{
			user_id: input.userId,
			source_record_id: input.row.client_id,
			source_revision: sourceRevision,
			event_identity: identity,
			payload: report,
			next_attempt_at: new Date().toISOString(),
			last_error: null,
		},
		{ onConflict: 'event_identity' }
	)
	if (error) throw new Error(error.message)
	return { eventIdentity: identity, sourceRevision }
}

export async function markEnrollmentSync(
	client: SupabaseClient,
	userId: string,
	patch: { last_sync_at?: string; last_error?: string | null }
) {
	await client.from('athlete_houze_enrollments').update(patch).eq('user_id', userId)
}

export async function drainDeliveryOutbox(input: {
	client: SupabaseClient
	userId?: string
	config: EnrolledReporterConfig
	limit?: number
}): Promise<{ delivered: number; pending: number; failed: number }> {
	let query = input.client
		.from('athlete_houze_delivery_outbox')
		.select(
			'id, user_id, source_record_id, source_revision, event_identity, payload, attempts, next_attempt_at, delivered_at, last_error'
		)
		.is('delivered_at', null)
		.lte('next_attempt_at', new Date().toISOString())
	if (input.userId) query = query.eq('user_id', input.userId)
	const { data, error } = await query
		.order('next_attempt_at', { ascending: true })
		.limit(input.limit ?? 20)
	if (error) throw new Error(error.message)
	const rows = (data ?? []) as OutboxRow[]
	let delivered = 0
	let failed = 0
	for (const row of rows) {
		const enrollment = await loadActiveEnrollment(input.client, row.user_id)
		if (!enrollment) {
			await input.client
				.from('athlete_houze_delivery_outbox')
				.update({
					last_error: 'missing_consent',
					next_attempt_at: new Date(Date.now() + 86_400_000).toISOString(),
					attempts: row.attempts + 1,
				})
				.eq('id', row.id)
			failed += 1
			continue
		}
		const result = await sendAthleteHouzeReport(row.payload, input.config)
		const attempts = row.attempts + 1
		if (result.ok) {
			await input.client
				.from('athlete_houze_delivery_outbox')
				.update({
					delivered_at: new Date().toISOString(),
					attempts,
					last_error: null,
				})
				.eq('id', row.id)
			delivered += 1
			await markEnrollmentSync(input.client, row.user_id, {
				last_sync_at: new Date().toISOString(),
				last_error: null,
			})
			continue
		}
		failed += 1
		const nextDelayMs = result.permanent ? 86_400_000 : Math.min(300_000, 1_000 * 2 ** attempts)
		await input.client
			.from('athlete_houze_delivery_outbox')
			.update({
				attempts,
				last_error: result.error,
				next_attempt_at: new Date(Date.now() + nextDelayMs).toISOString(),
			})
			.eq('id', row.id)
		await markEnrollmentSync(input.client, row.user_id, {
			last_error: result.permanent ? result.error : 'houze_delivery_retrying',
		})
	}
	return { delivered, pending: rows.length - delivered - failed, failed }
}

export function houzeCompleteLinkUrl(endpoint: string): string {
	return new URL('/api/integrations/nil-roster/complete-link', endpoint).toString()
}

export function houzeServerDisconnectUrl(endpoint: string): string {
	return new URL('/api/integrations/nil-roster/server-disconnect', endpoint).toString()
}

export function signedHouzeHeaders(config: EnrolledReporterConfig, rawBody: string) {
	const timestamp = Math.floor(Date.now() / 1000)
	return {
		accept: 'application/json',
		'content-type': 'application/json',
		'x-ah-timestamp': String(timestamp),
		'x-ah-signature': `sha256=${signAthleteHouzeBody(rawBody, timestamp, config.hmacSecret)}`,
		'x-ah-source': 'nil_roster',
	}
}

export function enrolledDeliveryBlocked(): boolean {
	return isAthleteLedgerBetaProject()
}

export { loadAthleteHouzeEnrolledReporterConfig }
