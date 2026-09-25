import { useMemo } from 'react'
import Button from './ui/Button'
import type { AthleteProfile, Opportunity, OpportunityStatus } from '../types'
import type { OnboardingIntent } from '../lib/auth/onboardingState'
import type { ProductRole } from '../lib/productRole'
import { computeTodayPlan } from '../lib/today/nextAction'
import { load } from '../utils/storage'
import { loadRecruitingV2Store } from '../recruiting/v2/storage'
import { getOutreach, getOutreachDrafts } from '../recruiting/blastStorage'
import { useRecruitingBoardSummary } from '../hooks/useRecruitingBoardSummary'

type Props = {
	role: ProductRole | null
	intent: OnboardingIntent | null
	athlete: AthleteProfile | null
	onNavigate: (path: string) => void
	onChangeFocus?: () => void
}

function localOpportunityStatuses(): OpportunityStatus[] {
	const store = load<Record<string, Opportunity[]>>('opps.store', {})
	if (!store || typeof store !== 'object') return []
	return Object.values(store)
		.flatMap(list => (Array.isArray(list) ? list : []))
		.map(o => o?.status)
		.filter((s): s is OpportunityStatus => typeof s === 'string')
}

function localSavedProgramCount(): number {
	const store = loadRecruitingV2Store()
	return Object.keys(store?.contactsByPlaceId || {}).length
}

/** Today's orientation layer: one next action, why, and how you know it is done. */
export default function TodayNextAction({ role, intent, athlete, onNavigate, onChangeFocus }: Props) {
	const board = useRecruitingBoardSummary()
	const plan = useMemo(
		() =>
			computeTodayPlan({
				role,
				intent,
				athlete,
				savedPrograms: localSavedProgramCount() + (board.summary?.total ?? 0),
				outreachDrafts: getOutreachDrafts().length + getOutreach().length,
				opportunityStatuses: localOpportunityStatuses(),
			}),
		[role, intent, athlete, board.summary?.total]
	)
	const step = plan.current

	return (
		<section className="card border-2 border-brand-red/60" data-testid="today-next-action" aria-labelledby="today-next-action-title">
			<div className="flex flex-wrap items-center justify-between gap-2 mb-2">
				<div className="text-xs uppercase tracking-wide text-gray-400" data-testid="today-track">
					{plan.trackLabel}
				</div>
				{plan.stepNumber !== null && plan.totalSteps !== null && (
					<div className="text-xs font-semibold text-gray-300" data-testid="today-progress">
						{plan.allComplete ? `All ${plan.totalSteps} steps done` : `Step ${plan.stepNumber} of ${plan.totalSteps}`}
					</div>
				)}
			</div>
			<div className="text-sm font-semibold text-brand-red">{plan.allComplete ? 'Nice work — keep it current' : 'Do this next'}</div>
			<h2 id="today-next-action-title" className="headline text-2xl mt-1" data-testid="today-next-action-title">
				{step.title}
			</h2>
			<dl className="mt-3 space-y-2 text-sm">
				<div>
					<dt className="inline font-semibold text-white">Why: </dt>
					<dd className="inline text-gray-300" data-testid="today-next-action-why">{step.why}</dd>
				</div>
				<div>
					<dt className="inline font-semibold text-white">Done when: </dt>
					<dd className="inline text-gray-300" data-testid="today-next-action-done-when">{step.doneWhen}</dd>
				</div>
			</dl>
			{plan.guardianNote && (
				<p className="mt-3 text-xs text-amber-200" data-testid="today-guardian-note">{plan.guardianNote}</p>
			)}
			<div className="mt-4 flex flex-wrap items-center gap-3">
				<Button className="red-glow" onClick={() => onNavigate(step.path)} data-testid="today-next-action-cta">
					{step.ctaLabel}
				</Button>
				{onChangeFocus && (
					<button type="button" className="text-sm underline text-gray-300" onClick={onChangeFocus} data-testid="today-change-focus">
						Change focus
					</button>
				)}
			</div>
		</section>
	)
}
