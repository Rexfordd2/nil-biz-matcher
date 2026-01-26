import { Business, BusinessAnalysis, BusinessLevel } from '../types'

const KEYWORDS = {
	history: ['since', 'founded', 'established', 'family', 'roots', 'community', 'local'],
	intent: ['mission', 'serve', 'support', 'inspire', 'build', 'help', 'empower', 'fuel', 'train', 'grow'],
	goals: ['growth', 'brand', 'awareness', 'sales', 'traffic', 'recruiting', 'signups', 'memberships', 'tickets', 'donations'],
	marketing: ['social', 'instagram', 'tiktok', 'video', 'content', 'website', 'email', 'newsletter']
}

const CATEGORY_HINTS = [
	{ key: 'restaurant', words: ['restaurant', 'pizza', 'grill', 'tacos', 'burger', 'bbq', 'wings', 'cafe', 'coffee'] },
	{ key: 'gym', words: ['gym', 'fitness', 'training', 'strength', 'performance', 'crossfit'] },
	{ key: 'retail', words: ['store', 'shop', 'apparel', 'gear', 'sports', 'shoe', 'outfitter'] },
	{ key: 'health', words: ['clinic', 'chiro', 'physical therapy', 'rehab', 'orthopedic', 'dental'] },
	{ key: 'faith', words: ['church', 'ministry', 'faith', 'youth group'] },
	{ key: 'education', words: ['academy', 'tutoring', 'learning', 'school'] }
]

function guessLevel(text: string): BusinessLevel {
	const t = text.toLowerCase()
	if (/(nationwide|national|usa|global|worldwide|international|franchise)/.test(t)) return 'NATIONAL'
	if (/(statewide|region|metro|county|multi\-location)/.test(t)) return 'REGIONAL'
	return 'LOCAL'
}

function linesToSentence(lines: string[]): string {
	return lines.length ? lines.join(' ') : 'Community-rooted small business.'
}

export function autoAnalyzeBusiness(biz: Business): BusinessAnalysis {
	const socialStrings = [
		...(biz.socialLinks || []),
		...((biz.socialHandles || []).map(s => s.url || s.handle).filter(Boolean) as string[])
	]
	const text = `${biz.name}. ${biz.description} ${biz.location} ${biz.website || ''} ${biz.url || ''} ${socialStrings.join(' ')}`
	const t = text.toLowerCase()

	// History/community
	const historyBits: string[] = []
	if (KEYWORDS.history.some(k => t.includes(k))) historyBits.push('Deep community roots')
	if (t.includes('family')) historyBits.push('Family-involved')
	if (/\b(19|20)\d{2}\b/.test(t)) historyBits.push('Established brand presence')
	if (historyBits.length === 0) historyBits.push('Locally connected')

	// Intent & mission
	const intentBits: string[] = []
	if (KEYWORDS.intent.some(k => t.includes(k))) intentBits.push('Focused on serving and growing community')
	if (CATEGORY_HINTS.some(c => c.words.some(w => t.includes(w)))) intentBits.push('Clear audience and offering')
	if (intentBits.length === 0) intentBits.push('Community-minded business')

	// Main goals
	const goals: string[] = []
	if (KEYWORDS.goals.some(k => t.includes(k))) goals.push('Grow awareness')
	if (/\b(member|signup|join)\b/.test(t)) goals.push('Increase signups')
	if (/\b(tickets?)\b/.test(t)) goals.push('Boost event attendance')
	if (goals.length === 0) goals.push('Drive local traffic')

	// Marketing needs
	const needs: string[] = []
	if (!biz.socialLinks || biz.socialLinks.length === 0) needs.push('Build social presence')
	if (!biz.website) needs.push('Improve website visibility')
	if (/content|video|photo/.test(t) === false) needs.push('Create consistent content')
	if (needs.length === 0) needs.push('Activate targeted campaigns')

	const levelGuess = biz.level || guessLevel(text)

	return {
		history: linesToSentence(historyBits),
		intentMission: linesToSentence(intentBits),
		mainGoals: [...new Set(goals)],
		marketingNeeds: [...new Set(needs)],
		levelGuess
	}
}

export function guessCategory(description: string | undefined): string | undefined {
	if (!description) return undefined
	const t = description.toLowerCase()
	for (const cat of CATEGORY_HINTS) {
		if (cat.words.some(w => t.includes(w))) return cat.key
	}
	return undefined
}


