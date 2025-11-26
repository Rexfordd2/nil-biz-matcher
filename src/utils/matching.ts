import { AthleteProfile, Business, BusinessLevel, FitRating, MatchResult } from '../types'
import { guessCategory } from './analysis'

function clamp(n: number, min = 0, max = 100) {
	return Math.max(min, Math.min(max, n))
}

function ratingFromScore(score: number): FitRating {
	if (score >= 85) return 'PERFECT FIT'
	if (score >= 70) return 'GOOD FIT'
	if (score >= 55) return 'STRETCH FIT'
	return 'POOR FIT'
}

function brandAlignmentScore(ath: AthleteProfile, biz: Business): number {
	const category = biz.category || guessCategory(biz.description) || ''
	const valuesText = `${ath.values.join(' ')}`.toLowerCase()
	const personality = ath.personality.toLowerCase()
	const styleText = (ath.contentStyles || []).join(' ').toLowerCase()
	const bizText = `${biz.name} ${biz.description}`.toLowerCase()
	const sportsText = (ath.sports || []).map(s => `${s.sportName} ${s.positions.join(' ')}`).join(' ').toLowerCase()

	let score = 50
	if (category.includes('gym') || /gym|fitness|training/.test(bizText)) {
		if (styleText.includes('training')) score += 25
		if (valuesText.includes('work') || valuesText.includes('grit')) score += 10
		if (sportsText.includes('track') || sportsText.includes('football') || sportsText.includes('basketball')) score += 5
	}
	if (/restaurant|pizza|wings|bbq|burger|cafe|coffee/.test(bizText)) {
		if (styleText.includes('lifestyle') || styleText.includes('game')) score += 15
	}
	if (/faith|church|ministry/.test(bizText)) {
		if (styleText.includes('faith')) score += 30
	}
	if (/retail|apparel|gear|shop/.test(bizText)) {
		if (styleText.includes('game') || styleText.includes('lifestyle')) score += 15
	}
	if (personality.includes('positive') || personality.includes('leader')) score += 10
	return clamp(score)
}

function audienceOverlapScore(ath: AthleteProfile, biz: Business): number {
	let score = 40
	const followers = ath.social?.followers ?? 0
	if (followers > 3000) score += 15
	if (followers > 10000) score += 25

	const level = biz.level || 'LOCAL'
	if (level === 'LOCAL' && (ath.school || ath.location)) score += 20
	if (level === 'REGIONAL' && ath.schoolLevel !== 'Middle School') score += 10
	if (level === 'NATIONAL' && followers > 15000) score += 20
	return clamp(score)
}

function practicalIntegrationScore(ath: AthleteProfile, biz: Business): number {
	let score = 50
	const hours = ath.timePerWeekHours
	if (hours >= 3 && hours <= 6) score += 15
	if (hours > 6) score += 5
	const bizText = `${biz.name} ${biz.description}`.toLowerCase()
	if (/restaurant|pizza|wings|grill|cafe|coffee/.test(bizText)) score += 10 // easy post-game promos
	if (/gym|training|fitness/.test(bizText)) score += 10 // easy 'train here' content
	return clamp(score)
}

export function evaluateMatch(athlete: AthleteProfile, business: Business): MatchResult {
	const brandAlignment = brandAlignmentScore(athlete, business)
	const audienceOverlap = audienceOverlapScore(athlete, business)
	const practicalIntegration = practicalIntegrationScore(athlete, business)
	const score = clamp(Math.round(0.4 * brandAlignment + 0.35 * audienceOverlap + 0.25 * practicalIntegration))
	const rating = ratingFromScore(score)

	const explain = () => {
		switch (rating) {
			case 'PERFECT FIT':
				return 'This is a clean match. Your vibe and their goals line up, your audience overlaps, and the partnership is easy to pull off. Low friction, high upside.'
			case 'GOOD FIT':
				return 'Strong alignment with clear overlap. A few tweaks to timing or content and this can really work. Worth reaching out soon.'
			case 'STRETCH FIT':
				return 'Some things match, some don’t. It could work with a specific idea or event. If you really like them, try one small test.'
			default:
				return 'Not the best fit right now. Save for later and focus on stronger local or interest-aligned options first.'
		}
	}

	const recommendedLevels: BusinessLevel[] = recommendLevels(athlete)

	return {
		brandAlignment,
		audienceOverlap,
		practicalIntegration,
		score,
		rating,
		explanation: explain(),
		recommendedLevels
	}
}

export function recommendLevels(athlete: AthleteProfile): BusinessLevel[] {
	const followers = athlete.social?.followers ?? 0
	const isStandout = athlete.schoolLevel === 'High School' && followers >= 3000
	const isViral = followers >= 15000 || athlete.schoolLevel === 'College'

	if (isViral) return ['LOCAL', 'REGIONAL', 'NATIONAL']
	if (isStandout) return ['LOCAL', 'REGIONAL']
	return ['LOCAL']
}


