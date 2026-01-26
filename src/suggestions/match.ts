import type { AthleteProfile } from '../types'
import type { ProfileSuggestion } from './types'
import { PROFILE_SUGGESTIONS } from './config'

function extractRegion(location?: string): string | null {
	if (!location) return null
	const m = String(location).toUpperCase().match(/\b([A-Z]{2})\b/)
	return m?.[1] || null
}

function hasIntersection(a?: string[], b?: string[]): boolean {
	if (!a || !b || a.length === 0 || b.length === 0) return false
	const set = new Set(a.map(x => x.toLowerCase()))
	return b.some(x => set.has(String(x).toLowerCase()))
}

export function getProfileSuggestions(athlete: AthleteProfile, opts?: { marketingConsent?: boolean }): ProfileSuggestion[] {
	const primarySports = (athlete.sports || []).map(s => s.sportName).filter(Boolean)
	const allPositions = (athlete.sports || []).flatMap(s => s.positions || []).filter(Boolean)
	const region = extractRegion(athlete.location)
	const followers = athlete.social?.followers ?? 0
	const contentStyles = athlete.contentStyles || []
	const monetization = athlete.monetizationInterests || []

	const candidates = PROFILE_SUGGESTIONS.map(s => {
		let matched = 0
		const c = s.conditions || {}
		if (c.sports && hasIntersection(c.sports, primarySports)) matched++
		if (c.positions && hasIntersection(c.positions, allPositions)) matched++
		if (c.regions && region && c.regions.map(x => x.toUpperCase()).includes(region)) matched++
		if (typeof c.minFollowers === 'number' && followers >= c.minFollowers) matched++
		if (c.contentStyles && hasIntersection(c.contentStyles, contentStyles)) matched++
		if (c.monetizationInterests && hasIntersection(c.monetizationInterests, monetization)) matched++
		return { suggestion: s, matched }
	})

	// Basic threshold: at least 2 matched signals
	let results = candidates
		.filter(x => x.matched >= 2)
		.sort((a, b) => b.matched - a.matched)
		.map(x => x.suggestion)

	// Privacy & consent: if no consent, keep to educational ideas only
	const marketingConsent = !!opts?.marketingConsent
	if (!marketingConsent) {
		results = results.filter(s => s.type !== 'local_brand_idea')
	}

	// Limit to top 5
	return results.slice(0, 5)
}


