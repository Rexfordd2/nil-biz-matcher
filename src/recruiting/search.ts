import { CollegeProgram } from './programTypes'
import { SAMPLE_PROGRAMS } from './programData'

export type ProgramFilters = {
	sport?: string
	position?: string // reserved for future use
	level?: string
	region?: string // state/region code
	gpaBand?: string // e.g., "3.0+"
}

export function searchPrograms(filters: ProgramFilters): CollegeProgram[] {
	const fSport = (filters.sport || '').toLowerCase()
	const fLevel = (filters.level || '').toLowerCase()
	const fRegion = (filters.region || '').toLowerCase()
	// For now, just filter static data
	return SAMPLE_PROGRAMS.filter(p => {
		const sportOk = !fSport || p.sport.toLowerCase().includes(fSport)
		const levelOk = !fLevel || p.level.toLowerCase() === fLevel
		const regionOk = !fRegion || (p.location?.stateOrRegion || '').toLowerCase().includes(fRegion)
		return sportOk && levelOk && regionOk
	})
}


