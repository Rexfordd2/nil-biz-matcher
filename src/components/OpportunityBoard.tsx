import { useEffect, useMemo, useState } from 'react'
import Card from './ui/Card'
import Button from './ui/Button'
import { AthleteProfile, DealLogEntry, Opportunity, OpportunityCategory, OpportunityStatus } from '../types'
import { load, save } from '../utils/storage'

type Props = { athlete: AthleteProfile | null }
type Store = Record<string, Opportunity[]> // key: athleteId
type DealStore = Record<string, DealLogEntry[]>

const STATUSES: OpportunityStatus[] = ['idea', 'targeted', 'pitched', 'in_discussion', 'launched', 'archived']
const CATEGORIES: OpportunityCategory[] = [
	'local_brand_deal',
	'regional_brand_deal',
	'national_brand_deal',
	'camp_clinic',
	'appearance',
	'digital_product',
	'merch_drop',
	'charity_event',
	'other'
]

function createEmpty(athleteId: string): Opportunity {
	return {
		id: `opp-${Date.now()}`,
		athleteId,
		title: '',
		category: 'local_brand_deal',
		status: 'idea'
	}
}

export default function OpportunityBoard({ athlete }: Props) {
	const athleteId = athlete?.id || 'anonymous'
	const [store, setStore] = useState<Store>(() => load<Store>('opps.store', {}))
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [statusFilter, setStatusFilter] = useState<OpportunityStatus | 'all'>('all')
	const [activeTab, setActiveTab] = useState<'board' | 'details' | 'notes'>('board')

	useEffect(() => save('opps.store', store), [store])

	const dealsForAthlete = useMemo(() => {
		const ds = load<DealStore>('deals.store', {})
		return (ds[athleteId] || []).map(d => ({ id: d.id, label: d.title || d.brandName || d.id }))
	}, [athleteId])

	const list = useMemo(() => {
		const arr = store[athleteId] || []
		return arr
			.filter(o => (statusFilter === 'all' ? true : o.status === statusFilter))
			.sort((a, b) => (STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status)) || a.id.localeCompare(b.id))
	}, [store, athleteId, statusFilter])

	const selected = useMemo(() => (selectedId ? (store[athleteId] || []).find(o => o.id === selectedId) || null : null), [selectedId, store, athleteId])

	function upsert(next: Opportunity) {
		setStore(prev => {
			const arr = prev[athleteId] || []
			const idx = arr.findIndex(o => o.id === next.id)
			const updated = idx === -1 ? [next, ...arr] : arr.map(o => (o.id === next.id ? next : o))
			return { ...prev, [athleteId]: updated }
		})
	}
	function remove(id: string) {
		setStore(prev => ({ ...prev, [athleteId]: (prev[athleteId] || []).filter(o => o.id !== id) }))
		if (selectedId === id) setSelectedId(null)
	}
	function addNew() {
		if (!athlete) return
		const o = createEmpty(athlete.id)
		upsert(o)
		setSelectedId(o.id)
		setActiveTab('details')
	}

	return (
		<Card title="Opportunities">
			<div className="mb-4 flex items-center gap-2">
				<nav className="flex items-center gap-2">
					<button className={`px-3 py-1 rounded-md text-sm ${activeTab === 'board' ? 'bg-mid text-white' : 'bg-surface text-gray-300'}`} onClick={() => setActiveTab('board')}>Board</button>
					<button className={`px-3 py-1 rounded-md text-sm ${activeTab === 'details' ? 'bg-mid text-white' : 'bg-surface text-gray-300'}`} onClick={() => setActiveTab('details')}>Details</button>
					<button className={`px-3 py-1 rounded-md text-sm ${activeTab === 'notes' ? 'bg-mid text-white' : 'bg-surface text-gray-300'}`} onClick={() => setActiveTab('notes')}>Notes</button>
				</nav>
				{activeTab === 'board' && (
					<div className="ml-auto flex items-center gap-2">
						<select value={statusFilter} onChange={e => setStatusFilter((e.target.value as any) || 'all')} className="bg-mid border border-border rounded-md px-2 py-1 text-sm text-white">
							<option value="all">All status</option>
							{STATUSES.map(s => <option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}
						</select>
						<Button onClick={addNew}>New</Button>
					</div>
				)}
			</div>

			{activeTab === 'board' && (
				<div className="space-y-4">
					{statusFilter === 'all' ? (
						<div className="space-y-6">
							{STATUSES.map(s => {
								const rows = (store[athleteId] || []).filter(o => o.status === s)
								return (
									<div key={`grp-${s}`}>
										<div className="text-white font-semibold mb-2">{s.replaceAll('_',' ')}</div>
										<div className="overflow-x-auto">
											<table className="min-w-[720px] text-left text-sm">
												<thead>
													<tr className="text-gray-400">
														<th className="py-2 pr-2 w-[35%]">Title</th>
														<th className="py-2 pr-2 w-[20%]">Category</th>
														<th className="py-2 pr-2 w-[25%]">Target brand</th>
														<th className="py-2 pr-2 w-[15%]">Status</th>
														<th className="w-[5%]" />
													</tr>
												</thead>
												<tbody>
													{rows.map(o => (
														<tr key={o.id} className={`border-t border-border ${selectedId === o.id ? 'bg-mid/50' : ''}`}>
															<td className="py-2 pr-2 text-white whitespace-nowrap"><button className="underline" onClick={() => { setSelectedId(o.id); setActiveTab('details') }}>{o.title || '(untitled)'}</button></td>
															<td className="py-2 pr-2 text-gray-300 whitespace-nowrap">{o.category.replaceAll('_',' ')}</td>
															<td className="py-2 pr-2 text-gray-200">{o.targetBrandName || '—'}</td>
															<td className="py-2 pr-2">
																<select value={o.status} onChange={e => upsert({ ...o, status: e.target.value as OpportunityStatus })} className="bg-background border border-border rounded-md px-2 py-1 text-xs text-white">
																	{STATUSES.map(s2 => <option key={s2} value={s2}>{s2.replaceAll('_',' ')}</option>)}
																</select>
															</td>
															<td className="py-2 pr-2 text-right">
																<Button variant="ghost" className="text-xs px-2 py-1" onClick={() => remove(o.id)}>Remove</Button>
															</td>
														</tr>
													))}
													{rows.length === 0 && (
														<tr>
															<td colSpan={5} className="py-2 text-gray-500 italic">No items</td>
														</tr>
													)}
												</tbody>
											</table>
										</div>
									</div>
								)
							})}
						</div>
					) : (
						<div className="overflow-x-auto">
							<table className="min-w-[720px] text-left text-sm">
								<thead>
									<tr className="text-gray-400">
										<th className="py-2 pr-2 w-[35%]">Title</th>
										<th className="py-2 pr-2 w-[20%]">Category</th>
										<th className="py-2 pr-2 w-[25%]">Target brand</th>
										<th className="py-2 pr-2 w-[15%]">Status</th>
										<th className="w-[5%]" />
									</tr>
								</thead>
								<tbody>
									{list.map(o => (
										<tr key={o.id} className={`border-t border-border ${selectedId === o.id ? 'bg-mid/50' : ''}`}>
											<td className="py-2 pr-2 text-white whitespace-nowrap"><button className="underline" onClick={() => { setSelectedId(o.id); setActiveTab('details') }}>{o.title || '(untitled)'}</button></td>
											<td className="py-2 pr-2 text-gray-300 whitespace-nowrap">{o.category.replaceAll('_',' ')}</td>
											<td className="py-2 pr-2 text-gray-200">{o.targetBrandName || '—'}</td>
											<td className="py-2 pr-2">
												<select value={o.status} onChange={e => upsert({ ...o, status: e.target.value as OpportunityStatus })} className="bg-background border border-border rounded-md px-2 py-1 text-xs text-white">
													{STATUSES.map(s => <option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}
												</select>
											</td>
											<td className="py-2 pr-2 text-right">
												<Button variant="ghost" className="text-xs px-2 py-1" onClick={() => remove(o.id)}>Remove</Button>
											</td>
										</tr>
									))}
									{list.length === 0 && (
										<tr>
											<td colSpan={5} className="py-6 text-center text-gray-400">No opportunities yet — click “New” to add one.</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
					)}
				</div>
			)}

			{activeTab === 'details' && (
				<div>
					{!selected ? (
						<div className="subtle">Select an opportunity to edit.</div>
					) : (
						<OpportunityEditor
							value={selected}
							onChange={upsert}
							deals={dealsForAthlete}
						/>
					)}
				</div>
			)}

			{activeTab === 'notes' && (
				<div>
					{!selected ? (
						<div className="subtle">Notes for the selected opportunity will appear here.</div>
					) : (
						<textarea
							value={selected.notes || ''}
							onChange={e => upsert({ ...selected, notes: e.target.value })}
							className="w-full bg-mid border border-border rounded-md px-3 py-2 text-white min-h-[200px]"
							placeholder="Freeform notes (meeting summaries, next steps)…"
						/>
					)}
				</div>
			)}
		</Card>
	)
}

function OpportunityEditor({ value, onChange, deals }: { value: Opportunity; onChange: (o: Opportunity) => void; deals: {id: string; label: string}[] }) {
	return (
		<div className="space-y-3">
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				<input value={value.title} onChange={e => onChange({ ...value, title: e.target.value })} className="bg-mid border border-border rounded-md px-3 py-2 text-white" placeholder="Title" />
				<select value={value.category} onChange={e => onChange({ ...value, category: e.target.value as OpportunityCategory })} className="bg-mid border border-border rounded-md px-3 py-2 text-white">
					{CATEGORIES.map(c => <option key={c} value={c}>{c.replaceAll('_',' ')}</option>)}
				</select>
				<input value={value.targetBrandName || ''} onChange={e => onChange({ ...value, targetBrandName: e.target.value })} className="bg-mid border border-border rounded-md px-3 py-2 text-white" placeholder="Target brand (optional)" />
				<select value={value.status} onChange={e => onChange({ ...value, status: e.target.value as OpportunityStatus })} className="bg-mid border border-border rounded-md px-3 py-2 text-white">
					{STATUSES.map(s => <option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}
				</select>
				<input type="date" value={value.expectedStartDate || ''} onChange={e => onChange({ ...value, expectedStartDate: e.target.value })} className="bg-mid border border-border rounded-md px-3 py-2 text-white" />
				<input type="date" value={value.expectedEndDate || ''} onChange={e => onChange({ ...value, expectedEndDate: e.target.value })} className="bg-mid border border-border rounded-md px-3 py-2 text-white" />
			</div>
			<textarea
				value={value.description || ''}
				onChange={e => onChange({ ...value, description: e.target.value })}
				className="w-full bg-mid border border-border rounded-md px-3 py-2 text-white min-h-[120px]"
				placeholder="Description / pitch summary"
			/>
			<select value={value.linkedDealId || ''} onChange={e => onChange({ ...value, linkedDealId: (e.target.value || undefined) })} className="bg-mid border border-border rounded-md px-3 py-2 text-white">
				<option value="">Link to a Deal (optional)</option>
				{deals.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
			</select>
		</div>
	)
}



