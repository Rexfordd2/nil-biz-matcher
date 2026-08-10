import { supabase } from './supabaseClient'

/**
 * Notify the server-only reporter after an authenticated cloud write commits.
 * No opportunity content is sent from the browser; the API re-reads the row
 * under the authenticated user's RLS policy before creating evidence.
 */
export async function reportNilRosterOpportunity(clientId: string): Promise<boolean> {
	if (!supabase || !clientId) return false
	const { data, error } = await supabase.auth.getSession()
	const accessToken = data.session?.access_token
	if (error || !accessToken) return false

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
