import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
	athleteHouzeReturnUrl,
	athleteHouzeSyncMessage,
	isAthleteHouzeReportingAccount,
} from '../lib/athleteHouzeHandoff'

/** Small ecosystem context strip shown when NIL Roster was opened from Athlete Houze. */
export default function AthleteHouzeHandoffBanner() {
	const [reportingAccount, setReportingAccount] = useState(false)

	useEffect(() => {
		let cancelled = false
		async function load() {
			if (!supabase) return
			try {
				const { data } = await supabase.auth.getSession()
				if (!cancelled) setReportingAccount(isAthleteHouzeReportingAccount(data.session?.user.app_metadata))
			} catch {
				if (!cancelled) setReportingAccount(false)
			}
		}
		void load()
		return () => {
			cancelled = true
		}
	}, [])

	return (
		<div
			className="border-b border-border bg-surface px-4 py-2 text-xs text-gray-300"
			data-testid="athlete-houze-handoff"
			role="region"
			aria-label="Athlete Houze context"
		>
			<div className="mx-auto max-w-6xl flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
				<div className="min-w-0">
					<span className="font-semibold text-white" data-testid="athlete-houze-handoff-label">
						Opened from Athlete Houze
					</span>
					<span className="block sm:inline sm:ml-2" data-testid="athlete-houze-sync-status">
						{athleteHouzeSyncMessage(reportingAccount)}
					</span>
				</div>
				<a
					href={athleteHouzeReturnUrl()}
					rel="noopener"
					className="shrink-0 underline font-semibold text-white"
					data-testid="athlete-houze-return"
				>
					Return to Athlete Houze
				</a>
			</div>
		</div>
	)
}
