import type { ProfileSuggestion } from './types'

export const PROFILE_SUGGESTIONS: ProfileSuggestion[] = [
	{
		id: 'wr-socal-local-sports-drink',
		type: 'local_brand_idea',
		title: 'Potential deal idea: Local sports drink brands',
		description: 'You play WR and are in SoCal. Consider outreach to local hydration or sports drink brands for simple post-practice content.',
		conditions: {
			sports: ['football'],
			positions: ['WR', 'Wide Receiver'],
			regions: ['CA'],
			minFollowers: 800,
			contentStyles: ['short-form video', 'reels', 'tiktoks'],
			monetizationInterests: ['brand_sponsorship']
		}
	},
	{
		id: 'rb-texas-protein-shops',
		type: 'local_brand_idea',
		title: 'Potential deal idea: Protein shop or smoothie bar',
		description: 'Texas RBs often see success with neighborhood smoothie bars or protein shops—easy, authentic “post-lift” stories.',
		conditions: {
			sports: ['football'],
			positions: ['RB', 'Running Back'],
			regions: ['TX'],
			minFollowers: 500,
			contentStyles: ['stories', 'short-form video'],
			monetizationInterests: ['brand_sponsorship', 'affiliate']
		}
	},
	{
		id: 'content-bts-series',
		type: 'content_idea',
		title: 'Behind-the-scenes mini-series',
		description: 'Share two “day in the life” clips each week—classes, practice, recovery. Keep it school-appropriate and positive.',
		conditions: {
			contentStyles: ['vlog', 'behind-the-scenes', 'short-form video']
		}
	},
	{
		id: 'training-wr-route-lab',
		type: 'training_resource',
		title: 'WR Route-Running Lab',
		description: 'Focus sessions on releases, stems, and top-of-route breaks. Film one drill per week and reflect on progress.',
		conditions: {
			sports: ['football'],
			positions: ['WR', 'Wide Receiver']
		}
	},
	{
		id: 'event-community-clinic',
		type: 'event_idea',
		title: 'Host a community skills clinic',
		description: 'Plan a small clinic for youth. Keep it educational and safe; capture a short recap video for your profile.',
		conditions: {
			sports: ['football', 'basketball', 'soccer', 'baseball', 'softball']
		}
	},
	{
		id: 'content-educational-tips',
		type: 'content_idea',
		title: 'Educational “1 tip per week” series',
		description: 'Post one short, constructive tip each week (e.g., drills, recovery, mindset). Parents and coaches appreciate helpful content.',
		conditions: {
			contentStyles: ['educational', 'tutorial', 'short-form video']
		}
	},
	{
		id: 'local-gym-partner',
		type: 'local_brand_idea',
		title: 'Potential deal idea: Local gym/training center',
		description: 'Partner with a nearby gym for an off-season training spotlight—3–4 short clips over a month.',
		conditions: {
			minFollowers: 300,
			monetizationInterests: ['brand_sponsorship', 'events']
		}
	},
	{
		id: 'training-film-review',
		type: 'training_resource',
		title: 'Film review and reflection habit',
		description: 'Record short reflections after reviewing film—what improved, what’s next. Builds self-awareness and credibility.',
		conditions: {
			sports: ['football', 'basketball', 'soccer', 'baseball', 'softball']
		}
	},
	{
		id: 'content-teammate-collab',
		type: 'content_idea',
		title: 'Teammate collab content',
		description: 'Create short collab clips with teammates—routes vs. DBs, 2v2 drills, or trick plays. Tag school and maintain compliance.',
		conditions: {
			contentStyles: ['short-form video', 'collab', 'reels']
		}
	},
	{
		id: 'event-gameweek-routine',
		type: 'event_idea',
		title: 'Gameday routine story set',
		description: 'Document a respectful, school-safe pre-game routine (meals, focus tracks, stretches). Builds consistency and audience connection.',
		conditions: {
			sports: ['football', 'basketball', 'soccer', 'baseball', 'softball']
		}
	}
] satisfies ProfileSuggestion[]


