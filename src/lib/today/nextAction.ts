import type { AthleteProfile, OpportunityStatus } from '../../types'
import type { OnboardingIntent } from '../auth/onboardingState'
import { isMinorAthlete, type ProductRole } from '../productRole'

/**
 * Today's single "Do this next" recommendation. Pure: derived only from state
 * NIL Roster already stores (passport, saved programs, drafts, opportunities).
 */

export type TodayInputs = {
	role: ProductRole | null
	intent: OnboardingIntent | null
	athlete: AthleteProfile | null
	/** Programs saved in Recruiting (local list + Recruiting Board rows). */
	savedPrograms: number
	/** Saved Outreach Drafts plus recorded outreach. */
	outreachDrafts: number
	opportunityStatuses: OpportunityStatus[]
}

export type TodayStep = {
	id: string
	title: string
	why: string
	doneWhen: string
	ctaLabel: string
	path: string
	complete: boolean
}

export type TodayPlan = {
	trackLabel: string
	current: TodayStep
	/** 1-based index of `current` in the track, or null for single-action roles. */
	stepNumber: number | null
	totalSteps: number | null
	completedSteps: number
	allComplete: boolean
	guardianNote: string | null
}

function hasText(v: unknown): boolean {
	return typeof v === 'string' && v.trim().length > 0
}

export function passportBasicsComplete(a: AthleteProfile | null): boolean {
	if (!a) return false
	const hasSport = Array.isArray(a.sports) && a.sports.some(s => hasText(s?.sportName))
	return hasText(a.name) && hasText(a.school) && hasSport
}

function passportStep(a: AthleteProfile | null, why: string): TodayStep {
	return {
		id: 'passport_basics',
		title: 'Add your name, school, and sport to Athlete Passport',
		why,
		doneWhen: 'Your name, school, and at least one sport are saved in Athlete Passport.',
		ctaLabel: 'Open Athlete Passport',
		path: '/app/passport/profile',
		complete: passportBasicsComplete(a),
	}
}

const ADVANCED_OPPORTUNITY: OpportunityStatus[] = ['pitched', 'in_discussion', 'launched']

function trackSteps(intent: OnboardingIntent, s: TodayInputs): { label: string; steps: TodayStep[] } {
	const a = s.athlete
	switch (intent) {
		case 'recruiting':
			return {
				label: 'Recruiting',
				steps: [
					passportStep(a, 'Coaches look for these first, and every recruiting tool uses them.'),
					{
						id: 'save_program',
						title: 'Save one program you are interested in',
						why: 'A short list of real programs keeps your outreach focused.',
						doneWhen: 'At least one program is saved to your recruiting list.',
						ctaLabel: 'Search programs',
						path: '/app/recruiting/search',
						complete: s.savedPrograms > 0,
					},
					{
						id: 'draft_outreach',
						title: 'Write your first coach outreach draft',
						why: 'A reviewed draft is ready to copy into your own email when the time is right.',
						doneWhen: 'One outreach draft is saved in Outreach Drafts.',
						ctaLabel: 'Open Outreach Drafts',
						path: '/app/recruiting/drafts',
						complete: s.outreachDrafts > 0,
					},
				],
			}
		case 'nil_identity':
			return {
				label: 'NIL & profile identity',
				steps: [
					passportStep(a, 'Your Passport is the profile brands and partners see first.'),
					{
						id: 'story_social',
						title: 'Add a short story and one social handle',
						why: 'Brands decide quickly; a clear story and where to find you make that easy.',
						doneWhen: 'Your personality/story text and at least one social handle are saved.',
						ctaLabel: 'Edit your story',
						path: '/app/passport/profile',
						complete: Boolean(a && hasText(a.personality) && (a.socialHandles || []).some(h => hasText(h?.handle))),
					},
					{
						id: 'values_styles',
						title: 'Choose what you stand for',
						why: 'Values and content styles drive which partnerships fit you.',
						doneWhen: 'At least one value and one content style are selected.',
						ctaLabel: 'Pick values and styles',
						path: '/app/passport/profile',
						complete: Boolean(a && (a.values || []).length > 0 && (a.contentStyles || []).length > 0),
					},
				],
			}
		case 'opportunities':
			return {
				label: 'Opportunities',
				steps: [
					passportStep(a, 'Opportunity matching starts from your sport, school, and profile.'),
					{
						id: 'first_opportunity',
						title: 'Add your first opportunity',
						why: 'Tracking one real lead shows you the whole pipeline.',
						doneWhen: 'At least one opportunity is saved in your pipeline.',
						ctaLabel: 'Open pipeline',
						path: '/app/opportunities/pipeline',
						complete: s.opportunityStatuses.length > 0,
					},
					{
						id: 'advance_opportunity',
						title: 'Move one opportunity to Pitched',
						why: 'Progress comes from following up, not from collecting leads.',
						doneWhen: 'One opportunity is marked Pitched, In discussion, or Launched.',
						ctaLabel: 'Update an opportunity',
						path: '/app/opportunities/pipeline',
						complete: s.opportunityStatuses.some(st => ADVANCED_OPPORTUNITY.includes(st)),
					},
				],
			}
		case 'career_network':
			return {
				label: 'Career & network',
				steps: [
					passportStep(a, 'Mentors and advisors can only help once they know who you are.'),
					{
						id: 'support_team',
						title: 'Add one person to your support team',
						why: 'Your network starts with the coaches, mentors, and family already helping you.',
						doneWhen: 'At least one support team or trusted circle contact is saved in your Passport.',
						ctaLabel: 'Add a contact',
						path: '/app/passport/profile',
						complete: Boolean(a && ((a.supportTeam || []).length > 0 || (a.trustedCircle || []).length > 0)),
					},
					{
						id: 'academic_interests',
						title: 'Add your academic interests',
						why: 'Career paths start from what you want to study and do after sport.',
						doneWhen: 'At least one academic interest is saved in your Passport.',
						ctaLabel: 'Add interests',
						path: '/app/passport/profile',
						complete: Boolean(a && (a.academicProfile?.academicInterests || []).length > 0),
					},
				],
			}
	}
}

function singleAction(label: string, step: Omit<TodayStep, 'complete'>): TodayPlan {
	return {
		trackLabel: label,
		current: { ...step, complete: false },
		stepNumber: null,
		totalSteps: null,
		completedSteps: 0,
		allComplete: false,
		guardianNote: null,
	}
}

export function computeTodayPlan(s: TodayInputs): TodayPlan {
	if (s.role === 'parent_guardian') {
		return singleAction('Parent / guardian', {
			id: 'guardian_rules',
			title: 'Review the NIL rules for student-athletes',
			why: 'Athletes under 18 need a parent or guardian involved in any agreement.',
			doneWhen: 'You have read the guidelines and know what to review with your athlete.',
			ctaLabel: 'Read NIL guidelines',
			path: '/app/learn/guidelines',
		})
	}
	if (s.role === 'coach_staff' || s.role === 'agent_rep') {
		return singleAction('Recruiting support', {
			id: 'staff_board',
			title: 'Open the Recruiting Board',
			why: 'The board is where programs and follow-ups are organized.',
			doneWhen: 'You have reviewed the programs on the board.',
			ctaLabel: 'Open Recruiting Board',
			path: '/app/recruiting/board',
		})
	}
	if (s.role === 'business_brand') {
		return singleAction('Business / brand', {
			id: 'brand_pipeline',
			title: 'Review the opportunity pipeline',
			why: 'The pipeline shows where partnerships stand.',
			doneWhen: 'You have reviewed the pipeline.',
			ctaLabel: 'Open pipeline',
			path: '/app/opportunities/pipeline',
		})
	}

	const { label, steps } = trackSteps(s.intent ?? 'nil_identity', s)
	const completedSteps = steps.filter(st => st.complete).length
	const nextIndex = steps.findIndex(st => !st.complete)
	const allComplete = nextIndex === -1
	const index = allComplete ? steps.length - 1 : nextIndex
	const minor = isMinorAthlete(s.role)
	return {
		trackLabel: label,
		current: steps[index],
		stepNumber: index + 1,
		totalSteps: steps.length,
		completedSteps,
		allComplete,
		guardianNote: minor
			? 'Because you are under 18, review drafts and any agreement with a parent or guardian before anything is sent or signed.'
			: null,
	}
}
