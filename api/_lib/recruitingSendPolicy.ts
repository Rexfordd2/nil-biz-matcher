import { createHash, randomUUID } from 'node:crypto'

/**
 * Server-side authorization for real recruiting email sends.
 *
 * Real sends require ALL of:
 * - RECRUITING_EMAIL_SEND_ENABLED=true (explicit server-side flag, default off)
 * - an authenticated Supabase user (public-mode auth bypass never qualifies)
 * - an admin-controlled app_metadata.recruiting_email_send claim of
 *   'adult_verified' or 'operator' (user_metadata is user-writable and is never trusted)
 * - no minor markers on the account
 * - exactly one recipient per request, confirmed by echoing that recipient's email
 */

export const RECRUITING_EMAIL_SEND_FLAG = 'RECRUITING_EMAIL_SEND_ENABLED'
export const RECRUITING_SEND_CLAIM = 'recruiting_email_send'
export const PERMITTED_SEND_CONTEXTS = ['adult_verified', 'operator'] as const

export type PermittedSendContext = (typeof PERMITTED_SEND_CONTEXTS)[number]

export type SendPolicyUser = {
	id: string
	email?: string | null
	app_metadata?: Record<string, unknown> | null
	user_metadata?: Record<string, unknown> | null
}

export type SendDenialReason =
	| 'flag_off'
	| 'unauthenticated'
	| 'minor_account'
	| 'not_permitted'

export type SendPermission =
	| { allowed: true; context: PermittedSendContext }
	| { allowed: false; reason: SendDenialReason }

type Env = Readonly<Record<string, string | undefined>>

export function isRecruitingEmailSendFlagEnabled(env: Env = process.env): boolean {
	return String(env[RECRUITING_EMAIL_SEND_FLAG] || '').trim().toLowerCase() === 'true'
}

export function isMinorAccount(user: SendPolicyUser): boolean {
	const app = user.app_metadata || {}
	const meta = user.user_metadata || {}
	return (
		app.minor === true ||
		app.guardian_required === true ||
		meta.role === 'athlete_under_18' ||
		meta.onboardingRole === 'athlete_under_18' ||
		meta.guardianRequired === true
	)
}

export function permittedSendContext(user: SendPolicyUser): PermittedSendContext | null {
	const claim = user.app_metadata?.[RECRUITING_SEND_CLAIM]
	return (PERMITTED_SEND_CONTEXTS as readonly unknown[]).includes(claim)
		? (claim as PermittedSendContext)
		: null
}

export function evaluateRecruitingSendPermission(input: {
	env?: Env
	user: SendPolicyUser | null
}): SendPermission {
	if (!isRecruitingEmailSendFlagEnabled(input.env)) return { allowed: false, reason: 'flag_off' }
	const user = input.user
	if (!user || typeof user.id !== 'string' || !user.id) {
		return { allowed: false, reason: 'unauthenticated' }
	}
	if (isMinorAccount(user)) return { allowed: false, reason: 'minor_account' }
	const context = permittedSendContext(user)
	if (!context) return { allowed: false, reason: 'not_permitted' }
	return { allowed: true, context }
}

const EMAIL_PATTERN = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/

export function normalizeEmail(value: unknown): string {
	return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export type SingleRecipient = { name: string; email: string }

export type RecipientValidation =
	| { ok: true; recipient: SingleRecipient }
	| { ok: false; error: string }

/**
 * Accepts `coach` (preferred) or a one-element `coaches` array. Multi-recipient
 * payloads are rejected so each send is individually confirmed.
 */
export function validateConfirmedSingleRecipient(body: unknown): RecipientValidation {
	const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
	const list = Array.isArray(b.coaches) ? b.coaches : null
	if (list && list.length > 1) {
		return { ok: false, error: 'One recipient per send. Confirm each coach individually.' }
	}
	if (Array.isArray(b.coachIds) && b.coachIds.length > 1) {
		return { ok: false, error: 'One recipient per send. Confirm each coach individually.' }
	}
	const raw = (b.coach ?? list?.[0]) as { name?: unknown; email?: unknown } | undefined
	const email = normalizeEmail(raw?.email)
	if (!email || !EMAIL_PATTERN.test(email)) {
		return { ok: false, error: 'A single valid recipient email is required' }
	}
	const confirmed = normalizeEmail(b.confirmRecipientEmail)
	if (!confirmed || confirmed !== email) {
		return { ok: false, error: 'Recipient confirmation is required for each send' }
	}
	const name = typeof raw?.name === 'string' ? raw.name.trim().slice(0, 120) : ''
	return { ok: true, recipient: { name, email } }
}

export type SendAuditOutcome = 'sent' | 'failed' | 'denied'

export type SendAuditRecord = {
	auditId: string
	event: 'recruiting_email_send'
	at: string
	userId: string | null
	outcome: SendAuditOutcome
	context: PermittedSendContext | null
	recipientDomain: string | null
	recipientHash: string | null
	reason?: string
	messageId?: string
}

export function buildSendAuditRecord(input: {
	userId: string | null
	outcome: SendAuditOutcome
	context?: PermittedSendContext | null
	recipientEmail?: string | null
	reason?: string
	messageId?: string
	now?: Date
}): SendAuditRecord {
	const email = normalizeEmail(input.recipientEmail)
	const record: SendAuditRecord = {
		auditId: randomUUID(),
		event: 'recruiting_email_send',
		at: (input.now ?? new Date()).toISOString(),
		userId: input.userId,
		outcome: input.outcome,
		context: input.context ?? null,
		recipientDomain: email.includes('@') ? email.split('@')[1] : null,
		recipientHash: email ? createHash('sha256').update(email).digest('hex').slice(0, 24) : null,
	}
	if (input.reason) record.reason = input.reason
	if (input.messageId) record.messageId = input.messageId
	return record
}

export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}
