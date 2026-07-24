import { describe, it, expect } from 'vitest'
import type { AthleteProfile } from '../../types'
import {
	collectForbiddenPublicProfileValues,
	getPublicAvailabilityLabels
} from '../publicProfilePrivacy'

/**
 * PR-1 privacy containment: sensitive athlete fields must never be treated as public-safe.
 * PublicProfile.tsx omits these values from the default public/printable surface.
 */
function makeAthleteWithSecrets(): AthleteProfile {
	return {
		id: 'athlete-privacy-test',
		name: 'Jordan Public',
		school: 'Central High',
		schoolLevel: 'High School',
		level: 'High School',
		sports: [{ sportName: 'Football', positions: ['WR'] }],
		location: 'Austin, TX',
		social: { handle: '@jordan' },
		socialHandles: [{ platform: 'Instagram', handle: '@jordan' }],
		contentStyles: [],
		personality: 'Competitive',
		values: [],
		timePerWeekHours: 5,
		professionalism: 'Developing',
		mediaKit: {
			heroImages: [],
			logos: [],
			brandColors: [],
			samplePosts: []
		},
		supportTeam: [
			{
				role: 'head_coach',
				name: 'Coach Secret',
				email: 'coach.secret@example.com',
				phone: '555-0100'
			}
		],
		trustedCircle: [
			{
				role: 'parent_guardian',
				name: 'Guardian Secret',
				relationship: 'Mother',
				email: 'guardian.secret@example.com',
				phone: '555-0199'
			}
		],
		academicProfile: {
			schoolName: 'Central High',
			level: 'high_school',
			gpaRange: '3_5_plus',
			advisorName: 'Advisor Secret',
			advisorEmail: 'advisor.secret@example.com',
			academicInterests: ['Engineering']
		},
		availability: [
			{ label: 'Weekday evenings', days: ['Mon', 'Wed'], timeRange: '5–8pm' }
		],
		performanceStory: {
			keyMilestones: ['All-district'],
			currentFocus: 'Speed',
			futureGoals: ['College football']
		},
		monetizationInterests: ['Local brands'],
		nil: {
			complianceContactEmail: 'compliance.secret@example.com',
			schoolNILPolicyUrl: 'https://example.com/nil-policy',
			associatedCollective: {
				name: 'Example Collective',
				contactName: 'Collective Contact Secret',
				contactEmail: 'collective.secret@example.com',
				notes: 'Private compliance note secret'
			}
		},
		risk: {
			incidents: [
				{
					id: 'inc-1',
					athleteId: 'athlete-privacy-test',
					date: '2026-01-01',
					type: 'other',
					summary: 'Incident summary secret',
					actionsTaken: 'Actions taken secret'
				}
			],
			lastReputationScan: {
				notes: 'Reputation notes secret'
			}
		},
		createdAt: Date.now()
	}
}

describe('publicProfilePrivacy', () => {
	it('collects all forbidden sensitive values from a fully populated athlete', () => {
		const athlete = makeAthleteWithSecrets()
		const forbidden = collectForbiddenPublicProfileValues(athlete)

		expect(forbidden).toEqual(
			expect.arrayContaining([
				'compliance.secret@example.com',
				'Collective Contact Secret',
				'collective.secret@example.com',
				'Private compliance note secret',
				'3_5_plus',
				'advisor.secret@example.com',
				'Advisor Secret',
				'coach.secret@example.com',
				'555-0100',
				'Coach Secret',
				'Guardian Secret',
				'guardian.secret@example.com',
				'555-0199',
				'Mother',
				'Incident summary secret',
				'Actions taken secret',
				'Reputation notes secret'
			])
		)
	})

	it('exposes only general availability labels (not schedule days/times)', () => {
		const athlete = makeAthleteWithSecrets()
		expect(getPublicAvailabilityLabels(athlete)).toEqual(['Weekday evenings'])
		expect(getPublicAvailabilityLabels(athlete).join(' ')).not.toContain('Mon')
		expect(getPublicAvailabilityLabels(athlete).join(' ')).not.toContain('5–8pm')
	})

	it('documents PublicProfile display contract: forbidden markers must not be rendered', () => {
		// Contract check: PublicProfile.tsx must not include these substrings in JSX paths.
		// This is a static source-scan companion to the value collector above.
		const fs = require('node:fs') as typeof import('node:fs')
		const path = require('node:path') as typeof import('node:path')
		const file = path.join(__dirname, '../../components/PublicProfile.tsx')
		const src = fs.readFileSync(file, 'utf8')

		const bannedPatterns = [
			'complianceContactEmail',
			'contactEmail',
			'contactName',
			'gpaRange',
			'advisorEmail',
			'advisorName',
			'supportTeam',
			'trustedCircle',
			'risk',
			'timeRange',
			'.days'
		]

		for (const pattern of bannedPatterns) {
			expect(src.includes(pattern), `PublicProfile.tsx must not reference ${pattern}`).toBe(false)
		}

		// Safe public NIL fields may remain (policy URL + collective org name only)
		expect(src.includes('schoolNILPolicyUrl')).toBe(true)
		expect(src.includes('associatedCollective')).toBe(true)
	})
})
