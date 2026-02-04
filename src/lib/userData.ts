/**
 * User data storage helper
 * Saves anonymous user activity data and updates session tracking
 */

import { supabase, supabaseEnvConfigured } from './supabaseClient'
import { getAnonId } from './anonIdentity'
import Observability from './obs'

/**
 * Save user data and update session last_seen timestamp
 * Non-blocking: failures are logged but don't throw errors
 * @param data_type - Type of data being saved (e.g. 'discover_search', 'recruiting_search', 'profile_draft')
 * @param payload - Data payload object to store
 */
export async function saveUserData(data_type: string, payload: any): Promise<void> {
	if (!supabaseEnvConfigured || !supabase) {
		// Silently fail if Supabase not configured
		return
	}

	// Check if user is authenticated
	let userId: string | null = null
	try {
		const { data: userData } = await supabase.auth.getUser()
		if (userData.user) {
			userId = userData.user.id
		}
	} catch {
		// Silently handle auth check failure
	}

	const anonId = getAnonId()
	
	// Skip if anon_id is invalid (SSR or localStorage unavailable) and no authenticated user
	if (!userId && (anonId === 'ssr-temp-id' || anonId === 'localStorage-unavailable')) {
		return
	}

	try {
		// Upsert anon_sessions to update last_seen (only if using anon_id)
		// Use the helper function via RPC which bypasses RLS (security definer)
		if (!userId) {
			const { error: sessionError } = await supabase.rpc('update_anon_session_last_seen', {
				anon_id_param: anonId
			})

			if (sessionError) {
				// Log but don't throw - session update failure shouldn't block data save
				Observability.log({
					feature: 'user_data',
					route: 'anon_sessions.update.error',
					status: 'error',
					errorMessage: sessionError.message,
					meta: { anonId: anonId.substring(0, 8) + '***', code: sessionError.code }
				})
			}
		}

		// Insert user_data record with user_id if authenticated, otherwise use anon_id
		const insertData: any = {
			data_type,
			payload
		}
		
		if (userId) {
			insertData.user_id = userId
		} else {
			insertData.anon_id = anonId
		}

		const { error: dataError } = await supabase.from('user_data').insert(insertData)

		if (dataError) {
			// Log but don't throw - data save failure shouldn't block UI
			Observability.log({
				feature: 'user_data',
				route: 'user_data.insert.error',
				status: 'error',
				errorMessage: dataError.message,
				meta: {
					data_type,
					hasUserId: Boolean(userId),
					anonId: userId ? null : anonId.substring(0, 8) + '***',
					code: dataError.code
				}
			})
		} else {
			// Log successful save for observability
			Observability.log({
				feature: 'user_data',
				route: 'user_data.insert.success',
				status: 'ok',
				meta: { data_type, hasUserId: Boolean(userId) }
			})
		}
	} catch (err: any) {
		// Catch any unexpected errors and log them
		Observability.log({
			feature: 'user_data',
			route: 'user_data.save.exception',
			status: 'error',
			errorMessage: err?.message || String(err),
			meta: { data_type }
		})
	}
}
