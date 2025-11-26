import { AthleteProfile } from '../types'

export function migrateAthleteProfile(input: any): AthleteProfile | null {
	if (!input) return null
	const a = { ...input }
	// Ensure sports array exists
	if (!Array.isArray(a.sports)) {
		const sportName = a.sport || ''
		const position = a.position ? [a.position] : []
		a.sports = sportName ? [{ sportName, positions: position }] : []
	}
	// Ensure socialHandles array exists
	if (!Array.isArray(a.socialHandles)) {
		const sh = []
		if (a.social?.handle || a.social?.link) {
			sh.push({ platform: 'Other', handle: a.social?.handle || '', url: a.social?.link || undefined })
		}
		a.socialHandles = sh
	}
	// Normalize contentStyles to string[]
	if (!Array.isArray(a.contentStyles)) a.contentStyles = []
	a.contentStyles = a.contentStyles.map((x: any) => String(x))
	// Ensure level string
	if (!a.level && a.schoolLevel) {
		a.level = String(a.schoolLevel).toLowerCase()
	}
	return a as AthleteProfile
}


