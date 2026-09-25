import { supabase } from './supabaseClient'
import { isAthleteHouzeReportingAccount } from './athleteHouzeHandoff'

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
	if (error || !accessToken || !isAthleteHouzeReportingAccount(session?.user.app_metadata)) {
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
