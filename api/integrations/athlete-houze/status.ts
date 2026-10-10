import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { loadAthleteHouzeEnrolledReporterConfig } from '../../_lib/athleteHouzeReporter.js'
import {
	bearerToken,
	createUserClient,
	enrolledDeliveryBlocked,
	isNilCanaryUser,
	supabaseAnonCredentials,
} from '../../_lib/athleteHouzeEnrollment.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
	res.setHeader('Cache-Control', 'no-store')
	if (req.method !== 'GET') {
		res.setHeader('Allow', 'GET')
		return res.status(405).json({ error: 'method_not_allowed' })
	}

	if (enrolledDeliveryBlocked()) {
		return res.status(200).json({
			status: 'disabled',
			enrollmentKind: 'none',
			reason: 'athlete-ledger-beta must not publish Houze reports',
		})
	}

	const accessToken = bearerToken(req.headers.authorization)
	if (!accessToken) return res.status(401).json({ error: 'Unauthorized' })

	const creds = supabaseAnonCredentials()
	if (!creds) {
		return res.status(200).json({
			status: 'disabled',
			enrollmentKind: 'none',
			reason: 'Athlete Houze enrollment is unavailable on this deployment.',
		})
	}

	const supabase = createClient(creds.url, creds.key, {
		auth: { persistSession: false, autoRefreshToken: false },
		global: { headers: { Authorization: `Bearer ${accessToken}` } },
	})
	const { data: authData, error: authError } = await supabase.auth.getUser(accessToken)
	if (authError || !authData.user) return res.status(401).json({ error: 'Unauthorized' })

	if (isNilCanaryUser(authData.user)) {
		return res.status(200).json({
			status: 'not_connected',
			enrollmentKind: 'canary',
			reason:
				'Synthetic canary testing is separate from production enrollment and does not mark Connected.',
		})
	}

	const userClient = createUserClient(accessToken)
	if (!userClient) {
		return res.status(200).json({
			status: 'disabled',
			enrollmentKind: 'none',
			reason: 'Athlete Houze enrollment is unavailable on this deployment.',
		})
	}

	const { data: enrollment } = await userClient
		.from('athlete_houze_enrollments')
		.select(
			'houze_athlete_id, status, connected_at, disconnected_at, last_sync_at, last_error'
		)
		.eq('user_id', authData.user.id)
		.maybeSingle()

	const enrolledConfig = loadAthleteHouzeEnrolledReporterConfig()
	if (!enrolledConfig) {
		return res.status(200).json({
			status: 'disabled',
			enrollmentKind: 'none',
			reason:
				'Production enrollment is off until ATHLETE_HOUZE_REPORTING_MODE=enrolled on the athlete-ledger production project.',
		})
	}

	if (!enrollment || enrollment.status !== 'linked' || enrollment.disconnected_at) {
		return res.status(200).json({
			status: enrollment?.status === 'disconnected' ? 'disconnected' : 'not_connected',
			enrollmentKind: 'none',
			lastSyncAt: enrollment?.last_sync_at ?? null,
			reason:
				'No consented Athlete Houze production account is linked. A pairing code from Athlete Houze is required.',
		})
	}

	return res.status(200).json({
		status: enrollment.last_sync_at ? 'linked' : 'pending_delivery',
		enrollmentKind: 'production',
		houzeAthleteId: enrollment.houze_athlete_id,
		connectedAt: enrollment.connected_at,
		lastSyncAt: enrollment.last_sync_at,
		lastError: enrollment.last_error,
		reason: enrollment.last_sync_at
			? 'Consented account is linked. Connected on Athlete Houze still requires a stored production opportunity update.'
			: 'Accounts are linked with consent. Connected requires an owned production opportunity delivery.',
	})
}
