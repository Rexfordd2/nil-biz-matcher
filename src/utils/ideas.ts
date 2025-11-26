import { AthleteProfile, Business } from '../types'
import { guessCategory } from './analysis'

export function generateIdeas(ath: AthleteProfile, biz: Business): string[] {
	const ideas: string[] = []
	const cat = biz.category || guessCategory(biz.description) || 'general'
	const primaryHandle = (ath.socialHandles && ath.socialHandles[0]?.handle) || ath.social?.handle
	const handle = primaryHandle ? `@${String(primaryHandle).replace(/^@/, '')}` : 'me'

	if (cat === 'restaurant') {
		ideas.push(`Post-game meal promo: quick video at ${biz.name} with a limited-time code for fans`)
		ideas.push(`“Team eats here” carousel after home games, tagging ${biz.name}`)
	}
	if (cat === 'gym') {
		ideas.push(`“Train here” short clips of one lift or drill at ${biz.name}`)
		ideas.push(`4-week strength mini-series presented by ${biz.name}`)
	}
	if (cat === 'retail') {
		ideas.push(`“Gameday fit” photo set featuring one item from ${biz.name}`)
		ideas.push(`Discount code with trackable link in bio for ${biz.name}`)
	}
	if (cat === 'faith') {
		ideas.push(`Uplift post on perseverance with a subtle tag to ${biz.name}`)
	}
	// General ideas
	ideas.push(`Family night or community day event with ${biz.name}, short recap video by ${handle}`)
	ideas.push(`Seasonal campaign (homecoming, playoffs, holidays) with a simple landing link`)
	return ideas.slice(0, 4)
}


