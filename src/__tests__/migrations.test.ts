import { describe, it, expect } from 'vitest'
import { migrateAthleteProfile } from '../utils/migrations'

describe('migrateAthleteProfile', () => {
	it('migrates legacy single sport/position and social to new arrays', () => {
		const legacy = {
			id: 'ath-1',
			name: 'Alex Runner',
			school: 'West HS',
			schoolLevel: 'High School',
			sport: 'Track',
			position: 'Sprinter',
			social: { handle: '@alex', link: 'https://tiktok.com/@alex' }
		}
		const migrated = migrateAthleteProfile(legacy)
		expect(migrated).not.toBeNull()
		expect(migrated!.sports).toEqual([{ sportName: 'Track', positions: ['Sprinter'] }])
		expect(migrated!.socialHandles).toEqual([
			{ platform: 'Other', handle: '@alex', url: 'https://tiktok.com/@alex' }
		])
		// Level string derived from schoolLevel and lowercased
		expect(migrated!.level).toBe('high school')
		// contentStyles normalized to string[]
		expect(Array.isArray(migrated!.contentStyles)).toBe(true)
	})

	it('preserves already-structured multi-sport and socialHandles', () => {
		const input = {
			id: 'ath-2',
			name: 'Jamie TwoSport',
			school: 'Central Prep',
			schoolLevel: 'High School',
			sports: [
				{ sportName: 'Basketball', positions: ['Guard', 'Wing'] },
				{ sportName: 'Soccer', positions: ['Forward'] }
			],
			socialHandles: [
				{ platform: 'Instagram', handle: '@jamie', url: 'https://instagram.com/jamie' }
			],
			contentStyles: ['Game highlights', 'Training clips']
		}
		const migrated = migrateAthleteProfile(input)
		expect(migrated).not.toBeNull()
		expect(migrated!.sports.length).toBe(2)
		expect(migrated!.sports[0].positions).toEqual(['Guard', 'Wing'])
		expect(migrated!.socialHandles!.length).toBe(1)
	})

	it('ensures socialHandles is an empty array when no social is present', () => {
		const input = {
			id: 'ath-3',
			name: 'Taylor Minimal',
			school: 'North HS',
			schoolLevel: 'High School'
		}
		const migrated = migrateAthleteProfile(input)
		expect(migrated).not.toBeNull()
		expect(migrated!.socialHandles).toEqual([])
	})
})


