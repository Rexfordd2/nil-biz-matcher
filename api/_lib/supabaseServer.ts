import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
	const segments: string[] = []
	segments.push(`${name}=${encodeURIComponent(value)}`)
	if (options.path) segments.push(`Path=${options.path}`)
	if (options.domain) segments.push(`Domain=${options.domain}`)
	if (options.maxAge && Number.isFinite(options.maxAge)) segments.push(`Max-Age=${Math.floor(options.maxAge)}`)
	if (options.expires) segments.push(`Expires=${new Date(options.expires).toUTCString()}`)
	if (options.httpOnly) segments.push('HttpOnly')
	// Default SameSite=Lax if not explicitly set (mirrors Next.js defaults for auth cookies)
	const sameSite = options.sameSite || 'lax'
	if (sameSite) {
		const normalized = typeof sameSite === 'string' ? sameSite : 'lax'
		segments.push(`SameSite=${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`)
	}
	// Default Secure in production
	const secure = options.secure ?? process.env.NODE_ENV === 'production'
	if (secure) segments.push('Secure')
	return segments.join('; ')
}

function parseCookieHeader(header: string | undefined): Array<{ name: string; value: string }> {
	if (!header) return []
	return header
		.split(';')
		.map(s => s.trim())
		.filter(Boolean)
		.map(kv => {
			const eq = kv.indexOf('=')
			const name = eq === -1 ? kv : kv.slice(0, eq)
			const value = eq === -1 ? '' : decodeURIComponent(kv.slice(eq + 1))
			return { name, value }
		})
}

export function supabaseServer(req: VercelRequest, res: VercelResponse) {
	const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
	const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
	if (!supabaseUrl || !supabaseAnonKey) {
		throw new Error('Missing Supabase env. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
	}

	return createServerClient(supabaseUrl, supabaseAnonKey, {
		cookies: {
			getAll() {
				// VercelRequest may not always have parsed cookies; fall back to raw header
				const header = req.headers.cookie as string | undefined
				return parseCookieHeader(header)
			},
			setAll(cookiesToSet) {
				try {
					const existing = res.getHeader('Set-Cookie')
					const setCookie = Array.isArray(existing) ? existing.slice() : existing ? [String(existing)] : []
					for (const { name, value, options } of cookiesToSet) {
						setCookie.push(serializeCookie(name, value, options))
					}
					res.setHeader('Set-Cookie', setCookie)
				} catch {
					// Some runtimes may restrict setting headers; ignore non-fatal failures
				}
			}
		}
	})
}

