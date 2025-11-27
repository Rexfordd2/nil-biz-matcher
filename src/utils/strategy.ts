import { AthleteProfile, Business, FitRating, MatchStrategy, StrategyIdea, CompensationType } from '../types'
import { guessCategory } from './analysis'

function capIdeas<T>(list: T[], min: number, max: number): T[] {
	const n = Math.min(Math.max(list.length, min), max)
	return list.slice(0, n)
}

function compTags(base: CompensationType[], extra: CompensationType[] = []): CompensationType[] {
	const set = new Set<CompensationType>([...base, ...extra])
	return Array.from(set)
}

function baseCompensationsByBiz(cat: string, level: string): CompensationType[] {
	const isYouth = /middle|high/.test(level)
	if (cat === 'restaurant') return ['free_product_or_service', 'discount_code', 'referral_bonus']
	if (cat === 'gym') return compTags(['free_product_or_service', 'referral_bonus'], isYouth ? [] : ['flat_fee'])
	if (cat === 'retail') return ['discount_code', 'revenue_share', 'referral_bonus']
	if (cat === 'faith') return ['free_product_or_service', 'custom']
	return ['free_product_or_service', 'referral_bonus', 'discount_code']
}

function buildIdeas(ath: AthleteProfile, biz: Business, fit: FitRating): StrategyIdea[] {
	const cat = biz.category || guessCategory(biz.description) || 'general'
	const level = (ath.level || ath.schoolLevel || '').toString().toLowerCase()
	const base = baseCompensationsByBiz(cat, level)

	const ideas: StrategyIdea[] = []

	if (cat === 'restaurant' || /restaurant|pizza|wings|bbq|grill|cafe|coffee/i.test(`${biz.name} ${biz.description}`)) {
		ideas.push({
			title: 'Post-Game Meal Partner',
			description: 'After home games, record a short “meal recap” at the restaurant, thank the team and invite families to try a simple code this weekend. Keep it friendly, school-appropriate, and tag the location.',
			suggestedCompensations: compTags(base, ['discount_code'])
		})
		ideas.push({
			title: 'Family Night Highlight',
			description: 'Share one post announcing a family-night special and one follow-up story showing you and teammates eating there (with permission). This builds traffic and creates a fun local routine.',
			suggestedCompensations: compTags(base, ['free_product_or_service', 'referral_bonus'])
		})
	}

	if (cat === 'gym' || /gym|training|fitness/i.test(`${biz.name} ${biz.description}`)) {
		ideas.push({
			title: 'Training Spotlight Mini-Series',
			description: 'Create 3–4 short clips showing one drill per week at the gym and how it helps your performance. Emphasize safe form and coach-approved work. Tag the gym each episode.',
			suggestedCompensations: compTags(base, ['flat_fee'])
		})
		ideas.push({
			title: 'Off-Season Strength Check-In',
			description: 'One monthly post on progress with a simple tip for younger athletes. This positions you as a positive role model and sends motivated prospects to the gym.',
			suggestedCompensations: base
		})
	}

	if (cat === 'retail' || /retail|apparel|gear|shop/i.test(`${biz.name} ${biz.description}`)) {
		ideas.push({
			title: 'Gameday Fit Feature',
			description: 'Before a home game, share a single photo or reel featuring one item from the store. Keep it clean and school-friendly, and mention where parents can buy it.',
			suggestedCompensations: compTags(base, ['revenue_share'])
		})
		ideas.push({
			title: 'Back-to-School Sports Pack',
			description: 'Bundle essential items for younger athletes (e.g., socks, bottle, wrap). Do one overview post plus a story shoutout linking to the store page or pickup info.',
			suggestedCompensations: compTags(base, ['referral_bonus'])
		})
	}

	// Faith/community or general local businesses
	if (cat === 'faith' || /faith|church|ministry|community/i.test(`${biz.name} ${biz.description}`) || ideas.length < 3) {
		ideas.push({
			title: 'Community Uplift Story',
			description: 'Share a short reflection on perseverance or gratitude tied to a community event the organization supports. Keep it respectful and inclusive, approved by your parent/guardian.',
			suggestedCompensations: compTags(base, ['custom'])
		})
	}

	// Safe caps and ensure we have 3–5
	return capIdeas(ideas, 3, 5)
}

function buildOverview(fit: FitRating, bizName: string): string {
	if (fit === 'PERFECT FIT' || fit === 'GOOD FIT') {
		return `This looks like a strong partnership with ${bizName}. Your audience and content style can naturally highlight what they offer and create positive, trackable local buzz. Keep things simple, consistent, and easy for families to act on.`
	}
	return `If you decide to pursue ${bizName}, focus on one clear test that fits your schedule and school rules. Start small, measure response, and only expand if it genuinely helps your community and time balance.`
}

function buildPositioning(ath: AthleteProfile): string {
	const parts: string[] = []
	parts.push('Local role model: encourage younger athletes and families in a positive, inclusive way.')
	parts.push('Student-athlete voice: keep tone respectful, age-appropriate, and coach-approved.')
	parts.push('Training / performance storyteller: share small, honest progress with safety and balance.')
	parts.push('Always involve a parent/guardian and follow school/state NIL guidelines.')
	return parts.join(' ')
}

export function buildMatchStrategy(params: {
	athleteProfile: AthleteProfile
	business: Business
	fit: FitRating
}): MatchStrategy {
	const { athleteProfile, business, fit } = params
	return {
		overview: buildOverview(fit, business.name),
		positioning: buildPositioning(athleteProfile),
		ideas: buildIdeas(athleteProfile, business, fit)
	}
}


