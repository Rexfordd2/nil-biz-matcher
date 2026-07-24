import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
	aggregateRecruitingBoardSummary,
	type RecruitingBoardSummary,
} from '../recruiting/boardSummary'
import { getRecruitingBoardSummary } from '../services/recruitingBoardSummary'

export type UseRecruitingBoardSummaryResult = {
	summary: RecruitingBoardSummary | null
	loading: boolean
	error: string | null
	signedOut: boolean
}

const EMPTY = aggregateRecruitingBoardSummary([])

/**
 * Dashboard-facing recruiting summary from Supabase user_targets (Recruiting Board).
 * Does not query when signed out. Does not read legacy localStorage recruiting pipeline.
 */
export function useRecruitingBoardSummary(): UseRecruitingBoardSummaryResult {
	const { user, initializing } = useAuth()
	const [summary, setSummary] = useState<RecruitingBoardSummary | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false

		async function run() {
			if (initializing) {
				setLoading(true)
				return
			}

			if (!user?.id) {
				if (!cancelled) {
					setSummary(EMPTY)
					setError(null)
					setLoading(false)
				}
				return
			}

			setLoading(true)
			setError(null)
			const result = await getRecruitingBoardSummary(user.id)
			if (cancelled) return

			if (!result.ok) {
				setSummary(null)
				setError('Recruiting summary unavailable')
				setLoading(false)
				return
			}

			setSummary(result.summary)
			setError(null)
			setLoading(false)
		}

		void run()
		return () => {
			cancelled = true
		}
	}, [user?.id, initializing])

	return {
		summary,
		loading: initializing || loading,
		error,
		signedOut: !initializing && !user,
	}
}
