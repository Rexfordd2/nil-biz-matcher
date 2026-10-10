import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { loadAthleteHouzeEnrolledReporterConfig } from '../../_lib/athleteHouzeReporter.js'
import {
	bearerToken,
	createServiceClient,
	createUserClient,
	drainDeliveryOutbox,
	enrolledDeliveryBlocked,
	loadActiveEnrollment,
	supabaseAnonCredentials,
} from '../../_lib/athleteHouzeEnrollment.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
	res.setHeader('Cache-Control', 'no-store')
	if (req.method !== 'POST' && req.method !== 'GET') {
		res.setHeader('Allow', 'GET, POST')
		return res.status(405).json({ error: 'method_not_allowed' })
	}

	if (enrolledDeliveryBlocked()) {
		return res.status(204).end()
	}

	const config = loadAthleteHouzeEnrolledReporterConfig()
	if (!config) return res.status(204).end()

	const accessToken = bearerToken(req.headers.authorization)
	if (accessToken) {
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
		const enrollment = await loadActiveEnrollment(userClient, authData.user.id)
		if (!enrollment) return res.status(204).end()
		const result = await drainDeliveryOutbox({
			client: userClient,
			userId: authData.user.id,
			config,
		})
		return res.status(200).json({ ok: true, ...result })
	}

	if (req.method !== 'GET') return res.status(401).json({ error: 'Unauthorized' })

	const service = createServiceClient()
	if (!service) return res.status(204).end()

	const result = await drainDeliveryOutbox({ client: service, config, limit: 50 })
	return res.status(200).json({ ok: true, ...result })
}
