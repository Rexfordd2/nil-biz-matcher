import type { VercelRequest, VercelResponse } from '@vercel/node'

function deriveBuildId(): string {
	const raw =
		process.env.VITE_BUILD_ID ||
		process.env.VERCEL_GIT_COMMIT_SHA ||
		process.env.GIT_COMMIT_SHA ||
		process.env.COMMIT_REF ||
		''
	// If it looks like a git SHA, shorten to 7 chars; else return as-is or 'unknown'
	if (/^[a-f0-9]{7,40}$/i.test(raw)) return raw.slice(0, 7)
	return raw || 'unknown'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method Not Allowed' })
	}
	
	const buildId = deriveBuildId()
	const gitCommitSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VITE_BUILD_ID || ''
	const timestamp = new Date().toISOString()
	
	const payload = {
		buildId,
		gitCommitSha,
		timestamp
	}
	
	// Aggressive cache-busting headers
	res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
	res.setHeader('Pragma', 'no-cache')
	res.setHeader('Expires', '0')
	res.setHeader('CDN-Cache-Control', 'no-store')
	res.setHeader('Surrogate-Control', 'no-store')
	
	return res.status(200).json(payload)
}
