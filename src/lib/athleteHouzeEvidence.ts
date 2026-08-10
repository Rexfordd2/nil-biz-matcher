import { supabase } from './supabaseClient'

/**
 * Notify the server-only reporter after an authenticated cloud write commits.
 * No opportunity content is sent from the browser; the API re-reads the row
 * under the authenticated user's RLS policy before creating evidence.
 */
export async function reportNilRosterOpportunity(clientId: string): Promise<boolean> {
	if (!supabase || !clientId) return false
	const { data, error } = await supabase.auth.getSession()
	const session = data.session
	const accessToken = session?.access_token
	const appMetadata = session?.user.app_metadata
	const externalAthleteId = appMetadata?.athlete_houze_external_id
	if (
		error ||
		!accessToken ||
		appMetadata?.workflow_cloud_persistence_canary !== true ||
		appMetadata?.synthetic_test_data !== true ||
		typeof externalAthleteId !== 'string' ||
		!/^nil-canary-[A-Za-z0-9._:-]+$/.test(externalAthleteId)
	) {
		return false
	}

	try {
		const response = await fetch('/api/integrations/athlete-houze/report', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ clientId }),
		})
		return response.ok
	} catch {
		return false
	}
}
