import { useState } from 'react'
import Card from './ui/Card'
import Button from './ui/Button'
import { Business, BusinessLevel, FitRating } from '../types'
import { FitBadge, LevelBadge } from './ui/Badge'
import { useToast } from './ui/Toast'

type Props = {
	businesses: Business[]
	onUpdate: (b: Business) => void
	onBuildOutreach: (b: Business) => void
}

const statusOptions: Business['status'][] = ['Not Contacted', 'Pending', 'In Discussion', 'Partnered']

export default function Dashboard({ businesses, onUpdate, onBuildOutreach }: Props) {
	const { show } = useToast()
	const [filterLevel, setFilterLevel] = useState<BusinessLevel | 'ALL'>('ALL')
	const [filterFit, setFilterFit] = useState<FitRating | 'ALL'>('ALL')

	const filtered = businesses.filter(b => {
		const levelOk = filterLevel === 'ALL' || b.level === filterLevel || b.analysis?.levelGuess === filterLevel
		const fit = b.match?.rating
		const fitOk = filterFit === 'ALL' || fit === filterFit
		return levelOk && fitOk
	})

	return (
		<Card title="Business Portfolio Dashboard" actions={
			<div className="flex gap-2">
				<select value={filterLevel} onChange={e => setFilterLevel(e.target.value as BusinessLevel | 'ALL')} className="bg-mid border border-border rounded-md px-3 py-2 text-white">
					<option value="ALL">All Levels</option>
					<option value="LOCAL">LOCAL</option>
					<option value="REGIONAL">REGIONAL</option>
					<option value="NATIONAL">NATIONAL</option>
				</select>
				<select value={filterFit} onChange={e => setFilterFit(e.target.value as FitRating | 'ALL')} className="bg-mid border border-border rounded-md px-3 py-2 text-white">
					<option value="ALL">All Fits</option>
					<option value="PERFECT FIT">PERFECT</option>
					<option value="GOOD FIT">GOOD</option>
					<option value="STRETCH FIT">STRETCH</option>
					<option value="POOR FIT">POOR</option>
				</select>
			</div>
		}>
			<div className="overflow-x-auto">
				<table className="w-full text-left text-sm">
					<thead className="text-gray-400">
						<tr>
							<th className="py-2">Business</th>
							<th className="py-2">Level</th>
							<th className="py-2">Fit</th>
							<th className="py-2">Status</th>
							<th className="py-2"></th>
						</tr>
					</thead>
					<tbody>
						{filtered.map(b => (
							<tr key={b.id} className="border-t border-border">
								<td className="py-3">
									<div className="text-white font-semibold">{b.name}</div>
									<div className="text-gray-400">{b.location}</div>
								</td>
								<td className="py-3">
									<LevelBadge level={b.level || b.analysis?.levelGuess || 'LOCAL'} />
								</td>
								<td className="py-3">
									{b.match ? <FitBadge rating={b.match.rating} /> : <span className="subtle">—</span>}
								</td>
								<td className="py-3">
									<select
										value={b.status || 'Not Contacted'}
										onChange={e => {
											onUpdate({ ...b, status: e.target.value as Business['status'] })
											show('Status updated')
										}}
										className="bg-mid border border-border rounded-md px-2 py-1 text-white"
									>
										{statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
									</select>
								</td>
								<td className="py-3">
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


