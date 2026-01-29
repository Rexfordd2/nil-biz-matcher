import type { VercelRequest, VercelResponse } from '@vercel/node'
import prisma from '../_lib/prisma'
import { requireUserOrBypass } from '../_lib/auth'

type JsonValue = any

function isPlainObject(value: unknown): value is Record<string, any> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Deep merge incoming into base. Arrays are replaced, objects are merged,
 * undefined in incoming preserves base, null in incoming overwrites with null.
 */
function deepMerge<T extends JsonValue>(base: T, incoming: Partial<T>): T {
	if (Array.isArray(base) && Array.isArray(incoming)) {
		return incoming as T
	}
	if (isPlainObject(base) && isPlainObject(incoming)) {
		const result: Record<string, any> = { ...base }
		for (const key of Object.keys(incoming)) {
			const nextVal = (incoming as any)[key]
			if (nextVal === undefined) {
				continue
			}
			const prevVal = (result as any)[key]
			if (isPlainObject(prevVal) && isPlainObject(nextVal)) {
				;(result as any)[key] = deepMerge(prevVal, nextVal)
			} else if (Array.isArray(prevVal) && Array.isArray(nextVal)) {
				;(result as any)[key] = nextVal
			} else {
				;(result as any)[key] = nextVal
			}
		}
		return result as T
	}
	// Primitive or mismatched types: prefer incoming when defined
	return (incoming === undefined ? base : (incoming as T)) as T
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	const result = await requireUserOrBypass(req, res)
	if (!result) return // 401 already sent
	const { bypassed, user } = result
	
	// Public mode: return empty profile (no DB access)
	if (bypassed) {
		res.setHeader('Cache-Control', 'no-store')
		if (req.method === 'GET') {
			return res.status(200).json({ profile: {}, updatedAt: null })
		}
		if (req.method === 'PUT') {
			return res.status(503).json({ error: 'Profile storage not available in public mode' })
		}
		res.setHeader('Allow', 'GET, PUT')
		return res.status(405).json({ error: 'Method Not Allowed' })
	}

	if (req.method === 'GET') {
		// If DB is not available, respond with an empty profile rather than erroring
		if (!prisma) {
			res.setHeader('Cache-Control', 'no-store')
			return res.status(200).json({ profile: {}, updatedAt: null })
		}
		try {
			const row = await prisma.athleteProfile.findUnique({
				where: { userId: user!.id }
			})
			res.setHeader('Cache-Control', 'no-store')
			return res.status(200).json({
				profile: row?.data ? safeParseJson(row.data) : {},
				updatedAt: row?.updatedAt ? new Date(row.updatedAt).getTime() : null
			})
		} catch (err: any) {
			return res.status(500).json({ error: 'Failed to load profile' })
		}
	}

	if (req.method === 'PUT') {
		// If DB is not available, saving is not supported in this deployment
		if (!prisma) {
			return res.status(503).json({ error: 'Profile storage not available' })
		}
		const incoming = (req.body || {}) as Record<string, any>
		if (!isPlainObject(incoming)) {
			return res.status(400).json({ error: 'Invalid body; expected JSON object' })
		}
		try {
			const existing = await prisma.athleteProfile.findUnique({
				where: { userId: user!.id }
			})
			const base = existing?.data ? safeParseJson(existing.data) : {}
			const merged = deepMerge(base, incoming)
			const saved = await prisma.athleteProfile.upsert({
				where: { userId: user!.id },
				update: { data: JSON.stringify(merged) },
				create: { userId: user!.id, data: JSON.stringify(merged) }
			})
			res.setHeader('Cache-Control', 'no-store')
			return res.status(200).json({
				profile: saved.data ? safeParseJson(saved.data) : {},
				updatedAt: new Date(saved.updatedAt).getTime()
			})
		} catch (err: any) {
			return res.status(500).json({ error: 'Failed to save profile' })
		}
	}

	res.setHeader('Allow', 'GET, PUT')
	return res.status(405).json({ error: 'Method Not Allowed' })
}

function safeParseJson(input: string | null | undefined): any {
	if (!input) return {}
	try {
		return JSON.parse(input)
	} catch {
		return {}
	}
}


