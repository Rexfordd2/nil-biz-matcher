import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'
import { prisma } from '../_lib/prisma'
import { sendMail, getEmailTransporter } from '../_lib/email'
import { getAuthenticatedSupabaseUser } from '../_lib/getAuthenticatedSupabaseUser'

type CoachInput = { name: string; email: string; id?: string }
type AthleteInput = { fullName: string; email: string; id?: string }

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method Not Allowed' })
	}

	// Authenticate user (or bypass in public mode)
	const { bypassed, user: authedUser } = await getAuthenticatedSupabaseUser(req, res)
	
	// If not in public mode and not authenticated, reject
	if (!bypassed && !authedUser) {
		return res.status(401).json({ error: 'Unauthorized - authentication required' })
	}

	const appUrl = process.env.APP_URL
	if (!appUrl) {
		return res.status(500).json({ error: 'Server not configured (APP_URL required)' })
	}

	const { athlete, clipUrl, coaches, subject, body, coachIds, clipId } = (req.body || {}) as {
		athlete: AthleteInput
		clipUrl: string
		coaches: CoachInput[]
		subject: string
		body: string
		coachIds?: string[]
		clipId?: string
	}

	if (!athlete?.fullName || !athlete?.email) {
		return res.status(400).json({ error: 'Missing athlete.fullName or athlete.email' })
	}
	if (!subject || !body) {
		return res.status(400).json({ error: 'Missing subject or body' })
	}

	const baseTrackingUrl = `${appUrl.replace(/\/+$/, '')}/api/recruiting/track`

	try {
		// Ensure SMTP is configured (throws if not); return a clear error without crashing
		try {
			getEmailTransporter()
		} catch (e: any) {
			// Prior behavior returned 500; return 503 so UI can display a clear "not configured" message.
			return res.status(503).json({ error: 'Email not configured' })
		}

		// If prisma-style inputs provided (athlete.id, clipId, coachIds), use DB
		if (prisma && athlete?.id && clipId && Array.isArray(coachIds) && coachIds.length > 0) {
			// Verify ownership: athlete.id must match authenticated user (unless bypassed)
			if (!bypassed && authedUser && athlete.id !== authedUser.id) {
				return res.status(403).json({ error: 'Forbidden - athlete ID does not match authenticated user' })
			}

			const clip = await prisma.highlightClip.findUnique({ where: { id: clipId } })
			if (!clip) return res.status(404).json({ error: 'Clip not found' })

			// Verify ownership: clip must belong to the athlete (unless bypassed)
			if (!bypassed && authedUser && clip.athleteId !== authedUser.id) {
				return res.status(403).json({ error: 'Forbidden - clip does not belong to authenticated user' })
			}

			const dbCoaches = await prisma.coach.findMany({ where: { id: { in: coachIds } } })
			for (const coach of dbCoaches) {
				const trackToken = crypto.randomBytes(16).toString('hex')
				const outreach = await prisma.outreach.create({
					data: {
						athleteId: athlete.id!,
						clipId: clip.id,
						coachId: coach.id,
						subject,
						body,
						trackToken,
						status: 'sent'
					}
				})
				const openPixelUrl = `${baseTrackingUrl}?type=open&token=${trackToken}`
				const clickRedirectUrl = `${baseTrackingUrl}?type=click&token=${trackToken}&url=${encodeURIComponent(clip.videoUrl)}`
				const profileLink = `${appUrl.replace(/\/+$/, '')}`
				const html = `
					<p>Coach ${coach.name || ''},</p>
					<p>${body}</p>
					<p><a href="${clickRedirectUrl}">Watch my highlight</a></p>
					<p>View my NIL Roster profile: <a href="${profileLink}">${profileLink}</a></p>
					<img src="${openPixelUrl}" width="1" height="1" style="display:none;" alt="" />
				`
				await sendMail({ from: `"${athlete.fullName}" <${athlete.email}>`, to: coach.email, subject, html })
			}
			return res.status(200).json({ success: true, sent: dbCoaches.length })
		}

		// Fallback: raw email inputs (no DB persistence)
		if (!clipUrl) return res.status(400).json({ error: 'Missing clipUrl' })
		if (!Array.isArray(coaches) || coaches.length === 0) return res.status(400).json({ error: 'No coaches provided' })
		for (const coach of coaches) {
			const trackToken = crypto.randomBytes(16).toString('hex')
			const openPixelUrl = `${baseTrackingUrl}?type=open&token=${trackToken}`
			const clickRedirectUrl = `${baseTrackingUrl}?type=click&token=${trackToken}&url=${encodeURIComponent(clipUrl)}`
			const profileLink = `${appUrl.replace(/\/+$/, '')}`
			const html = `
				<p>Coach ${coach.name || ''},</p>
				<p>${body}</p>
				<p><a href="${clickRedirectUrl}">Watch my highlight</a></p>
				<p>View my NIL Roster profile: <a href="${profileLink}">${profileLink}</a></p>
				<img src="${openPixelUrl}" width="1" height="1" style="display:none;" alt="" />
			`
			await sendMail({ from: `"${athlete.fullName}" <${athlete.email}>`, to: coach.email, subject, html })
		}
		return res.status(200).json({ success: true, sent: (coaches || []).length })
	} catch (err: any) {
		// eslint-disable-next-line no-console
		console.error('Send error:', err)
		return res.status(500).json({ error: 'Failed to send emails' })
	}
}

