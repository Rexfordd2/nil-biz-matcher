import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
	hasCompletedOnboarding,
	markOnboardingComplete,
	onboardingIntentStorageKey,
	onboardingStorageKey,
	parseOnboardingIntent,
	postAuthDestination,
	readOnboardingIntent,
	resolveOnboardingIntent,
	safeReturnPath,
	saveOnboardingIntent,
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

	it('persists the first-focus intent per user next to the onboarding marker', () => {
		expect(readOnboardingIntent('u1')).toBeNull()
		saveOnboardingIntent('u1', 'recruiting')
		expect(store.get(onboardingIntentStorageKey('u1'))).toBe('recruiting')
		expect(onboardingIntentStorageKey('u1')).toBe('athleteLedger:onboarding:intent:u1')
		expect(readOnboardingIntent('u1')).toBe('recruiting')
		expect(readOnboardingIntent('u2')).toBeNull()
	})

	it('account metadata intent wins over the local mirror and invalid values are ignored', () => {
		saveOnboardingIntent('u1', 'recruiting')
		expect(resolveOnboardingIntent('u1', 'nil_identity')).toBe('nil_identity')
		expect(resolveOnboardingIntent('u1', 'send_blast')).toBe('recruiting')
		expect(parseOnboardingIntent('admin')).toBeNull()
		store.set(onboardingIntentStorageKey('u3'), 'not-an-intent')
		expect(readOnboardingIntent('u3')).toBeNull()
	})

	it('only accepts same-origin paths as onboarding returnTo', () => {
		expect(safeReturnPath('/app/recruiting/board')).toBe('/app/recruiting/board')
		expect(safeReturnPath('https://evil.example')).toBe('/app/today')
		expect(safeReturnPath('//evil.example')).toBe('/app/today')
		expect(safeReturnPath('/\\evil.example')).toBe('/app/today')
		expect(safeReturnPath('javascript:alert(1)')).toBe('/app/today')
		expect(safeReturnPath(null)).toBe('/app/today')
	})
})
