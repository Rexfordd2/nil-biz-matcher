import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '../_lib/prisma'
import { sendMail, getEmailTransporter } from '../_lib/email'
import { getAuthenticatedSupabaseUser } from '../_lib/getAuthenticatedSupabaseUser'
import {
	buildSendAuditRecord,
	escapeHtml,
	evaluateRecruitingSendPermission,
	isRecruitingEmailSendFlagEnabled,
	normalizeEmail,
	validateConfirmedSingleRecipient,
	type SendAuditRecord,
	type SendPolicyUser,
} from '../_lib/recruitingSendPolicy'

function bearerToken(req: VercelRequest): string | null {
	const header = Array.isArray(req.headers.authorization)
		? req.headers.authorization[0]
		: req.headers.authorization
	const match = header?.match(/^Bearer\s+(.+)$/i)
	return match?.[1]?.trim() || null
}

/**
 * Resolve the Supabase user from a Bearer access token or the SSR auth cookie.
 * Public-mode auth bypass resolves to null: it never authorizes a real send.
 */
async function resolveUser(req: VercelRequest, res: VercelResponse): Promise<SendPolicyUser | null> {
	const token = bearerToken(req)
	if (token) {
		const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
		const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
		if (!supabaseUrl || !supabaseAnonKey) return null
		try {
			const sb = createClient(supabaseUrl, supabaseAnonKey, {
				auth: { persistSession: false, autoRefreshToken: false },
			})
			const { data, error } = await sb.auth.getUser(token)
			if (error || !data.user) return null
			return data.user as SendPolicyUser
		} catch {
			return null
		}
	}
	const { bypassed, user } = await getAuthenticatedSupabaseUser(req, res)
	if (bypassed || !user) return null
	return user
}

function audit(record: SendAuditRecord): SendAuditRecord {
	// eslint-disable-next-line no-console
	console.info(`[recruiting-send-audit] ${JSON.stringify(record)}`)
	return record
}

function buildHtml(input: { coachName: string; body: string; clickUrl: string; profileLink: string; openPixelUrl: string }) {
	const paragraphs = escapeHtml(input.body).replace(/\r?\n/g, '<br />')
	return `
		<p>Coach ${escapeHtml(input.coachName)},</p>
		<p>${paragraphs}</p>
		<p><a href="${escapeHtml(input.clickUrl)}">Watch my highlight</a></p>
		<p>View my NIL Roster profile: <a href="${escapeHtml(input.profileLink)}">${escapeHtml(input.profileLink)}</a></p>
		<img src="${escapeHtml(input.openPixelUrl)}" width="1" height="1" style="display:none;" alt="" />
	`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	res.setHeader('Cache-Control', 'no-store')

	if (req.method === 'GET') {
		if (!isRecruitingEmailSendFlagEnabled()) {
			return res.status(200).json({ sendEnabled: false, reason: 'flag_off' })
		}
		const user = await resolveUser(req, res)
		const permission = evaluateRecruitingSendPermission({ user })
		return res.status(200).json(
			permission.allowed
				? { sendEnabled: true, context: permission.context }
				: { sendEnabled: false, reason: permission.reason }
		)
	}

	if (req.method !== 'POST') {
		res.setHeader('Allow', 'GET, POST')
		return res.status(405).json({ error: 'Method Not Allowed' })
	}

	const user = await resolveUser(req, res)
	if (!user) {
		return res.status(401).json({ error: 'Unauthorized - authentication required' })
	}

	const permission = evaluateRecruitingSendPermission({ user })
	if (!permission.allowed) {
		const record = audit(buildSendAuditRecord({ userId: user.id, outcome: 'denied', reason: permission.reason }))
		const error =
			permission.reason === 'flag_off'
				? 'Email sending is disabled. Use Outreach Drafts to copy and send from your own email.'
				: 'This account is not permitted to send recruiting email from NIL Roster.'
		return res.status(403).json({ error, reason: permission.reason, audit: record })
	}

	const recipientCheck = validateConfirmedSingleRecipient(req.body)
	if (!recipientCheck.ok) {
		return res.status(400).json({ error: recipientCheck.error })
	}
	const recipient = recipientCheck.recipient

	const appUrl = process.env.APP_URL
	if (!appUrl) {
		return res.status(500).json({ error: 'Server not configured (APP_URL required)' })
	}

	const { athlete, clipUrl, subject, body, coachIds, clipId } = (req.body || {}) as {
		athlete?: { fullName?: string; id?: string }
		clipUrl?: string
		subject?: string
		body?: string
		coachIds?: string[]
		clipId?: string
	}

	const senderEmail = normalizeEmail(user.email)
	const senderName = String(athlete?.fullName || '').trim().slice(0, 120)
	if (!senderName || !senderEmail) {
		return res.status(400).json({ error: 'Missing athlete.fullName or account email' })
	}
	if (!subject || !body) {
		return res.status(400).json({ error: 'Missing subject or body' })
	}

	try {
		getEmailTransporter()
	} catch {
		return res.status(503).json({ error: 'Email not configured' })
	}

	const baseTrackingUrl = `${appUrl.replace(/\/+$/, '')}/api/recruiting/track`
	const profileLink = `${appUrl.replace(/\/+$/, '')}`
	const trackToken = crypto.randomBytes(16).toString('hex')

	try {
		let videoUrl = clipUrl
		if (prisma && athlete?.id && clipId && Array.isArray(coachIds) && coachIds.length === 1) {
			if (athlete.id !== user.id) {
				return res.status(403).json({ error: 'Forbidden - athlete ID does not match authenticated user' })
			}
			const clip = await prisma.highlightClip.findUnique({ where: { id: clipId } })
			if (!clip) return res.status(404).json({ error: 'Clip not found' })
			if (clip.athleteId !== user.id) {
				return res.status(403).json({ error: 'Forbidden - clip does not belong to authenticated user' })
			}
			const coach = await prisma.coach.findUnique({ where: { id: coachIds[0] } })
			if (!coach || normalizeEmail(coach.email) !== recipient.email) {
				return res.status(400).json({ error: 'Recipient confirmation does not match coach record' })
			}
			await prisma.outreach.create({
				data: { athleteId: user.id, clipId: clip.id, coachId: coach.id, subject, body, trackToken, status: 'sent' },
			})
			videoUrl = clip.videoUrl
		}
		if (!videoUrl) return res.status(400).json({ error: 'Missing clipUrl' })

		const html = buildHtml({
			coachName: recipient.name,
			body,
			clickUrl: `${baseTrackingUrl}?type=click&token=${trackToken}&url=${encodeURIComponent(videoUrl)}`,
			profileLink,
			openPixelUrl: `${baseTrackingUrl}?type=open&token=${trackToken}`,
		})
		const info = await sendMail({ to: recipient.email, subject, html, replyTo: `"${senderName.replace(/"/g, '')}" <${senderEmail}>` })
		const record = audit(
			buildSendAuditRecord({
				userId: user.id,
				outcome: 'sent',
				context: permission.context,
				recipientEmail: recipient.email,
				messageId: typeof info?.messageId === 'string' ? info.messageId : undefined,
			})
		)
		return res.status(200).json({ success: true, sent: 1, audit: record })
	} catch (err: any) {
		const record = audit(
			buildSendAuditRecord({
				userId: user.id,
				outcome: 'failed',
				context: permission.context,
				recipientEmail: recipient.email,
				reason: 'smtp_error',
			})
		)
		// eslint-disable-next-line no-console
		console.error('Send error:', err)
		return res.status(500).json({ error: 'Failed to send email', audit: record })
	}
}
