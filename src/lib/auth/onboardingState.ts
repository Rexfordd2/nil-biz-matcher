/** Local onboarding completion marker keyed by auth user id. */

const STORAGE_KEY_PREFIX = 'athleteLedger:onboarding:seen:'

export function onboardingStorageKey(userId: string): string {
	return `${STORAGE_KEY_PREFIX}${userId}`
}

export function hasCompletedOnboarding(userId: string | null | undefined): boolean {
	if (!userId || typeof localStorage === 'undefined') return false
	try {
		return localStorage.getItem(onboardingStorageKey(userId)) === '1'
	} catch {
		return false
	}
}

export function markOnboardingComplete(userId: string): void {
	if (!userId || typeof localStorage === 'undefined') return
	try {
		localStorage.setItem(onboardingStorageKey(userId), '1')
	} catch {
		// ignore quota / private mode
	}
}

/** Destination after authenticated signup/login when onboarding is incomplete. */
export function postAuthDestination(userId: string | null | undefined, preferred = '/app/today'): string {
	if (userId && !hasCompletedOnboarding(userId)) {
		return `/onboarding?returnTo=${encodeURIComponent(preferred || '/app/today')}`
	}
	return preferred || '/app/today'
}
