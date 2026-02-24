import { useEffect, useState } from 'react'
import Card from './ui/Card'
import Button from './ui/Button'
import Select from './ui/Select'
import { Business, BusinessLevel, FitRating } from '../types'
import { FitBadge, LevelBadge } from './ui/Badge'
import { getTargetsFor } from '../recruiting/pipeline'
import { load } from '../utils/storage'

type Props = {
	businesses: Business[]
	onUpdate: (b: Business) => void
	onBuildOutreach: (b: Business) => void
}

const statusOptions: Business['status'][] = ['Not Contacted', 'Pending', 'In Discussion', 'Partnered']

export default function Dashboard({ businesses, onUpdate, onBuildOutreach }: Props) {
	const [filterLevel, setFilterLevel] = useState<BusinessLevel | 'ALL'>('ALL')
	const [filterFit, setFilterFit] = useState<FitRating | 'ALL'>('ALL')
	const [recruitingCounts, setRecruitingCounts] = useState<{ pursue: number; inConversation: number }>({ pursue: 0, inConversation: 0 })

	useEffect(() => {
		const athlete = load<any>('athlete', null)
		const athleteId: string | null = athlete?.id || null
		const targets = getTargetsFor(athleteId || undefined)
		const pursue = targets.filter((t) => t.interestLevel === 'pursue').length
		const inConversation = targets.filter((t) => t.status === 'in_conversation').length
		setRecruitingCounts({ pursue, inConversation })
	}, [])

	const filtered = businesses.filter(b => {
		const levelOk = filterLevel === 'ALL' || b.level === filterLevel || b.analysis?.levelGuess === filterLevel
		const fit = b.match?.rating
		const fitOk = filterFit === 'ALL' || fit === filterFit
		return levelOk && fitOk
	})

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
			<div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
				<div className="bg-white border border-black/10 rounded-md p-3">
					<div className="text-black/70 text-xs">Programs marked "Pursue"</div>
					<div className="text-black text-2xl font-bold">{recruitingCounts.pursue}</div>
				</div>
				<div className="bg-white border border-black/10 rounded-md p-3">
					<div className="text-black/70 text-xs">In conversation</div>
					<div className="text-black text-2xl font-bold">{recruitingCounts.inConversation}</div>
				</div>
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


