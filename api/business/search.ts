import type { VercelRequest, VercelResponse } from '@vercel/node'
import { searchBusinessesWithGooglePlaces } from '../_lib/googlePlaces.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
	res.setHeader('Cache-Control', 'no-store')
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method Not Allowed' })
	}
	const key = process.env.GOOGLE_MAPS_API_KEY
	if (!key || key.trim() === '') {
		return res.status(503).json({ error: 'Business search not configured' })
	}
	try {
		const term = asString(req.query.term)
		const location = asString(req.query.location)
		const limit = asNumber(req.query.limit)
		const lat = asNumber(req.query.lat)
		const lng = asNumber(req.query.lng)

		const businesses = await searchBusinessesWithGooglePlaces({
			term,
			location,
			limit,
			latitude: lat,
			longitude: lng
		})
		return res.status(200).json({ businesses })
	} catch {
		return res.status(200).json({ businesses: [] })
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


