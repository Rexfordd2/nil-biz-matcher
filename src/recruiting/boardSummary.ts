/**
 * Recruiting Board status semantics (user_targets.status).
 * Source of truth: RecruitingBoard / Recruiting My Targets UI and supabase/recruiting.sql default.
 */
export const RECRUITING_BOARD_STATUSES = [
	'To Contact',
	'Contacted',
	'In Progress',
	'Offer/Visit',
	'Closed',
] as const

export type RecruitingBoardStatus = (typeof RECRUITING_BOARD_STATUSES)[number]

export type RecruitingBoardStatusRow = {
	status?: string | null
}

export type RecruitingBoardSummary = {
	/** All rows counted once. */
	total: number
	/** Counts aligned with Recruiting Board columns. */
	byStatus: Record<RecruitingBoardStatus, number>
	/**
	 * Rows whose stored status was null/empty/unknown and therefore bucketed into
	 * "To Contact" to match RecruitingBoard column placement.
	 */
	normalizedToContact: number
}

function emptyByStatus(): Record<RecruitingBoardStatus, number> {
	return {
		'To Contact': 0,
		Contacted: 0,
		'In Progress': 0,
		'Offer/Visit': 0,
		Closed: 0,
	}
}

function isKnownStatus(value: string): value is RecruitingBoardStatus {
	return (RECRUITING_BOARD_STATUSES as readonly string[]).includes(value)
}

/**
 * Pure aggregator for Dashboard / summary consumers.
 * Matches RecruitingBoard column rules:
 * - null/empty → "To Contact"
 * - unknown status → "To Contact"
 * - each row counted exactly once in total and exactly once in byStatus
 */
export function aggregateRecruitingBoardSummary(
	rows: RecruitingBoardStatusRow[] | null | undefined
): RecruitingBoardSummary {
	const byStatus = emptyByStatus()
	let normalizedToContact = 0
	const list = Array.isArray(rows) ? rows : []

	for (const row of list) {
		const raw = row?.status
		if (raw == null || String(raw).trim() === '') {
			byStatus['To Contact']++
			normalizedToContact++
			continue
		}
		const status = String(raw)
		if (isKnownStatus(status)) {
			byStatus[status]++
		} else {
			byStatus['To Contact']++
			normalizedToContact++
		}
	}

	return {
		total: list.length,
		byStatus,
		normalizedToContact,
	}
}

/** Friendly metric labels derived from board statuses (no invented fields). */
export const RECRUITING_SUMMARY_METRICS = {
	totalTargets: { key: 'total' as const, label: 'Total Targets' },
	inProgress: { key: 'In Progress' as const, label: 'In Progress' },
}
