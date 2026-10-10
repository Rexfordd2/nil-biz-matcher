import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { loadAthleteHouzeEnrolledReporterConfig } from '../../_lib/athleteHouzeReporter.js'
import {
	bearerToken,
	createUserClient,
	enrolledDeliveryBlocked,
	houzeServerDisconnectUrl,
	signedHouzeHeaders,
	supabaseAnonCredentials,
} from '../../_lib/athleteHouzeEnrollment.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
	res.setHeader('Cache-Control', 'no-store')
	if (req.method !== 'POST') {
		res.setHeader('Allow', 'POST')
		return res.status(405).json({ error: 'method_not_allowed' })
	}

	if (enrolledDeliveryBlocked()) {
		return res.status(403).json({ error: 'beta_project_blocked' })
	}

	const accessToken = bearerToken(req.headers.authorization)
	if (!accessToken) return res.status(401).json({ error: 'Unauthorized' })

	const creds = supabaseAnonCredentials()
	if (!creds) return res.status(503).json({ error: 'Integration unavailable' })

	const supabase = createClient(creds.url, creds.key, {
		auth: { persistSession: false, autoRefreshToken: false },
		global: { headers: { Authorization: `Bearer ${accessToken}` } },
	})
	const { data: authData, error: authError } = await supabase.auth.getUser(accessToken)
	if (authError || !authData.user) return res.status(401).json({ error: 'Unauthorized' })

	const userClient = createUserClient(accessToken)
	if (!userClient) return res.status(503).json({ error: 'Integration unavailable' })

	const { data: enrollment } = await userClient
		.from('athlete_houze_enrollments')
		.select('user_id, status')
		.eq('user_id', authData.user.id)
		.maybeSingle()

	const config = loadAthleteHouzeEnrolledReporterConfig()
	if (enrollment?.status === 'linked' && config) {
		const disconnectBody = JSON.stringify({
			externalAthleteId: authData.user.id,
		})
		await fetch(houzeServerDisconnectUrl(config.endpoint), {
			method: 'POST',
			headers: signedHouzeHeaders(config, disconnectBody),
			body: disconnectBody,
		}).catch(() => null)
	}

	await userClient
		.from('athlete_houze_enrollments')
		.update({
			status: 'disconnected',
			disconnected_at: new Date().toISOString(),
			last_error: null,
		})
		.eq('user_id', authData.user.id)

	return res.status(200).json({ ok: true, disconnected: true })
}
