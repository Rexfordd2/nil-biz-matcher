import { describe, expect, it } from 'vitest'
import type { AthleteProfile } from '../../../types'
import { computeTodayPlan, passportBasicsComplete, type TodayInputs } from '../nextAction'

function athlete(overrides: Partial<AthleteProfile> = {}): AthleteProfile {
	return {
		id: 'a1',
		name: 'Jordan Lee',
		school: 'Central High',
		schoolLevel: 'High School',
		sports: [{ sportName: 'Soccer', positions: ['Forward'] }],
		socialHandles: [],
		contentStyles: [],
		personality: '',
		values: [],
		timePerWeekHours: 3,
		professionalism: 'Medium',
		...overrides,
	} as AthleteProfile
}

function inputs(overrides: Partial<TodayInputs> = {}): TodayInputs {
	return {
		role: 'athlete_18_plus',
		intent: null,
		athlete: null,
		savedPrograms: 0,
		outreachDrafts: 0,
		opportunityStatuses: [],
		...overrides,
	}
}

describe('computeTodayPlan', () => {
	it('adult athlete first run: one action with why, done-when, and Step 1 of 3', () => {
		const plan = computeTodayPlan(inputs({ role: 'athlete_18_plus', intent: 'recruiting' }))
		expect(plan.current.id).toBe('passport_basics')
		expect(plan.current.why.length).toBeGreaterThan(0)
		expect(plan.current.doneWhen.length).toBeGreaterThan(0)
		expect(plan.current.path).toBe('/app/passport/profile')
		expect(plan.stepNumber).toBe(1)
		expect(plan.totalSteps).toBe(3)
		expect(plan.guardianNote).toBeNull()
	})

	it('under-18 athlete first run adds a guardian note and never recommends sending', () => {
		const plan = computeTodayPlan(
			inputs({ role: 'athlete_under_18', intent: 'recruiting', athlete: athlete(), savedPrograms: 1 })
		)
		expect(plan.current.id).toBe('draft_outreach')
		expect(plan.current.path).toBe('/app/recruiting/drafts')
		expect(plan.current.title.toLowerCase()).not.toContain('send')
		expect(plan.guardianNote).toMatch(/parent or guardian/i)
		expect(plan.stepNumber).toBe(3)
	})

	it('parent/guardian gets a single guardian action without step progress', () => {
		const plan = computeTodayPlan(inputs({ role: 'parent_guardian', intent: 'recruiting' }))
		expect(plan.current.id).toBe('guardian_rules')
		expect(plan.current.path).toBe('/app/learn/guidelines')
		expect(plan.stepNumber).toBeNull()
		expect(plan.totalSteps).toBeNull()
	})

	it('recruiting intent advances through passport → program → draft', () => {
		const base = inputs({ intent: 'recruiting', athlete: athlete() })
		expect(computeTodayPlan(base).current.id).toBe('save_program')
		expect(computeTodayPlan({ ...base, savedPrograms: 2 }).current.id).toBe('draft_outreach')
		const done = computeTodayPlan({ ...base, savedPrograms: 2, outreachDrafts: 1 })
		expect(done.allComplete).toBe(true)
		expect(done.completedSteps).toBe(3)
	})

	it('NIL intent recommends identity steps instead of recruiting', () => {
		const first = computeTodayPlan(inputs({ intent: 'nil_identity' }))
		expect(first.trackLabel).toMatch(/NIL/)
		expect(first.current.id).toBe('passport_basics')
		const second = computeTodayPlan(inputs({ intent: 'nil_identity', athlete: athlete() }))
		expect(second.current.id).toBe('story_social')
		expect(second.stepNumber).toBe(2)
		const third = computeTodayPlan(
			inputs({
				intent: 'nil_identity',
				athlete: athlete({ personality: 'Team-first', socialHandles: [{ platform: 'IG', handle: '@jl' }] }),
			})
		)
		expect(third.current.id).toBe('values_styles')
	})

	it('opportunities and career intents use saved state for completion', () => {
		const opp = computeTodayPlan(inputs({ intent: 'opportunities', athlete: athlete(), opportunityStatuses: ['idea'] }))
		expect(opp.current.id).toBe('advance_opportunity')
		const career = computeTodayPlan(
			inputs({
				intent: 'career_network',
				athlete: athlete({ trustedCircle: [{ role: 'mentor', name: 'Sam' }] }),
			})
		)
		expect(career.current.id).toBe('academic_interests')
	})

	it('passport basics require name, school, and a sport', () => {
		expect(passportBasicsComplete(null)).toBe(false)
		expect(passportBasicsComplete(athlete({ sports: [] }))).toBe(false)
		expect(passportBasicsComplete(athlete({ school: ' ' }))).toBe(false)
		expect(passportBasicsComplete(athlete())).toBe(true)
	})
})
