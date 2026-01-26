import type { VercelRequest, VercelResponse } from '@vercel/node'
import { searchBusinessesWithGooglePlaces } from '../_lib/googlePlaces'
import { searchBusinessesWithMock } from '../_lib/mockBusinesses'

/**
 * UI → /api/business/search → provider (Google Places if configured, else mock)
 *
 * Previous behavior: returned 503 when GOOGLE_MAPS_API_KEY was missing, causing
 * the UI to show no results. We now always fall back to a curated mock dataset
 * filtered by term/location so the Discover page remains usable without envs.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
	res.setHeader('Cache-Control', 'no-store')
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method Not Allowed' })
	}
	const startedAt = Date.now()
	const requestId = (req.headers['x-request-id'] as string) || undefined
	const log = (status: 'start' | 'ok' | 'empty' | 'error') => {
		try {
			// eslint-disable-next-line no-console
			console.log(JSON.stringify({
				time: new Date().toISOString(),
				tsMs: Date.now(),
				requestId,
				feature: 'discover_api',
				route: '/api/business/search',
				status,
				durationMs: status === 'start' ? undefined : (Date.now() - startedAt),
				meta: {
					term: asString(req.query.term),
					location: asString(req.query.location),
					limit: asNumber(req.query.limit)
				}
			}))
		} catch {}
	}
	log('start')
	const key = process.env.GOOGLE_MAPS_API_KEY
	try {
		const term = asString(req.query.term)
		const location = asString(req.query.location)
		const limit = asNumber(req.query.limit)
		const lat = asNumber(req.query.lat)
		const lng = asNumber(req.query.lng)

		// Try external provider when configured
		if (key && key.trim() !== '') {
			const businesses = await searchBusinessesWithGooglePlaces({
				term,
				location,
				limit,
				latitude: lat,
				longitude: lng
			})
			// If we got results, return them; otherwise fall through to mock
			if (Array.isArray(businesses) && businesses.length > 0) {
				log('ok')
				return res.status(200).json({ businesses })
			}
		}

		// Fallback: mock provider only for non-production to avoid inconsistent prod behavior
		if (process.env.NODE_ENV !== 'production') {
			const fallback = await searchBusinessesWithMock({ term, location, limit })
			if (fallback.length === 0) log('empty'); else log('ok')
			return res.status(200).json({ businesses: fallback })
		}
		log('error')
		return res.status(503).json({ error: 'Upstream provider unavailable' })
	} catch (e) {
		log('error')
		// Last-resort safe fallback
		if (process.env.NODE_ENV !== 'production') {
			try {
				const fallback = await searchBusinessesWithMock({
					term: asString(req.query.term),
					location: asString(req.query.location),
					limit: asNumber(req.query.limit)
				})
				if (fallback.length === 0) log('empty'); else log('ok')
				return res.status(200).json({ businesses: fallback })
			} catch {
				log('empty')
				return res.status(200).json({ businesses: [] })
			}
		}
		return res.status(503).json({ error: 'Upstream provider error' })
	}
}

function asString(input: unknown): string | undefined {
	if (Array.isArray(input)) return input[0]
	return typeof input === 'string' && input.trim() !== '' ? input : undefined
}

function asNumber(input: unknown): number | undefined {
	const str = asString(input)
	if (!str) return undefined
	const n = Number(str)
	return Number.isFinite(n) ? n : undefined
}


