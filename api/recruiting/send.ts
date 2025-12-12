import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'
import { prisma } from '../_lib/prisma.js'
import { sendMail, getEmailTransporter } from '../_lib/email.js'

type CoachInput = { name: string; email: string; id?: string }
type AthleteInput = { fullName: string; email: string; id?: string }

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method Not Allowed' })
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
			const clip = await prisma.highlightClip.findUnique({ where: { id: clipId } })
			if (!clip) return res.status(404).json({ error: 'Clip not found' })
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
					<p>View my Athlete Ledger profile: <a href="${profileLink}">${profileLink}</a></p>
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
				<p>View my Athlete Ledger profile: <a href="${profileLink}">${profileLink}</a></p>
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


