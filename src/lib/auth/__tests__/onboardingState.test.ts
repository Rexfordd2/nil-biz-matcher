import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
	hasCompletedOnboarding,
	markOnboardingComplete,
	onboardingStorageKey,
	postAuthDestination,
} from '../onboardingState'

describe('onboardingState', () => {
	const store = new Map<string, string>()

	beforeEach(() => {
		store.clear()
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => store.get(key) ?? null,
			setItem: (key: string, value: string) => {
				store.set(key, value)
			},
			removeItem: (key: string) => {
				store.delete(key)
			},
			clear: () => store.clear(),
		})
	})

	it('marks and reads completion per user', () => {
		expect(hasCompletedOnboarding('u1')).toBe(false)
		markOnboardingComplete('u1')
		expect(hasCompletedOnboarding('u1')).toBe(true)
		expect(store.get(onboardingStorageKey('u1'))).toBe('1')
		expect(hasCompletedOnboarding('u2')).toBe(false)
	})

	it('routes incomplete users to onboarding', () => {
		expect(postAuthDestination('new-user', '/app/today')).toBe(
			'/onboarding?returnTo=%2Fapp%2Ftoday',
		)
	})

	it('routes completed users to preferred destination', () => {
		markOnboardingComplete('done-user')
		expect(postAuthDestination('done-user', '/app/settings')).toBe('/app/settings')
	})
})
