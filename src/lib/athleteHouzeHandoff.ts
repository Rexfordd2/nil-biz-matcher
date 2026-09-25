/**
 * Athlete Houze → NIL Roster handoff context.
 *
 * The return destination is a fixed constant. No query/state value is ever
 * used as a return URL, so the handoff cannot become an open redirect.
 */

export const ATHLETE_HOUZE_HOME_URL = 'https://athletehouze.com' as const
export const ATHLETE_HOUZE_SOURCE_VALUE = 'athlete-houze' as const
export const ATHLETE_HOUZE_SESSION_KEY = 'nilRoster:handoff:source'

export const ATHLETE_HOUZE_NOT_SYNCING_MESSAGE =
	'Your work is saved in NIL Roster. Athlete Houze is not automatically syncing this activity yet.'
export const ATHLETE_HOUZE_CANARY_REPORTING_MESSAGE =
	'Your work is saved in NIL Roster. This test account reports saved opportunities to Athlete Houze; other activity is not synced.'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function defaultStorage(): StorageLike | null {
	try {
		return typeof sessionStorage !== 'undefined' ? sessionStorage : null
	} catch {
		return null
	}
}

export function isAthleteHouzeSource(search: string | null | undefined): boolean {
	if (!search) return false
	try {
		return new URLSearchParams(search).get('source') === ATHLETE_HOUZE_SOURCE_VALUE
	} catch {
		return false
	}
}

/**
 * Remember the handoff for this browser tab so the context survives in-app
 * navigation (which drops the query string). Returns whether context is active.
 */
export function captureAthleteHouzeSource(
	search: string | null | undefined,
	storage: StorageLike | null = defaultStorage()
): boolean {
	const fromQuery = isAthleteHouzeSource(search)
	if (fromQuery && storage) {
		try {
			storage.setItem(ATHLETE_HOUZE_SESSION_KEY, ATHLETE_HOUZE_SOURCE_VALUE)
		} catch {
			// ignore private mode / quota
		}
	}
	return fromQuery || hasAthleteHouzeContext(storage)
}

export function hasAthleteHouzeContext(storage: StorageLike | null = defaultStorage()): boolean {
	if (!storage) return false
	try {
		return storage.getItem(ATHLETE_HOUZE_SESSION_KEY) === ATHLETE_HOUZE_SOURCE_VALUE
	} catch {
		return false
	}
}

/** Always the fixed Athlete Houze home; intentionally takes no input. */
export function athleteHouzeReturnUrl(): typeof ATHLETE_HOUZE_HOME_URL {
	return ATHLETE_HOUZE_HOME_URL
}

/**
 * True only for operator-configured synthetic canary accounts — the only
 * accounts whose activity (saved opportunities) is reported to Athlete Houze.
 */
export function isAthleteHouzeReportingAccount(appMetadata: unknown): boolean {
	if (!appMetadata || typeof appMetadata !== 'object') return false
	const m = appMetadata as Record<string, unknown>
	const externalId = m.athlete_houze_external_id
	return (
		m.workflow_cloud_persistence_canary === true &&
		m.synthetic_test_data === true &&
		typeof externalId === 'string' &&
		/^nil-canary-[A-Za-z0-9._:-]+$/.test(externalId)
	)
}

export function athleteHouzeSyncMessage(reportingAccount: boolean): string {
	return reportingAccount ? ATHLETE_HOUZE_CANARY_REPORTING_MESSAGE : ATHLETE_HOUZE_NOT_SYNCING_MESSAGE
}
