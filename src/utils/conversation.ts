import { AthleteProfile, Business, ConversationScript, FitAnalysis, MatchStrategy } from '../types'

function firstSport(ath: AthleteProfile): string {
	const s = ath.sports?.[0]
	return s ? s.sportName : 'student-athlete'
}

function athleteIntro(ath: AthleteProfile): string {
	const sport = firstSport(ath)
	const level = ath.schoolLevel
	const school = ath.school
	return `Hi, this is ${ath.name}. I’m a ${level} athlete at ${school} (${sport}).`
}

function whyFit(ath: AthleteProfile, biz: Business): string {
	const where = biz.location ? `in ${biz.location}` : 'locally'
	const cat = biz.category ? ` in ${biz.category}` : ''
	return `I think there’s a natural fit because your business${cat} connects with students, families, and fans ${where}, which overlaps with my school community.`
}

function topIdeaLines(strategy?: MatchStrategy): string[] {
	if (!strategy?.ideas?.length) return []
	const picked = strategy.ideas.slice(0, 2)
	return picked.map(i => `- ${i.title}: ${i.description}`)
}

function buildPhoneScript(params: {
	athleteProfile: AthleteProfile
	business: Business
	fit: FitAnalysis
	strategy?: MatchStrategy
}): string {
	const { athleteProfile, business, strategy } = params
	const intro = athleteIntro(athleteProfile)
	const heard = `I heard about ${business.name}${business.category ? ` (${business.category})` : ''}${business.location ? ` in ${business.location}` : ''} and wanted to introduce myself.`
	const fitLine = whyFit(athleteProfile, business)
	const ideas = topIdeaLines(strategy)
	const ideasBlock = ideas.length
		? `Here are a couple simple, school-friendly ideas:\n${ideas.join('\n')}`
		: `I have a couple of simple, school-friendly ideas we could try (like a short post-game mention or a discount code for families).`
	const close = `Would you be open to a quick 10–15 minute meeting to talk about this? No pressure at all—if it makes sense, I’ll loop in my parent/guardian or coach for any next steps.`
	return [intro, heard, fitLine, ideasBlock, close].join('\n\n')
}

function buildInPersonOutline(params: {
	athleteProfile: AthleteProfile
	business: Business
	fit: FitAnalysis
	strategy?: MatchStrategy
}): string[] {
	const { business, strategy } = params
	const ideaTitles = strategy?.ideas?.slice(0, 2).map(i => i.title) || []
	const ideaPoint = ideaTitles.length
		? `Share 1–2 ideas (${ideaTitles.join(' / ')})`
		: 'Share 1–2 simple, school-friendly ideas (e.g., short post, discount code)'
	return [
		'Introduction (name, school, sport).',
		`Ask about their business and goals (what matters most at ${business.name}?).`,
		'Share your story briefly (why you care, your values, your audience).',
		ideaPoint + '.',
		'Ask if they’re interested and listen to their reaction.',
		'Next steps: exchange contact info and set a follow-up time (involve a parent/guardian/coach for any commitments).'
	]
}

export function buildConversationScript(params: {
	athleteProfile: AthleteProfile
	business: Business
	fit: FitAnalysis
	strategy?: MatchStrategy
}): ConversationScript {
	return {
		phoneScript: buildPhoneScript(params),
		inPersonOutline: buildInPersonOutline(params)
	}
}


