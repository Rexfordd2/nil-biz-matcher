/**
 * Waitlist submission helper
 * Handles anonymous user waitlist signups with UTM tracking and referral info
 */

import { supabase, supabaseEnvConfigured } from './supabaseClient'
import { getAnonId } from './anonIdentity'

export type WaitlistResult = { ok: true } | { ok: false; error: string }

/**
 * Submit email to waitlist with anonymous ID and metadata
 * @param email - User's email address
 * @param meta - Optional metadata object (UTM params, referral info, etc.)
 * @returns Result object with ok status and optional error message
 */
export async function submitWaitlistEmail(
	email: string,
	meta?: Record<string, any>
): Promise<WaitlistResult> {
	if (!supabaseEnvConfigured || !supabase) {
		return { ok: false, error: 'Waitlist service unavailable' }
	}

	const trimmedEmail = email.trim()
	if (!trimmedEmail) {
		return { ok: false, error: 'Email is required' }
	}

	try {
		// Get anonymous ID
		const anonId = getAnonId()

		// Extract UTM params from meta if provided
		const utmSource = meta?.utm_source || null
		const utmMedium = meta?.utm_medium || null
		const utmCampaign = meta?.utm_campaign || null
		const utmTerm = meta?.utm_term || null
		const utmContent = meta?.utm_content || null

		// Extract source from meta or default to 'landing'
		const source = meta?.source || 'landing'

		// Prepare insert payload
		const insertPayload: {
			email: string
			anon_id: string | null
			source: string | null
			utm_source: string | null
			utm_medium: string | null
			utm_campaign: string | null
			utm_term: string | null
			utm_content: string | null
		} = {
			email: trimmedEmail,
			anon_id: anonId !== 'ssr-temp-id' && anonId !== 'localStorage-unavailable' ? anonId : null,
			source,
			utm_source: utmSource,
			utm_medium: utmMedium,
			utm_campaign: utmCampaign,
			utm_term: utmTerm,
			utm_content: utmContent
		}

		const { error } = await supabase.from('waitlist').insert(insertPayload)

		if (error) {
			// Handle unique constraint duplicates as success ("You're in")
			// PostgreSQL unique constraint violation code
			if (
				error.code === '23505' ||
				error.message.includes('duplicate') ||
				error.message.includes('unique') ||
				error.message.includes('already exists')
			) {
				return { ok: true }
			}

			// Other errors
			return { ok: false, error: error.message || 'Failed to join waitlist' }
		}

		return { ok: true }
	} catch (err: any) {
		// Handle unexpected errors
		const errorMessage = err?.message || 'An unexpected error occurred'
		return { ok: false, error: errorMessage }
	}
}
