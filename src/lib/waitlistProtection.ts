// Client-side waitlist protection: rate limiting and honeypot

const RATE_LIMIT_KEY = 'waitlist_submissions'
const RATE_LIMIT_MAX = 3
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours

type SubmissionRecord = {
	timestamp: number
	count: number
}

export function checkRateLimit(): { allowed: boolean; remaining: number; resetAt: number } {
	const stored = localStorage.getItem(RATE_LIMIT_KEY)
	const now = Date.now()
	
	if (!stored) {
		return {
			allowed: true,
			remaining: RATE_LIMIT_MAX,
			resetAt: now + RATE_LIMIT_WINDOW_MS
		}
	}
	
	try {
		const record: SubmissionRecord = JSON.parse(stored)
		const elapsed = now - record.timestamp
		
		// Reset if window expired
		if (elapsed >= RATE_LIMIT_WINDOW_MS) {
			return {
				allowed: true,
				remaining: RATE_LIMIT_MAX,
				resetAt: now + RATE_LIMIT_WINDOW_MS
			}
		}
		
		const remaining = Math.max(0, RATE_LIMIT_MAX - record.count)
		return {
			allowed: remaining > 0,
			remaining,
			resetAt: record.timestamp + RATE_LIMIT_WINDOW_MS
		}
	} catch {
		// Invalid data, reset
		return {
			allowed: true,
			remaining: RATE_LIMIT_MAX,
			resetAt: now + RATE_LIMIT_WINDOW_MS
		}
	}
}

export function recordSubmission(): void {
	const stored = localStorage.getItem(RATE_LIMIT_KEY)
	const now = Date.now()
	
	if (!stored) {
		localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ timestamp: now, count: 1 }))
		return
	}
	
	try {
		const record: SubmissionRecord = JSON.parse(stored)
		const elapsed = now - record.timestamp
		
		if (elapsed >= RATE_LIMIT_WINDOW_MS) {
			// Reset window
			localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ timestamp: now, count: 1 }))
		} else {
			// Increment count
			localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ timestamp: record.timestamp, count: record.count + 1 }))
		}
	} catch {
		// Invalid data, reset
		localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ timestamp: now, count: 1 }))
	}
}

export function generateReferralLink(email: string): string {
	const baseUrl = window.location.origin
	const params = new URLSearchParams({
		utm_source: 'waitlist',
		utm_campaign: 'referral',
		ref: btoa(email).slice(0, 8) // Simple obfuscation, not security
	})
	return `${baseUrl}?${params.toString()}`
}
