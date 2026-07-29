import { useMemo, useState } from 'react'
import Card from './ui/Card'
import Button from './ui/Button'
import Select from './ui/Select'
import { Business, BusinessLevel, FitRating } from '../types'
import { FitBadge, LevelBadge } from './ui/Badge'
import { useRecruitingBoardSummary } from '../hooks/useRecruitingBoardSummary'

type Props = {
	businesses: Business[]
	onUpdate: (b: Business) => void
	onBuildOutreach: (b: Business) => void
}

const statusOptions: Business['status'][] = ['Not Contacted', 'Pending', 'In Discussion', 'Partnered']

export default function Dashboard({ businesses, onUpdate, onBuildOutreach }: Props) {
	const [filterLevel, setFilterLevel] = useState<BusinessLevel | 'ALL'>('ALL')
	const [filterFit, setFilterFit] = useState<FitRating | 'ALL'>('ALL')
	const { summary, loading: recruitingLoading, error: recruitingError, signedOut } =
		useRecruitingBoardSummary()

	const countsByStatus = useMemo(() => {
		const counts: Record<string, number> = {
			'Not Contacted': 0,
			'Pending': 0,
			'In Discussion': 0,
			'Partnered': 0,
		}
		for (const b of businesses) {
			const s = b.status || 'Not Contacted'
			if (s in counts) counts[s]++
		}
		return counts
	}, [businesses])

	const filtered = businesses.filter(b => {
		const levelOk = filterLevel === 'ALL' || b.level === filterLevel || b.analysis?.levelGuess === filterLevel
		const fit = b.match?.rating
		const fitOk = filterFit === 'ALL' || fit === filterFit
		return levelOk && fitOk
	})

	function renderRecruitingMetric(label: string, value: number | null) {
		return (
			<div className="bg-white border border-black/10 rounded-md p-3" data-testid={`recruiting-metric-${label}`}>
				<div className="text-black/70 text-xs">{label}</div>
				{recruitingLoading ? (
					<div className="text-black/40 text-2xl font-bold" aria-busy="true">
						—
					</div>
				) : recruitingError ? (
					<div className="text-black/50 text-sm mt-1">Unavailable</div>
				) : signedOut ? (
					<div className="text-black/50 text-sm mt-1">Sign in to view</div>
				) : (
					<div className="text-black text-2xl font-bold">{value ?? 0}</div>
				)}
			</div>
		)
	}

	return (
		<Card title="Business Portfolio Dashboard" actions={
			<div className="flex gap-2">
				<Select value={filterLevel} onChange={e => setFilterLevel(e.target.value as BusinessLevel | 'ALL')}>
					<option value="ALL">All Levels</option>
					<option value="LOCAL">LOCAL</option>
					<option value="REGIONAL">REGIONAL</option>
					<option value="NATIONAL">NATIONAL</option>
				</Select>
				<Select value={filterFit} onChange={e => setFilterFit(e.target.value as FitRating | 'ALL')}>
					<option value="ALL">All Fits</option>
					<option value="PERFECT FIT">PERFECT</option>
					<option value="GOOD FIT">GOOD</option>
					<option value="STRETCH FIT">STRETCH</option>
					<option value="POOR FIT">POOR</option>
				</Select>
			</div>
		}>
			<div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="recruiting-board-summary">
				{renderRecruitingMetric('Total Targets', summary?.total ?? null)}
				{renderRecruitingMetric('In Progress', summary?.byStatus['In Progress'] ?? null)}
			</div>
			<div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
				{statusOptions.map(s => (
					<div key={s} className="bg-white border border-black/10 rounded-md p-3">
						<div className="text-black/70 text-xs">{s}</div>
						<div className="text-black text-xl font-bold">{countsByStatus[s ?? 'Not Contacted'] ?? 0}</div>
					</div>
				))}
			</div>
			<div className="overflow-x-auto">
				<table className="table w-full text-sm">
					<thead>
						<tr>
							<th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-black/70">Business</th>
							<th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-black/70">Level</th>
							<th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-black/70">Fit</th>
							<th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-black/70">Status</th>
							<th className="px-3 py-2"></th>
						</tr>
					</thead>
					<tbody>
						{filtered.map(b => (
							<tr key={b.id} className="border-b border-black/10">
								<td className="px-3 py-3">
									<div className="text-black font-semibold">{b.name}</div>
									<div className="text-black/70">{b.location}</div>
								</td>
								<td className="px-3 py-3">
									<LevelBadge level={b.level || b.analysis?.levelGuess || 'LOCAL'} />
								</td>
								<td className="px-3 py-3">
									{b.match ? <FitBadge rating={b.match.rating} /> : <span className="subtle">—</span>}
								</td>
								<td className="px-3 py-3">
									<Select
										value={b.status || 'Not Contacted'}
										onChange={e => {
											onUpdate({ ...b, status: e.target.value as Business['status'] })
										}}
									>
										{statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
									</Select>
								</td>
								<td className="px-3 py-3">
									<div className="flex gap-2">
										<Button variant="ghost" onClick={() => onBuildOutreach(b)}>Outreach</Button>
										{b.website && (
											<a href={b.website} target="_blank" rel="noreferrer" className="btn btn-ghost">Website</a>
										)}
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</Card>
	)
}
