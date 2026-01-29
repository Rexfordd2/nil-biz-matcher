/**
 * Waitlist submission helper
 * Handles anonymous user waitlist signups with UTM tracking and referral info
 * 
 * Strategy:
 * - Always uses /api/waitlist endpoint for consistency
 * - Server-side validation and duplicate handling
 * - Normalizes email to lowercase client-side before sending
 */

import { getAnonId } from './anonIdentity'

export type WaitlistResult = { ok: true } | { ok: false; error: string }

/**
 * Validate email format (basic check)
 */
function isValidEmail(email: string): boolean {
	// Simple regex for basic email validation
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Submit email to waitlist with anonymous ID and metadata
 * @param email - User's email address
 * @param meta - Optional metadata object (UTM params, referral info, website honeypot, etc.)
 * @returns Result object with ok status and optional error message
 */
export async function submitWaitlistEmail(
	email: string,
	meta?: Record<string, any>
): Promise<WaitlistResult> {
	// Normalize email: trim and lowercase
	const normalizedEmail = email.trim().toLowerCase()
	
	// Validate email format
	if (!normalizedEmail) {
		return { ok: false, error: 'Email is required' }
	}
	
	if (!isValidEmail(normalizedEmail)) {
		return { ok: false, error: 'Please enter a valid email address' }
	}

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

	// Extract honeypot field (should be empty for legitimate users)
	const website = meta?.website || ''

	// Prepare insert payload
	const insertPayload = {
		email: normalizedEmail,
		anon_id: anonId !== 'ssr-temp-id' && anonId !== 'localStorage-unavailable' ? anonId : null,
		source,
		utm_source: utmSource,
		utm_medium: utmMedium,
		utm_campaign: utmCampaign,
		utm_term: utmTerm,
		utm_content: utmContent,
		website // Honeypot field
	}

	// Always use /api/waitlist endpoint for consistency
	// Server handles Supabase, validation, and fallback logic
	try {
		const response = await fetch('/api/waitlist', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(insertPayload)
		})

		// Parse response body
		const data = await response.json().catch(() => ({ ok: false, error: 'Invalid response' }))

		if (!response.ok) {
			return { ok: false, error: data.error || 'Failed to join waitlist' }
		}

		// Success - API returns { ok: true, status: "created" | "already_registered" | "accepted_no_storage" }
		// Treat all success statuses the same on the client side
		return { ok: true }
	} catch (err: any) {
		const errorMessage = err?.message || 'Network error'
		return { ok: false, error: errorMessage }
	}
}
