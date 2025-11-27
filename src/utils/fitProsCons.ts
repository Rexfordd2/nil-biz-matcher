import type { AthleteProfile, Business, FitRating } from '../types'

type BuildParams = {
	athleteProfile: AthleteProfile
	business: Business
	rating: FitRating
}

function normalizeText(value?: string): string {
	return (value || '').toLowerCase()
}

function getAudienceHint(athlete: AthleteProfile): string {
	switch (athlete.schoolLevel) {
		case 'Middle School':
			return 'middle school peers and local parents'
		case 'High School':
			return 'local students and parents'
		case 'College':
			return 'college students and young adults'
		default:
			return 'local community members'
	}
}

function detectAdultLuxury(bizText: string): boolean {
	return /\b(fine dining|luxury|cocktail|wine|steakhouse|spa|jewelry|boutique)\b/.test(bizText)
}

function contentMentions(ath: AthleteProfile, keyword: string): boolean {
	return (ath.contentStyles || []).some(s => s.toLowerCase().includes(keyword))
}

function valuesMentions(ath: AthleteProfile, word: string): boolean {
	return (ath.values || []).some(v => v.toLowerCase().includes(word))
}

export function buildFitProsCons(params: BuildParams): { pros: string[]; cons: string[] } {
	const { athleteProfile: ath, business: biz, rating } = params

	const pros: string[] = []
	const cons: string[] = []

	const athleteLoc = normalizeText(ath.location)
	const bizLoc = normalizeText(biz.location)
	const bizText = normalizeText(`${biz.name} ${biz.description} ${biz.category}`)

	const followers = ath.social?.followers
	const hasFollowers = typeof followers === 'number' && followers >= 0

	// Brand values alignment
	if (valuesMentions(ath, 'community') && /\bcommunity|local|neighborhood\b/.test(bizText)) {
		pros.push('You value community, and this brand talks about serving the local community.')
	}
	if (valuesMentions(ath, 'health') && /\bhealth|wellness|fitness|gym|training\b/.test(bizText)) {
		pros.push('Health and training matter to you, which matches this brand’s focus.')
	}
	if (valuesMentions(ath, 'family') && /\bfamily|kids|youth\b/.test(bizText)) {
		pros.push('Family focus shows up for both you and this brand.')
	}

	// Audience overlap
	const audienceHint = getAudienceHint(ath)
	if (biz.level === 'LOCAL' || /\blocal|neighborhood|downtown|high school|youth\b/.test(bizText)) {
		pros.push(`Your audience includes ${audienceHint}, which matches this business’s local focus.`)
	} else if (biz.level === 'NATIONAL') {
		if (hasFollowers && followers >= 10000) {
			pros.push('Your current reach is strong enough to help a larger brand.')
		} else {
			cons.push('This brand focuses wider than your current reach, which may limit impact.')
		}
	}

	// Content style match
	if (/\bgym|fitness|training\b/.test(bizText)) {
		if (contentMentions(ath, 'training')) {
			pros.push('You post training content, which fits a fitness-oriented brand.')
		}
	}
	if (/\brestaurant|pizza|wings|bbq|burger|cafe|coffee\b/.test(bizText)) {
		if (contentMentions(ath, 'lifestyle') || contentMentions(ath, 'food')) {
			pros.push('Your lifestyle/food content would pair well with a restaurant or cafe.')
		} else {
			cons.push('Your current content doesn’t feature food or hangout spots much.')
		}
	}
	if (/\bretail|apparel|gear|shop|store\b/.test(bizText)) {
		if (contentMentions(ath, 'game') || contentMentions(ath, 'lifestyle')) {
			pros.push('Game-day or lifestyle posts can naturally showcase apparel or gear.')
		}
	}

	// Practicality: distance/time/budget heuristics
	if (athleteLoc && bizLoc && athleteLoc === bizLoc) {
		pros.push('You are both in the same area, which makes scheduling easy.')
	} else if (!athleteLoc || !bizLoc) {
		cons.push('We don’t know exact distance, so planning content may take extra coordination.')
	} else {
		cons.push('Distance between you and this business may make content harder to shoot.')
	}

	if (typeof ath.timePerWeekHours === 'number') {
		if (ath.timePerWeekHours >= 4) {
			pros.push('You have enough time each week to create content reliably.')
		} else if (ath.timePerWeekHours <= 1) {
			cons.push('Limited free time may make it hard to deliver consistent posts.')
		}
	}

	// Audience vs brand targeting
	if (detectAdultLuxury(bizText) && (ath.schoolLevel === 'Middle School' || ath.schoolLevel === 'High School')) {
		cons.push('This brand targets adult customers; your audience skews students and parents.')
	}

	// Followers availability
	if (!hasFollowers) {
		cons.push('We don’t know your audience size, so we can’t judge reach.')
		// Add a balancing pro if rating is otherwise positive
		if (rating === 'PERFECT FIT' || rating === 'GOOD FIT') {
			pros.push('Even without reach data, your values and content style align well here.')
		}
	} else if (followers < 2000 && (biz.level === 'REGIONAL' || biz.level === 'NATIONAL')) {
		cons.push('Your current reach is still growing for a bigger brand. Start with smaller deliverables.')
	}

	// Ensure 2–5 items each with sensible defaults
	if (pros.length < 2) {
		pros.push('There is clear overlap between your audience and the brand’s customers.')
	}
	if (pros.length < 2) {
		pros.push('Your content style can naturally feature this brand without feeling forced.')
	}

	if (cons.length < 2) {
		cons.push('Make sure expectations on time and deliverables are clear before starting.')
	}
	if (cons.length < 2) {
		cons.push('Start small with a test post to confirm engagement before a bigger deal.')
	}

	// Cap to 5 each
	return {
		pros: pros.slice(0, 5),
		cons: cons.slice(0, 5)
	}
}

export default buildFitProsCons


