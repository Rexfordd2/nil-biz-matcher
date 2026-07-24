import { supabase, supabaseEnvConfigured } from '../lib/supabaseClient'
import {
	aggregateRecruitingBoardSummary,
	type RecruitingBoardSummary,
} from '../recruiting/boardSummary'

export type RecruitingBoardSummaryResult =
	| { ok: true; summary: RecruitingBoardSummary }
	| { ok: false; error: 'unavailable' }

/**
 * Read-only recruiting board summary for the authenticated user.
 * Selects only id + status (no org/coach contact PII).
 * Does not query when userId is missing.
 */
export async function getRecruitingBoardSummary(
	userId: string | null | undefined
): Promise<RecruitingBoardSummaryResult> {
	if (!userId || !supabaseEnvConfigured || !supabase) {
		return { ok: true, summary: aggregateRecruitingBoardSummary([]) }
	}

	const { data, error } = await supabase
		.from('user_targets')
		.select('id, status')
		.eq('user_id', userId)

	if (error) {
		return { ok: false, error: 'unavailable' }
	}

	const rows = Array.isArray(data) ? data : []
	return {
		ok: true,
		summary: aggregateRecruitingBoardSummary(
			rows.map((r) => ({ status: (r as { status?: string | null }).status }))
		),
	}
}
