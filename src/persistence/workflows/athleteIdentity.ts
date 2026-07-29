/**
 * Separates legacy localStorage athlete partitioning from cloud ownership identity.
 *
 * - LocalAthleteStorageKey may be "anonymous" for pre-profile / flag-off local buckets.
 * - ActiveAthleteId is never "anonymous"; null means no cloud-eligible athlete.
 */

/** Real athlete profile ID for cloud ownership/import, or null when none is selected. */
export type ActiveAthleteId = string | null

/** localStorage partition key under opps.store / deals.store / events.store. */
export type LocalAthleteStorageKey = string

/** Legacy local-only partition used when no athlete profile is selected. */
export const LOCAL_ANONYMOUS_ATHLETE_KEY = 'anonymous' as const

/**
 * Normalize a raw athlete id for cloud runtime use.
 * Empty strings and the fabricated "anonymous" sentinel become null.
 */
export function toActiveAthleteId(raw: string | null | undefined): ActiveAthleteId {
	if (typeof raw !== 'string') return null
	const trimmed = raw.trim()
	if (!trimmed || trimmed === LOCAL_ANONYMOUS_ATHLETE_KEY) return null
	return trimmed
}

/** Map cloud-eligible athlete id (or null) to the legacy localStorage partition key. */
export function toLocalAthleteStorageKey(active: ActiveAthleteId): LocalAthleteStorageKey {
	return active ?? LOCAL_ANONYMOUS_ATHLETE_KEY
}

/** True only for non-empty ids that are safe to pass into cloud planners/repositories. */
export function isCloudEligibleAthleteId(id: ActiveAthleteId): id is string {
	return typeof id === 'string' && id.length > 0 && id !== LOCAL_ANONYMOUS_ATHLETE_KEY
}
