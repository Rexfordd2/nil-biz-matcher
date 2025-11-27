import { AthleteProfile, CollaborationType, FitRating, OpportunityCostEstimate, OpportunityCostLevel } from '../types'

function clampHours(value: number, min = 0.5, max = 20): number {
	return Math.max(min, Math.min(max, value))
}

function baseTimeRange(collab?: CollaborationType): [number, number] {
	switch (collab) {
		case 'content-only':
			return [1, 3]
		case 'in-person':
		case 'events':
			return [3, 6]
		case 'mixed':
			return [2, 5]
		default:
			return [2, 4]
	}
}

function describeMode(collab?: CollaborationType): string {
	switch (collab) {
		case 'content-only':
			return 'creating content and organic mentions'
		case 'in-person':
			return 'in-person appearances or sessions'
		case 'events':
			return 'event appearances and prep'
		case 'mixed':
			return 'a mix of content and occasional in-person activities'
		default:
			return 'light collaboration activities'
	}
}

function computeLevel(weeklyHours: number, fit: FitRating, travelLikely: boolean): OpportunityCostLevel {
	if (travelLikely) return 'HIGH'
	if (fit === 'POOR FIT') return 'HIGH'
	if (weeklyHours > 4) return 'HIGH'
	if (weeklyHours < 2) return 'LOW'
	if (fit === 'PERFECT FIT' && weeklyHours < 3) return 'LOW'
	return 'MEDIUM'
}

export function estimateOpportunityCost(params: {
	fit: FitRating | { rating: FitRating }
	athleteProfile: AthleteProfile
	collaborationType?: CollaborationType
}): OpportunityCostEstimate {
	const fitRating: FitRating = typeof params.fit === 'string' ? params.fit : params.fit.rating
	const [minH, maxH] = baseTimeRange(params.collaborationType)
	// Start near the middle of the band
	let weekly = (minH + maxH) / 2

	// Adjust for fit
	if (fitRating === 'PERFECT FIT') weekly -= 1
	else if (fitRating === 'GOOD FIT') weekly -= 0.5
	else if (fitRating === 'STRETCH FIT') weekly += 0.5
	else if (fitRating === 'POOR FIT') weekly += 1.5

	weekly = clampHours(weekly, minH, maxH + 1) // allow slight upward adjustment

	// Travel heuristic: in-person or events likely imply travel/planning overhead
	const travelLikely = params.collaborationType === 'in-person' || params.collaborationType === 'events'

	const level = computeLevel(weekly, fitRating, travelLikely)

	// Duration default (4–12 weeks target); pick a sensible center based on type
	let durationWeeks = 8
	if (params.collaborationType === 'in-person' || params.collaborationType === 'events') durationWeeks = 6

	const modeText = describeMode(params.collaborationType)

	const explanation =
		`You’d likely spend about ${weekly.toFixed(0)} hours per week on ${modeText}. ` +
		`${fitRating} means the work should ${fitRating === 'PERFECT FIT' ? 'feel natural' : fitRating === 'POOR FIT' ? 'take extra effort' : 'be manageable'}; ` +
		`opportunity cost is ${level}: ${level === 'LOW' ? 'light lift' : level === 'MEDIUM' ? 'doable with planning around school and practice' : 'higher demand on time and focus'}.`

	return {
		level,
		timePerWeekHours: Math.round(weekly),
		durationWeeks,
		explanation
	}
}

export default estimateOpportunityCost


