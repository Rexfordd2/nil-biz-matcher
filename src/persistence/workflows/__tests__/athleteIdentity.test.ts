import { describe, expect, it } from 'vitest'
import {
	LOCAL_ANONYMOUS_ATHLETE_KEY,
	isCloudEligibleAthleteId,
	toActiveAthleteId,
	toLocalAthleteStorageKey,
} from '../athleteIdentity'

describe('athlete identity (local vs cloud)', () => {
	it('treats missing / anonymous / blank as null ActiveAthleteId', () => {
		expect(toActiveAthleteId(undefined)).toBeNull()
		expect(toActiveAthleteId(null)).toBeNull()
		expect(toActiveAthleteId('')).toBeNull()
		expect(toActiveAthleteId('   ')).toBeNull()
		expect(toActiveAthleteId('anonymous')).toBeNull()
		expect(toActiveAthleteId(LOCAL_ANONYMOUS_ATHLETE_KEY)).toBeNull()
	})

	it('preserves real athlete ids for cloud', () => {
		expect(toActiveAthleteId('ath-1')).toBe('ath-1')
		expect(isCloudEligibleAthleteId(toActiveAthleteId('ath-1'))).toBe(true)
		expect(isCloudEligibleAthleteId(null)).toBe(false)
		expect(isCloudEligibleAthleteId(toActiveAthleteId('anonymous'))).toBe(false)
		expect(isCloudEligibleAthleteId('   ')).toBe(false)
		expect(isCloudEligibleAthleteId(' ath-1 ')).toBe(false)
	})

	it('maps null active id to legacy anonymous localStorage key only', () => {
		expect(toLocalAthleteStorageKey(null)).toBe(LOCAL_ANONYMOUS_ATHLETE_KEY)
		expect(toLocalAthleteStorageKey('ath-1')).toBe('ath-1')
	})
})
