import { CollegeProgram } from './programTypes'
import { SAMPLE_PROGRAMS } from './programData'

export type ProgramFilters = {
	sport?: string
	position?: string // reserved for future use
	level?: string
	region?: string // state/region code
	gpaBand?: string // e.g., "3.0+"
}

export async function searchPrograms(filters: ProgramFilters): Promise<CollegeProgram[]> {
	// Try server route first (enables future DB expansion); fallback to local static dataset
	try {
		const qs = new URLSearchParams()
		if (filters.sport) qs.set('sport', filters.sport)
		if (filters.level) qs.set('level', filters.level)
		if (filters.region) qs.set('region', filters.region)
		const res = await fetch(`/api/recruiting/search?${qs.toString()}`, { method: 'GET', headers: { 'Accept': 'application/json' } })
		if (res.ok) {
			const data = await res.json().catch(() => ({}))
			const arr = (data?.programs || []) as CollegeProgram[]
			if (Array.isArray(arr)) return arr
		}
	} catch {}

	// Local fallback
	const fSport = (filters.sport || '').toLowerCase()
	const fLevel = (filters.level || '').toLowerCase()
	const fRegion = (filters.region || '').toLowerCase()
	return SAMPLE_PROGRAMS.filter(p => {
		const sportOk = !fSport || (p.sport || '').toLowerCase().includes(fSport)
		const levelOk = !fLevel || (p.level || '').toLowerCase() === fLevel
		const regionOk = !fRegion || (p.location?.stateOrRegion || '').toLowerCase().includes(fRegion)
		return sportOk && levelOk && regionOk
	})
}


