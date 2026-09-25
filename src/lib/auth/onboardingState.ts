/** Local onboarding completion marker keyed by auth user id. */

const STORAGE_KEY_PREFIX = 'athleteLedger:onboarding:seen:'
const INTENT_KEY_PREFIX = 'athleteLedger:onboarding:intent:'

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

/** "What are you here to work on first?" — drives only Today's initial recommendation. */
export const ONBOARDING_INTENTS = ['recruiting', 'nil_identity', 'opportunities', 'career_network'] as const

export type OnboardingIntent = (typeof ONBOARDING_INTENTS)[number]

export const ONBOARDING_INTENT_LABELS: Record<OnboardingIntent, string> = {
	recruiting: 'Recruiting',
	nil_identity: 'Build my NIL/profile identity',
	opportunities: 'Find/manage opportunities',
	career_network: 'Career & network',
}

export function parseOnboardingIntent(value: unknown): OnboardingIntent | null {
	return typeof value === 'string' && (ONBOARDING_INTENTS as readonly string[]).includes(value)
		? (value as OnboardingIntent)
		: null
}

export function onboardingIntentStorageKey(userId: string): string {
	return `${INTENT_KEY_PREFIX}${userId}`
}

export function readOnboardingIntent(userId: string | null | undefined): OnboardingIntent | null {
	if (!userId || typeof localStorage === 'undefined') return null
	try {
		return parseOnboardingIntent(localStorage.getItem(onboardingIntentStorageKey(userId)))
	} catch {
		return null
	}
}

export function saveOnboardingIntent(userId: string, intent: OnboardingIntent): void {
	if (!userId || typeof localStorage === 'undefined') return
	try {
		localStorage.setItem(onboardingIntentStorageKey(userId), intent)
	} catch {
		// ignore quota / private mode
	}
}

/**
 * Account metadata (synced across devices) wins over the local mirror.
 */
export function resolveOnboardingIntent(
	userId: string | null | undefined,
	metadataIntent: unknown
): OnboardingIntent | null {
	return parseOnboardingIntent(metadataIntent) ?? readOnboardingIntent(userId)
}

/** Only same-origin app paths are accepted as post-onboarding destinations. */
export function safeReturnPath(value: string | null | undefined, fallback = '/app/today'): string {
	if (!value || typeof value !== 'string') return fallback
	if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
	return value
}

/** Destination after authenticated signup/login when onboarding is incomplete. */
export function postAuthDestination(userId: string | null | undefined, preferred = '/app/today'): string {
	if (userId && !hasCompletedOnboarding(userId)) {
		return `/onboarding?returnTo=${encodeURIComponent(preferred || '/app/today')}`
	}
	return preferred || '/app/today'
}
