export class ValidationError extends Error {
	requestId?: string
	payloadSnippet?: string
	constructor(message: string, opts?: { requestId?: string; payloadSnippet?: string }) {
		super(message)
		this.name = 'ValidationError'
		this.requestId = opts?.requestId
		this.payloadSnippet = opts?.payloadSnippet
	}
}

export function truncatePayload(value: unknown, maxChars = 600): string {
	let s = ''
	try {
		s = JSON.stringify(value)
	} catch {
		try {
			s = String(value)
		} catch {
			s = '[unserializable]'
		}
	}
	return s.length > maxChars ? s.slice(0, maxChars) + '…' : s
}

// Minimal shape checks for ExternalBusiness[]
export function validateBusinessResponse(raw: unknown): { ok: true; businesses: any[] } | { ok: false; reason: string } {
	// Accept either { businesses: [] } or a bare array []
	let arr: unknown
	if (Array.isArray(raw)) {
		arr = raw
	} else if (raw && typeof raw === 'object' && Array.isArray((raw as any).businesses)) {
		arr = (raw as any).businesses
	} else {
		return { ok: false, reason: 'Response is not an array or { businesses: [] }' }
	}
	const list = arr as any[]
	// Sample a few items for minimal fields we reference in UI (defensive)
	for (let i = 0; i < Math.min(3, list.length); i++) {
		const b = list[i]
		if (!b || typeof b !== 'object') return { ok: false, reason: 'Business item is not an object' }
		// name may be missing but when present should be string
		if (b.name != null && typeof b.name !== 'string') return { ok: false, reason: 'Business.name must be string' }
		// coordinates optional: when present must be object with numeric latitude/longitude
		if (b.coordinates != null) {
			const c = b.coordinates
			if (typeof c !== 'object' || (c.latitude != null && typeof c.latitude !== 'number') || (c.longitude != null && typeof c.longitude !== 'number')) {
				return { ok: false, reason: 'Business.coordinates invalid' }
			}
		}
	}
	return { ok: true, businesses: list }
}

// Minimal shape checks for { programs: CollegeProgram[] }
export function validateProgramsResponse(raw: unknown): { ok: true; programs: any[] } | { ok: false; reason: string } {
	if (!raw || typeof raw !== 'object') return { ok: false, reason: 'Response is not an object' }
	const programs = (raw as any).programs
	if (!Array.isArray(programs)) return { ok: false, reason: 'Missing programs array' }
	for (let i = 0; i < Math.min(3, programs.length); i++) {
		const p = programs[i]
		if (!p || typeof p !== 'object') return { ok: false, reason: 'Program item is not an object' }
		// id and name are commonly used
		if (p.id != null && typeof p.id !== 'string') return { ok: false, reason: 'Program.id must be string' }
		if (p.name != null && typeof p.name !== 'string') return { ok: false, reason: 'Program.name must be string' }
		// Optional nested location should be object if present
		if (p.location != null && typeof p.location !== 'object') return { ok: false, reason: 'Program.location invalid' }
	}
	return { ok: true, programs }
}

