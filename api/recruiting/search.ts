import type { VercelRequest, VercelResponse } from '@vercel/node'
import { SAMPLE_PROGRAMS } from '../../src/recruiting/programData'

/**
 * UI → /api/recruiting/search → static dataset filter
 *
 * MVP behavior: no external API required. This endpoint filters an in-repo
 * curated dataset, and the client falls back to the same dataset if the
 * network call fails. Ensures the Recruiting Finder always has results.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
	res.setHeader('Cache-Control', 'no-store')
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method Not Allowed' })
	}

	try {
		const sport = asString(req.query.sport)
		const level = asString(req.query.level)
		const region = asString(req.query.region)

		const fSport = (sport || '').trim().toLowerCase()
		const fLevel = (level || '').trim().toLowerCase()
		const fRegion = (region || '').trim().toLowerCase()

		const programs = SAMPLE_PROGRAMS.filter(p => {
			const sportOk = !fSport || (p.sport || '').toLowerCase().includes(fSport)
			const levelOk = !fLevel || (p.level || '').toLowerCase() === fLevel
			const regionOk = !fRegion || ((p.location?.stateOrRegion || '').toLowerCase().includes(fRegion) || (p.location?.city || '').toLowerCase().includes(fRegion))
			return sportOk && levelOk && regionOk
		})

		return res.status(200).json({ programs })
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error('Recruiting search error:', err)
		return res.status(200).json({ programs: [] })
	}
}

function asString(input: unknown): string | undefined {
	if (Array.isArray(input)) return input[0]
	if (typeof input === 'string') return input
	return undefined
}


