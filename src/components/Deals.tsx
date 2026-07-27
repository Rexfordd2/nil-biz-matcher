import { useEffect, useMemo, useState } from 'react'
import Card from './ui/Card'
import Button from './ui/Button'
import { AthleteProfile, Business, DealLogEntry, DealStatus, DealType, PaymentRecord } from '../types'
import { useWorkflowDomainPersistence } from '../hooks/useWorkflowDomainPersistence'
import { dealWorkflowAdapters } from '../hooks/workflowDomainAdapters'
import {
	toActiveAthleteId,
	toLocalAthleteStorageKey,
} from '../persistence/workflows/athleteIdentity'
import WorkflowImportGate from './workflows/WorkflowImportGate'

const businessStatusOptions: Business['status'][] = ['Not Contacted', 'Pending', 'In Discussion', 'Partnered']

type Props = {
	athlete: AthleteProfile | null
	businesses: Business[]
	onUpdateBusiness?: (b: Business) => void
}

const STATUSES: DealStatus[] = ['idea','pitched','in_discussion','agreed','completed','dropped']
const TYPES: DealType[] = ['brand_sponsorship','appearance','camp_clinic','digital_product','merch_ecommerce','charity_event','other']

function createEmptyDeal(athleteId: string): DealLogEntry {
	return {
		id: `deal-${Date.now()}`,
		athleteId,
		title: '',
		dealType: 'brand_sponsorship',
		brandName: '',
		status: 'idea',
		deliverables: [],
		payments: [],
		documents: []
	}
}

function computeRiskFlags(deal: DealLogEntry): string[] {
	const flags: string[] = []
	const deliverableCount = (deal.deliverables || []).length
	const value = deal.valueEstimate ?? 0
	if (deliverableCount >= 5 && value > 0) {
		const valuePerDeliverable = value / deliverableCount
		if (valuePerDeliverable < 50) {
			flags.push('Time-heavy; consider opportunity cost.')
		}
	}
	if (deal.licensing?.usesSchoolMarks && !deal.licensing?.notes) {
		flags.push('Check licensing requirements.')
	}
	if (deal.exclusivityNotes && deal.exclusivityNotes.trim().length > 0) {
		flags.push('Check for conflicts with school/team sponsors.')
	}
	return flags
}

export default function Deals({ athlete, businesses, onUpdateBusiness }: Props) {
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
	} = useWorkflowDomainPersistence(activeAthleteId, dealWorkflowAdapters)
	const [filterStatus, setFilterStatus] = useState<DealStatus | 'all'>('all')
	const [filterType, setFilterType] = useState<DealType | 'all'>('all')
	const [selectedId, setSelectedId] = useState<string | null>(null)

	const dealsForAthlete = useMemo(() => {
		const list = store[localAthleteKey] || []
		return list
			.filter(d => (filterStatus === 'all' ? true : d.status === filterStatus))
			.filter(d => (filterType === 'all' ? true : d.dealType === filterType))
			.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || '') || b.id.localeCompare(a.id))
	}, [store, localAthleteKey, filterStatus, filterType])

	const selectedDeal = useMemo(() => {
		if (!selectedId) return null
		return (store[localAthleteKey] || []).find(d => d.id === selectedId) || null
	}, [store, localAthleteKey, selectedId])

	function upsertDeal(next: DealLogEntry) {
		void upsert(next)
	}

	function removeDeal(id: string) {
		void remove(id)
		if (selectedId === id) setSelectedId(null)
	}

	function addNewDeal() {
		if (!athlete) return
		const d = createEmptyDeal(athlete.id)
		void upsert(d)
		setSelectedId(d.id)
	}

	function addDeliverable(d: DealLogEntry) {
		upsertDeal({ ...d, deliverables: [...(d.deliverables || []), ''] })
	}
	function updateDeliverable(d: DealLogEntry, idx: number, value: string) {
		const list = [...(d.deliverables || [])]
		list[idx] = value
		upsertDeal({ ...d, deliverables: list })
	}
	function removeDeliverable(d: DealLogEntry, idx: number) {
		const list = (d.deliverables || []).filter((_, i) => i !== idx)
		upsertDeal({ ...d, deliverables: list })
	}

	function addPayment(d: DealLogEntry) {
		const p: PaymentRecord = { date: new Date().toISOString().slice(0, 10), amount: 0, currency: 'USD' }
		upsertDeal({ ...d, payments: [...(d.payments || []), p] })
	}
	function updatePayment(d: DealLogEntry, idx: number, next: Partial<PaymentRecord>) {
		const list = (d.payments || []).map((p, i) => (i === idx ? { ...p, ...next } : p))
		upsertDeal({ ...d, payments: list })
	}
	function removePayment(d: DealLogEntry, idx: number) {
		const list = (d.payments || []).filter((_, i) => i !== idx)
		upsertDeal({ ...d, payments: list })
	}

	function addDocument(d: DealLogEntry, url: string) {
		const doc = url.trim()
		if (!doc) return
		upsertDeal({ ...d, documents: [...(d.documents || []), doc] })
	}
	function removeDocument(d: DealLogEntry, idx: number) {
		upsertDeal({ ...d, documents: (d.documents || []).filter((_, i) => i !== idx) })
	}

	return (
		<div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
			<div className="lg:col-span-3">
				<WorkflowImportGate
					domainLabel="Deals"
					mode={mode}
					plan={importPlan}
					busy={busy}
					error={error}
					onConfirmImport={() => void confirmImport()}
					onKeepUsingDevice={keepUsingDevice}
					onRetry={retryBootstrap}
				/>
			</div>
			<Card title="NIL Deals">
				<div className="space-y-3">
					<div className="flex items-center gap-2">
						<select value={filterStatus} onChange={e => setFilterStatus((e.target.value as any) || 'all')} className="ui-input max-w-xs">
							<option value="all">All status</option>
							{STATUSES.map(s => <option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}
						</select>
						<select value={filterType} onChange={e => setFilterType((e.target.value as any) || 'all')} className="ui-input max-w-xs">
							<option value="all">All types</option>
							{TYPES.map(t => <option key={t} value={t}>{t.replaceAll('_',' ')}</option>)}
						</select>
						<div className="flex-1" />
						<Button onClick={addNewDeal} disabled={mutationsDisabled}>Add Deal</Button>
					</div>

					<div className="overflow-x-auto">
						<table className="min-w-full text-sm">
							<thead>
								<tr>
									<th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-black/70">Title</th>
									<th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-black/70">Brand</th>
									<th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-black/70">Type</th>
									<th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-black/70">Status</th>
									<th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-black/70">Value</th>
									<th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-black/70">Flags</th>
									<th />
								</tr>
							</thead>
							<tbody>
								{dealsForAthlete.map(d => {
									const flags = computeRiskFlags(d)
									return (
										<tr key={d.id} className={`border-b border-black/10 ${selectedId === d.id ? 'bg-slate-50' : ''}`}>
											<td className="px-3 py-2 text-black">
												<button className="underline" onClick={() => setSelectedId(d.id)}>{d.title || '(untitled deal)'}</button>
											</td>
											<td className="px-3 py-2 text-black">{d.brandName || '—'}</td>
											<td className="px-3 py-2 text-black/80">{d.dealType.replaceAll('_',' ')}</td>
											<td className="px-3 py-2">
												<select value={d.status} onChange={e => upsertDeal({ ...d, status: e.target.value as DealStatus })} disabled={mutationsDisabled} className="ui-input text-xs max-w-[160px]">
													{STATUSES.map(s => <option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}
												</select>
											</td>
											<td className="px-3 py-2 text-black">{d.valueEstimate ? `${d.currency || 'USD'} ${d.valueEstimate}` : '—'}</td>
											<td className="px-3 py-2">
												<div className="flex flex-wrap gap-1">
													{d.licensing?.usesSchoolMarks && <span className="inline-block text-xs bg-black/5 border border-black/10 rounded px-2 py-0.5 text-black">Licensing</span>}
													{d.reportedToSchool && <span className="inline-block text-xs bg-black/5 border border-black/10 rounded px-2 py-0.5 text-black">Reported</span>}
													{flags.length > 0 && <span className="inline-block text-xs bg-black/5 border border-black/10 rounded px-2 py-0.5 text-black">Risk</span>}
												</div>
											</td>
											<td className="px-3 py-2 text-right">
												<Button variant="ghost" onClick={() => removeDeal(d.id)} disabled={mutationsDisabled}>Remove</Button>
											</td>
										</tr>
									)
								})}
								{dealsForAthlete.length === 0 && (
									<tr>
										<td colSpan={7} className="px-3 py-6 text-center text-black/70">No deals yet — click “Add Deal” to start your log.</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</div>
			</Card>

			<Card title="Deal Detail">
				{!selectedDeal ? (
					<div className="text-gray-400">Select a deal from the list to view/edit details.</div>
				) : (
					<DealEditor
						deal={selectedDeal}
						onChange={upsertDeal}
						businesses={businesses}
						onUpdateBusiness={onUpdateBusiness}
						disabled={mutationsDisabled}
					/>
				)}
			</Card>

			<Card title="Compliance & Notes">
				{!selectedDeal ? (
					<div className="text-gray-400">Risk flags and compliance will appear here.</div>
				) : (
					<DealCompliance deal={selectedDeal} onChange={upsertDeal} disabled={mutationsDisabled} />
				)}
			</Card>
		</div>
	)
}

function DealEditor({ deal, onChange, businesses, onUpdateBusiness, disabled }: { deal: DealLogEntry; onChange: (d: DealLogEntry) => void; businesses: Business[]; onUpdateBusiness?: (b: Business) => void; disabled?: boolean }) {
	const [docUrl, setDocUrl] = useState('')
	const bizOptions = useMemo(() => businesses.map(b => ({ id: b.id, label: b.name })), [businesses])
	const linkedBusiness = useMemo(() => deal.businessId ? businesses.find(b => b.id === deal.businessId) ?? null : null, [deal.businessId, businesses])
	const flags = computeRiskFlags(deal)

	// Local helpers for nested editor actions to avoid referencing outer scope
	function addDeliverable(d: DealLogEntry) {
		onChange({ ...d, deliverables: [ ...(d.deliverables || []), '' ] })
	}
	function updateDeliverable(d: DealLogEntry, idx: number, value: string) {
		const list = [ ...(d.deliverables || []) ]
		list[idx] = value
		onChange({ ...d, deliverables: list })
	}
	function removeDeliverable(d: DealLogEntry, idx: number) {
		onChange({ ...d, deliverables: (d.deliverables || []).filter((_, i) => i !== idx) })
	}

	function addPayment(d: DealLogEntry) {
		const p: PaymentRecord = { date: new Date().toISOString().slice(0, 10), amount: 0, currency: 'USD' }
		onChange({ ...d, payments: [ ...(d.payments || []), p ] })
	}
	function updatePayment(d: DealLogEntry, idx: number, next: Partial<PaymentRecord>) {
		onChange({ ...d, payments: (d.payments || []).map((p, i) => (i === idx ? { ...p, ...next } : p)) })
	}
	function removePayment(d: DealLogEntry, idx: number) {
		onChange({ ...d, payments: (d.payments || []).filter((_, i) => i !== idx) })
	}

	function removeDocument(d: DealLogEntry, idx: number) {
		onChange({ ...d, documents: (d.documents || []).filter((_, i) => i !== idx) })
	}

	return (
		<div className="space-y-3">
			{flags.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{flags.map((f, i) => (
						<span key={`rf-${i}`} className="inline-block text-xs bg-mid border border-border rounded px-2 py-0.5 text-red-300">{f}</span>
					))}
				</div>
			)}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				<input value={deal.title} onChange={e => onChange({ ...deal, title: e.target.value })} disabled={disabled} className="ui-input" placeholder="Deal title" />
				<input value={deal.brandName} onChange={e => onChange({ ...deal, brandName: e.target.value })} disabled={disabled} className="ui-input" placeholder="Brand name" />
				<select value={deal.dealType} onChange={e => onChange({ ...deal, dealType: e.target.value as DealType })} disabled={disabled} className="ui-input">
					{TYPES.map(t => <option key={t} value={t}>{t.replaceAll('_',' ')}</option>)}
				</select>
				<select value={deal.status} onChange={e => onChange({ ...deal, status: e.target.value as DealStatus })} disabled={disabled} className="ui-input">
					{STATUSES.map(s => <option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}
				</select>
				<div className="grid grid-cols-2 gap-2">
					<input type="number" min={0} value={deal.valueEstimate ?? ''} onChange={e => onChange({ ...deal, valueEstimate: e.target.value === '' ? undefined : Number(e.target.value) })} className="ui-input" placeholder="Value estimate" />
					<input value={deal.currency || 'USD'} onChange={e => onChange({ ...deal, currency: e.target.value })} className="ui-input" placeholder="Currency (e.g., USD)" />
				</div>
				<div className="grid grid-cols-2 gap-2">
					<input type="date" value={deal.startDate || ''} onChange={e => onChange({ ...deal, startDate: e.target.value })} className="ui-input" />
					<input type="date" value={deal.endDate || ''} onChange={e => onChange({ ...deal, endDate: e.target.value })} className="ui-input" />
				</div>
				<select value={deal.businessId || ''} onChange={e => onChange({ ...deal, businessId: e.target.value || undefined })} className="ui-input">
					<option value="">Link business (optional)</option>
					{bizOptions.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
				</select>
				{linkedBusiness && onUpdateBusiness && (
					<div className="flex items-center gap-2">
						<span className="text-black/70 text-sm">Business status:</span>
						<select
							value={linkedBusiness.status || 'Not Contacted'}
							onChange={e => onUpdateBusiness({ ...linkedBusiness, status: e.target.value as Business['status'] })}
							className="ui-input flex-1 max-w-[200px]"
						>
							{businessStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
						</select>
					</div>
				)}
				<input value={deal.exclusivityNotes || ''} onChange={e => onChange({ ...deal, exclusivityNotes: e.target.value })} className="ui-input" placeholder="Exclusivity notes (if any)" />
			</div>

			<div>
				<div className="flex items-center justify-between mb-2">
					<div className="text-black/70 text-sm">Deliverables</div>
					<Button variant="ghost" onClick={() => addDeliverable(deal)}>Add</Button>
				</div>
				<div className="space-y-2">
					{(deal.deliverables || []).map((item, idx) => (
						<div key={`del-${idx}`} className="grid grid-cols-12 gap-2">
							<input value={item} onChange={e => updateDeliverable(deal, idx, e.target.value)} className="col-span-10 ui-input" placeholder="Deliverable description" />
							<div className="col-span-2 flex justify-end">
								<Button variant="ghost" onClick={() => removeDeliverable(deal, idx)}>Remove</Button>
							</div>
						</div>
					))}
					{(deal.deliverables || []).length === 0 && <div className="text-black/70 text-sm">Add what you’ll do (posts, appearances, etc.)</div>}
				</div>
			</div>

			<div>
				<div className="flex items-center justify-between mb-2">
					<div className="text-black/70 text-sm">Payments</div>
					<Button variant="ghost" onClick={() => addPayment(deal)}>Add Payment</Button>
				</div>
				<div className="space-y-2">
					{(deal.payments || []).map((p, idx) => (
						<div key={`pay-${idx}`} className="grid grid-cols-12 gap-2">
							<input type="date" value={p.date} onChange={e => updatePayment(deal, idx, { date: e.target.value })} className="col-span-3 ui-input" />
							<input type="number" min={0} value={p.amount} onChange={e => updatePayment(deal, idx, { amount: Number(e.target.value) })} className="col-span-2 ui-input" placeholder="Amount" />
							<input value={p.currency} onChange={e => updatePayment(deal, idx, { currency: e.target.value })} className="col-span-2 ui-input" placeholder="Currency" />
							<select value={p.method || ''} onChange={e => updatePayment(deal, idx, { method: (e.target.value || undefined) as any })} className="col-span-3 ui-input">
								<option value="">Method</option>
								<option value="cash">Cash</option>
								<option value="check">Check</option>
								<option value="bank_transfer">Bank transfer</option>
								<option value="platform">Platform</option>
								<option value="other">Other</option>
							</select>
							<Button variant="ghost" onClick={() => removePayment(deal, idx)}>Remove</Button>
						</div>
					))}
					{(deal.payments || []).length === 0 && <div className="text-black/70 text-sm">Record payments as you receive them.</div>}
				</div>
			</div>

			<div>
				<div className="flex items-center justify-between mb-2">
					<div className="text-black/70 text-sm">Documents (links to contracts/releases)</div>
					<div className="flex gap-2">
						<input value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="https://…" className="ui-input" />
						<Button variant="ghost" onClick={() => { if (docUrl.trim()) { onChange({ ...deal, documents: [ ...(deal.documents || []), docUrl.trim() ] }); setDocUrl('') } }}>Add</Button>
					</div>
				</div>
				<ul className="list-disc pl-6 space-y-1 text-black text-sm">
					{(deal.documents || []).map((u, idx) => (
						<li key={`doc-${idx}`}>
							<a href={u} className="underline" target="_blank" rel="noreferrer">{u}</a>
							<Button variant="ghost" onClick={() => removeDocument(deal, idx)}>Remove</Button>
						</li>
					))}
				</ul>
			</div>
		</div>
	)
}

function DealCompliance({ deal, onChange, disabled }: { deal: DealLogEntry; onChange: (d: DealLogEntry) => void; disabled?: boolean }) {
	const licensing = deal.licensing || { usesSchoolMarks: false, notes: '' }
	const [notes, setNotes] = useState(deal.complianceNotes || '')
	useEffect(() => {
		if (disabled) return
		onChange({ ...deal, complianceNotes: notes })
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [notes])
	return (
		<div className="space-y-4">
			<div className="bg-white border border-black/10 rounded-md p-3">
				<div className="text-black font-semibold mb-2">Licensing</div>
				<label className="inline-flex items-center gap-2 text-sm text-black/70">
					<input type="checkbox" checked={!!licensing.usesSchoolMarks} disabled={disabled} onChange={e => onChange({ ...deal, licensing: { ...licensing, usesSchoolMarks: e.target.checked } })} />
					<span>Uses school marks (logos, uniforms, facilities)?</span>
				</label>
				<textarea
					value={licensing.notes || ''}
					onChange={e => onChange({ ...deal, licensing: { ...licensing, notes: e.target.value } })}
					disabled={disabled}
					className="w-full ui-input mt-2"
					placeholder="Notes about permissions or usage"
				/>
			</div>
			<div className="bg-white border border-black/10 rounded-md p-3">
				<div className="text-black font-semibold mb-2">Reporting</div>
				<label className="inline-flex items-center gap-2 text-sm text-black/70">
					<input type="checkbox" checked={!!deal.reportedToSchool} disabled={disabled} onChange={e => onChange({ ...deal, reportedToSchool: e.target.checked })} />
					<span>Reported to school?</span>
				</label>
				<br />
				<label className="inline-flex items-center gap-2 text-sm text-black/70">
					<input type="checkbox" checked={!!deal.reportedToCollective} disabled={disabled} onChange={e => onChange({ ...deal, reportedToCollective: e.target.checked })} />
					<span>Reported to collective?</span>
				</label>
			</div>
			<div className="bg-white border border-black/10 rounded-md p-3">
				<div className="text-black font-semibold mb-2">Compliance Notes</div>
				<textarea
					value={notes}
					onChange={e => setNotes(e.target.value)}
					disabled={disabled}
					className="w-full ui-input"
					placeholder="Any compliance considerations, limits, or approvals"
				/>
			</div>
			<p className="text-xs text-black/70">This is educational only, not legal/financial advice.</p>
		</div>
	)
}


