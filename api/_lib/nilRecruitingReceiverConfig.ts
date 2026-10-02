/**
 * Development-only activation for the inbound Athlete Houze recruiting receiver.
 * Production and preview stay inactive even if the mode variable is set.
 * A localhost database URL is required so this guard cannot point at a hosted database.
 */

export type NilRecruitingReceiverConfig = {
	mode: 'development'
	hmacSecret: string
	databaseUrl: string
	maxBodyBytes: number
	timestampSkewSeconds: number
}

type Environment = Readonly<Record<string, string | undefined>>

const MIN_SECRET_LENGTH = 16

function isLocalDatabaseUrl(value: string): boolean {
	let url: URL
	try {
		url = new URL(value)
	} catch {
		return false
	}
	if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') return false
	const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
	if (host !== 'localhost' && host !== '127.0.0.1' && host !== '::1') return false
	const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''))
	if (!databaseName || /prod/i.test(databaseName)) return false
	return true
}

export function loadNilRecruitingReceiverConfig(
	env: Environment = process.env
): NilRecruitingReceiverConfig | null {
	if (env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview') return null
	if (env.NODE_ENV === 'production') return null
	if (String(env.NIL_RECRUITING_RECEIVER_MODE || '').trim().toLowerCase() !== 'development') {
		return null
	}
	const hmacSecret = env.NIL_RECRUITING_RECEIVER_HMAC_SECRET?.trim() ?? ''
	if (hmacSecret.length < MIN_SECRET_LENGTH) return null
	const databaseUrl = env.NIL_RECRUITING_RECEIVER_DATABASE_URL?.trim() ?? ''
	if (!isLocalDatabaseUrl(databaseUrl)) return null
	return {
		mode: 'development',
		hmacSecret,
		databaseUrl,
		maxBodyBytes: 65_536,
		timestampSkewSeconds: 300,
	}
}
