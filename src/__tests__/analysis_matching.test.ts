import { describe, it, expect } from 'vitest'
import { autoAnalyzeBusiness } from '../utils/analysis'
import { evaluateMatch, recommendLevels } from '../utils/matching'
import type { AthleteProfile, Business } from '../types'

describe('autoAnalyzeBusiness levelGuess', () => {
	function makeBiz(description: string): Business {
		return {
			id: `b-${Math.random()}`,
			name: 'TestCo',
			location: 'Anywhere',
			description,
			createdAt: Date.now()
		}
	}

	it('detects NATIONAL from description cues', () => {
		const biz = makeBiz('A nationwide franchise with locations across the USA.')
		const analysis = autoAnalyzeBusiness(biz)
		expect(analysis.levelGuess).toBe('NATIONAL')
	})

	it('detects REGIONAL from description cues', () => {
		const biz = makeBiz('Serving a multi-location region with statewide coverage.')
		const analysis = autoAnalyzeBusiness(biz)
		expect(analysis.levelGuess).toBe('REGIONAL')
	})

	it('defaults to LOCAL when no broader cues present', () => {
		const biz = makeBiz('A neighborhood cafe serving local families.')
		const analysis = autoAnalyzeBusiness(biz)
		expect(analysis.levelGuess).toBe('LOCAL')
	})
})

describe('recommendLevels', () => {
	function makeAthlete(followers: number, schoolLevel: AthleteProfile['schoolLevel']): AthleteProfile {
		return {
			id: 'ath-x',
			name: 'Athlete',
			school: 'School',
			schoolLevel,
			sports: [],
			location: 'Town',
			social: { followers },
			socialHandles: [],
			contentStyles: [],
			personality: '',
			values: [],
			timePerWeekHours: 0,
			professionalism: 'Developing',
			createdAt: Date.now()
		}
	}

	it('returns LOCAL only for low-followers non-viral profiles', () => {
		const levels = recommendLevels(makeAthlete(100, 'High School'))
		expect(levels).toEqual(['LOCAL'])
	})

	it('returns LOCAL and REGIONAL for standout high school athletes', () => {
		const levels = recommendLevels(makeAthlete(3000, 'High School'))
		expect(levels).toEqual(['LOCAL', 'REGIONAL'])
	})

	it('returns LOCAL, REGIONAL, NATIONAL for viral or college', () => {
		const levels1 = recommendLevels(makeAthlete(15000, 'High School'))
		expect(levels1).toEqual(['LOCAL', 'REGIONAL', 'NATIONAL'])
		const levels2 = recommendLevels(makeAthlete(100, 'College'))
		expect(levels2).toEqual(['LOCAL', 'REGIONAL', 'NATIONAL'])
	})
})

describe('evaluateMatch', () => {
	it('yields PERFECT FIT for a very aligned scenario', () => {
		const athlete: AthleteProfile = {
			id: 'ath-1',
			name: 'Power Sprinter',
			school: 'Central HS',
			schoolLevel: 'High School',
			sports: [{ sportName: 'Track', positions: ['Sprinter'] }],
			location: 'Localtown',
			social: { followers: 12000 },
			socialHandles: [],
			contentStyles: ['training'],
			personality: 'Positive leader',
			values: ['grit', 'work'],
			timePerWeekHours: 4,
			professionalism: 'Developing',
			createdAt: Date.now()
		}
		const business: Business = {
			id: 'biz-1',
			name: 'Prime Gym',
			location: 'Localtown',
			description: 'Local gym and fitness training center',
			level: 'LOCAL',
			createdAt: Date.now()
		}
		const res = evaluateMatch(athlete, business)
		expect(res.rating).toBe('PERFECT FIT')
		expect(res.score).toBeGreaterThanOrEqual(85)
	})
})


