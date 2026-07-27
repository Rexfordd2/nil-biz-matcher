import { useMemo, useState } from 'react'
import Card from './ui/Card'
import Button from './ui/Button'
import Select from './ui/Select'
import { AthleteProfile, Business, DealLogEntry, Opportunity, OpportunityCategory, OpportunityStatus } from '../types'
import { load } from '../utils/storage'
import { useWorkflowDomainPersistence } from '../hooks/useWorkflowDomainPersistence'
import { opportunityWorkflowAdapters } from '../hooks/workflowDomainAdapters'
import {
	toActiveAthleteId,
	toLocalAthleteStorageKey,
} from '../persistence/workflows/athleteIdentity'
import WorkflowImportGate from './workflows/WorkflowImportGate'

const businessStatusOptions: Business['status'][] = ['Not Contacted', 'Pending', 'In Discussion', 'Partnered']

type Props = {
	athlete: AthleteProfile | null
	businesses?: Business[]
	onUpdateBusiness?: (b: Business) => void
}
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

export default function OpportunityBoard({ athlete, businesses = [], onUpdateBusiness }: Props) {
	const activeAthleteId = toActiveAthleteId(athlete?.id)
	const localAthleteKey = toLocalAthleteStorageKey(activeAthleteId)
	const {
		mode,
		store,
		importPlan,
		busy,
		error,
		mutationsDisabled,
		upsert,
		remove,
		confirmImport,
		keepUsingDevice,
		retryBootstrap,
	} = useWorkflowDomainPersistence(activeAthleteId, opportunityWorkflowAdapters)
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [statusFilter, setStatusFilter] = useState<OpportunityStatus | 'all'>('all')
	const [activeTab, setActiveTab] = useState<'board' | 'details' | 'notes'>('board')

	const dealsForAthlete = useMemo(() => {
		const ds = load<DealStore>('deals.store', {})
		return (ds[localAthleteKey] || []).map(d => ({ id: d.id, label: d.title || d.brandName || d.id }))
	}, [localAthleteKey, store])

	const list = useMemo(() => {
		const arr = store[localAthleteKey] || []
		return arr
			.filter(o => (statusFilter === 'all' ? true : o.status === statusFilter))
			.sort((a, b) => (STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status)) || a.id.localeCompare(b.id))
	}, [store, localAthleteKey, statusFilter])

	const selected = useMemo(() => (selectedId ? (store[localAthleteKey] || []).find(o => o.id === selectedId) || null : null), [selectedId, store, localAthleteKey])

	function upsertLocal(next: Opportunity) {
		void upsert(next)
	}
	function removeLocal(id: string) {
		void remove(id)
		if (selectedId === id) setSelectedId(null)
	}
	function addNew() {
		if (!athlete) return
		const o = createEmpty(athlete.id)
		void upsert(o)
		setSelectedId(o.id)
		setActiveTab('details')
	}

	return (
		<Card title="Opportunities">
			<WorkflowImportGate
				domainLabel="Opportunities"
				mode={mode}
				plan={importPlan}
				busy={busy}
				error={error}
				onConfirmImport={() => void confirmImport()}
				onKeepUsingDevice={keepUsingDevice}
				onRetry={retryBootstrap}
			/>
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
						<Button onClick={addNew} disabled={mutationsDisabled}>New</Button>
					</div>
				)}
			</div>

			{businesses.length > 0 && onUpdateBusiness && (
				<div className="mb-4 rounded-md border border-border bg-mid/40 p-3">
					<div className="text-white font-semibold text-sm mb-2">Your businesses</div>
					<div className="overflow-x-auto">
						<table className="w-full text-sm text-left">
							<thead>
								<tr className="text-gray-400">
									<th className="py-1 pr-2">Name</th>
									<th className="py-1 pr-2">Location</th>
									<th className="py-1 pr-2">Status</th>
								</tr>
							</thead>
							<tbody>
								{businesses.slice(0, 10).map(b => (
									<tr key={b.id} className="border-t border-border">
										<td className="py-1 pr-2 text-white truncate max-w-[200px]">{b.name}</td>
										<td className="py-1 pr-2 text-gray-400 truncate max-w-[180px]">{b.location || '—'}</td>
										<td className="py-1 pr-2">
											<Select
												value={b.status || 'Not Contacted'}
												onChange={e => onUpdateBusiness({ ...b, status: e.target.value as Business['status'] })}
												className="bg-background border border-border rounded px-2 py-0.5 text-xs text-white min-w-[140px]"
											>
												{businessStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
											</Select>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					{businesses.length > 10 && <div className="text-gray-400 text-xs mt-1">Showing 10 of {businesses.length}</div>}
				</div>
			)}

			{activeTab === 'board' && (
				<div className="space-y-4">
					{statusFilter === 'all' ? (
						<div className="space-y-6">
							{STATUSES.map(s => {
								const rows = (store[localAthleteKey] || []).filter(o => o.status === s)
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
																<select value={o.status} onChange={e => upsertLocal({ ...o, status: e.target.value as OpportunityStatus })} disabled={mutationsDisabled} className="bg-background border border-border rounded-md px-2 py-1 text-xs text-white">
																	{STATUSES.map(s2 => <option key={s2} value={s2}>{s2.replaceAll('_',' ')}</option>)}
																</select>
															</td>
															<td className="py-2 pr-2 text-right">
																<Button variant="ghost" className="text-xs px-2 py-1" onClick={() => removeLocal(o.id)} disabled={mutationsDisabled}>Remove</Button>
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
												<select value={o.status} onChange={e => upsertLocal({ ...o, status: e.target.value as OpportunityStatus })} disabled={mutationsDisabled} className="bg-background border border-border rounded-md px-2 py-1 text-xs text-white">
													{STATUSES.map(s => <option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}
												</select>
											</td>
											<td className="py-2 pr-2 text-right">
												<Button variant="ghost" className="text-xs px-2 py-1" onClick={() => removeLocal(o.id)} disabled={mutationsDisabled}>Remove</Button>
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
							onChange={upsertLocal}
							deals={dealsForAthlete}
							disabled={mutationsDisabled}
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
							onChange={e => upsertLocal({ ...selected, notes: e.target.value })}
							disabled={mutationsDisabled}
							className="w-full bg-mid border border-border rounded-md px-3 py-2 text-white min-h-[200px]"
							placeholder="Freeform notes (meeting summaries, next steps)…"
						/>
					)}
				</div>
			)}
		</Card>
	)
}

function OpportunityEditor({ value, onChange, deals, disabled }: { value: Opportunity; onChange: (o: Opportunity) => void; deals: {id: string; label: string}[]; disabled?: boolean }) {
	return (
		<div className="space-y-3">
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				<input value={value.title} onChange={e => onChange({ ...value, title: e.target.value })} disabled={disabled} className="bg-mid border border-border rounded-md px-3 py-2 text-white" placeholder="Title" />
				<select value={value.category} onChange={e => onChange({ ...value, category: e.target.value as OpportunityCategory })} disabled={disabled} className="bg-mid border border-border rounded-md px-3 py-2 text-white">
					{CATEGORIES.map(c => <option key={c} value={c}>{c.replaceAll('_',' ')}</option>)}
				</select>
				<input value={value.targetBrandName || ''} onChange={e => onChange({ ...value, targetBrandName: e.target.value })} disabled={disabled} className="bg-mid border border-border rounded-md px-3 py-2 text-white" placeholder="Target brand (optional)" />
				<select value={value.status} onChange={e => onChange({ ...value, status: e.target.value as OpportunityStatus })} disabled={disabled} className="bg-mid border border-border rounded-md px-3 py-2 text-white">
					{STATUSES.map(s => <option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}
				</select>
				<input type="date" value={value.expectedStartDate || ''} onChange={e => onChange({ ...value, expectedStartDate: e.target.value })} disabled={disabled} className="bg-mid border border-border rounded-md px-3 py-2 text-white" />
				<input type="date" value={value.expectedEndDate || ''} onChange={e => onChange({ ...value, expectedEndDate: e.target.value })} disabled={disabled} className="bg-mid border border-border rounded-md px-3 py-2 text-white" />
			</div>
			<textarea
				value={value.description || ''}
				onChange={e => onChange({ ...value, description: e.target.value })}
				disabled={disabled}
				className="w-full bg-mid border border-border rounded-md px-3 py-2 text-white min-h-[120px]"
				placeholder="Description / pitch summary"
			/>
			<select value={value.linkedDealId || ''} onChange={e => onChange({ ...value, linkedDealId: (e.target.value || undefined) })} disabled={disabled} className="bg-mid border border-border rounded-md px-3 py-2 text-white">
				<option value="">Link to a Deal (optional)</option>
				{deals.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
			</select>
		</div>
	)
}
