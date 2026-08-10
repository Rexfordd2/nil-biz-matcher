import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import {
	buildNilRosterOpportunityReport,
	loadAthleteHouzeReporterConfig,
	sendAthleteHouzeReport,
	sourceEnvironment,
} from '../../_lib/athleteHouzeReporter'

const CLIENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/

function bearerToken(req: VercelRequest): string | null {
	const header = Array.isArray(req.headers.authorization)
		? req.headers.authorization[0]
		: req.headers.authorization
	const match = header?.match(/^Bearer\s+(.+)$/i)
	return match?.[1]?.trim() || null
}

function operatorExternalAthleteId(user: {
	app_metadata?: Record<string, unknown>
}): string | null {
	const configured = user.app_metadata?.athlete_houze_external_id
	return typeof configured === 'string' && CLIENT_ID_PATTERN.test(configured)
		? configured
		: null
}

function integrationAllowed(
	user: { app_metadata?: Record<string, unknown> },
	externalAthleteId: string,
	expectedCanaryId: string
): boolean {
	return (
		externalAthleteId === expectedCanaryId &&
		user.app_metadata?.workflow_cloud_persistence_canary === true &&
		user.app_metadata?.synthetic_test_data === true
	)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	res.setHeader('Cache-Control', 'no-store')
	if (req.method !== 'POST') {
		res.setHeader('Allow', 'POST')
		return res.status(405).json({ error: 'Method not allowed' })
	}

	const accessToken = bearerToken(req)
	if (!accessToken) return res.status(401).json({ error: 'Unauthorized' })

	const clientId = typeof req.body?.clientId === 'string' ? req.body.clientId.trim() : ''
	if (!CLIENT_ID_PATTERN.test(clientId)) {
		return res.status(400).json({ error: 'Invalid source record' })
	}

	const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
	const supabaseAnonKey =
		process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
	if (!supabaseUrl || !supabaseAnonKey) {
		return res.status(503).json({ error: 'Integration unavailable' })
	}

	const supabase = createClient(supabaseUrl, supabaseAnonKey, {
		auth: { persistSession: false, autoRefreshToken: false },
		global: { headers: { Authorization: `Bearer ${accessToken}` } },
	})
	const { data: authData, error: authError } = await supabase.auth.getUser(accessToken)
	if (authError || !authData.user) return res.status(401).json({ error: 'Unauthorized' })
	const config = loadAthleteHouzeReporterConfig()
	if (!config) return res.status(503).json({ error: 'Integration unavailable' })
	const externalAthleteId = operatorExternalAthleteId(authData.user)
	if (
		!externalAthleteId ||
		!integrationAllowed(
			authData.user,
			externalAthleteId,
			config.canaryExternalAthleteId
		)
	) {
		return res.status(403).json({ error: 'Integration disabled' })
	}

	const { data: source, error: sourceError } = await supabase
		.from('opportunities')
		.select('client_id,status,category,updated_at')
		.eq('user_id', authData.user.id)
		.eq('client_id', clientId)
		.maybeSingle()
	if (sourceError || !source) {
		return res.status(404).json({ error: 'Source record not found' })
	}

	const report = buildNilRosterOpportunityReport({
		externalAthleteId,
		sourceRecordId: source.client_id,
		occurredAt: source.updated_at,
		status: source.status,
		category: source.category,
		environment: sourceEnvironment(),
	})
	const delivered = await sendAthleteHouzeReport(report, config)
	if (!delivered.ok) return res.status(503).json({ error: 'Integration delivery failed' })

	return res.status(202).json({ accepted: true })
}
