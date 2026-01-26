import { useEffect, useMemo, useState } from 'react'
import Card from './ui/Card'
import Button from './ui/Button'
import Input from './ui/Input'
import Select from './ui/Select'
import Textarea from './ui/Textarea'
import { AthleteProfile, DealLogEntry, EventPlan, EventType } from '../types'
import { load, save } from '../utils/storage'

type Props = { athlete: AthleteProfile | null }
type Store = Record<string, EventPlan[]> // key: athleteId
type DealStore = Record<string, DealLogEntry[]>

const TYPES: EventType[] = ['appearance','signing','charity_event','camp_clinic','other']

function createEmpty(athleteId: string): EventPlan {
	return {
		id: `evt-${Date.now()}`,
		athleteId,
		type: 'appearance',
		name: '',
		date: new Date().toISOString().slice(0, 10),
		location: ''
	}
}

export default function EventsPlanner({ athlete }: Props) {
	const athleteId = athlete?.id || 'anonymous'
	const [store, setStore] = useState<Store>(() => load<Store>('events.store', {}))
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [activeTab, setActiveTab] = useState<'list' | 'details' | 'notes'>('list')

	useEffect(() => save('events.store', store), [store])

	const dealsForAthlete = useMemo(() => {
		const ds = load<DealStore>('deals.store', {})
		return (ds[athleteId] || []).map(d => ({ id: d.id, label: d.title || d.brandName || d.id }))
	}, [athleteId])

	const list = useMemo(() => {
		const arr = (store[athleteId] || []).slice()
		return arr.sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.id.localeCompare(b.id))
	}, [store, athleteId])

	const selected = useMemo(() => (selectedId ? (store[athleteId] || []).find(e => e.id === selectedId) || null : null), [selectedId, store, athleteId])

	function upsert(next: EventPlan) {
		setStore(prev => {
			const arr = prev[athleteId] || []
			const idx = arr.findIndex(e => e.id === next.id)
			const updated = idx === -1 ? [next, ...arr] : arr.map(e => (e.id === next.id ? next : e))
			return { ...prev, [athleteId]: updated }
		})
	}
	function remove(id: string) {
		setStore(prev => ({ ...prev, [athleteId]: (prev[athleteId] || []).filter(e => e.id !== id) }))
		if (selectedId === id) setSelectedId(null)
	}
	function addNew() {
		if (!athlete) return
		const e = createEmpty(athlete.id)
		upsert(e)
		setSelectedId(e.id)
		setActiveTab('details')
	}

	return (
		<Card title="Events & Camps">
			<div className="mb-4 flex items-center gap-2">
				<nav className="flex items-center gap-2">
					<button className={`px-3 py-1 rounded-md text-sm ${activeTab === 'list' ? 'bg-mid text-white' : 'bg-surface text-gray-300'}`} onClick={() => setActiveTab('list')}>Events & Camps</button>
					<button className={`px-3 py-1 rounded-md text-sm ${activeTab === 'details' ? 'bg-mid text-white' : 'bg-surface text-gray-300'}`} onClick={() => setActiveTab('details')}>Details</button>
					<button className={`px-3 py-1 rounded-md text-sm ${activeTab === 'notes' ? 'bg-mid text-white' : 'bg-surface text-gray-300'}`} onClick={() => setActiveTab('notes')}>Notes</button>
				</nav>
				{activeTab === 'list' && (
					<div className="ml-auto">
						<Button onClick={addNew}>New</Button>
					</div>
				)}
			</div>

			{activeTab === 'list' && (
				<div className="overflow-x-auto">
					<table className="table min-w-[720px] text-sm">
						<thead>
							<tr>
								<th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-black/70 w-[15%]">Date</th>
								<th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-black/70 w-[30%]">Name</th>
								<th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-black/70 w-[15%]">Type</th>
								<th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-black/70 w-[20%]">Location</th>
								<th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-black/70 w-[15%]">Linked Deal</th>
								<th className="w-[5%]" />
							</tr>
						</thead>
						<tbody>
							{list.map(evt => (
								<tr key={evt.id} className={`border-b border-black/10 ${selectedId === evt.id ? 'bg-slate-50' : ''}`}>
									<td className="px-3 py-2 text-black/80 whitespace-nowrap">{evt.date}</td>
									<td className="px-3 py-2 text-black">
										<button className="underline" onClick={() => { setSelectedId(evt.id); setActiveTab('details') }}>{evt.name || '(untitled event)'}</button>
									</td>
									<td className="px-3 py-2 text-black/80 whitespace-nowrap">{evt.type.replaceAll('_',' ')}</td>
									<td className="px-3 py-2 text-black">{evt.location || '—'}</td>
									<td className="px-3 py-2 text-black/80">
										{evt.linkedDealId ? (dealsForAthlete.find(d => d.id === evt.linkedDealId)?.label || evt.linkedDealId) : '—'}
									</td>
									<td className="px-3 py-2 text-right">
										<Button variant="ghost" className="text-xs px-2 py-1" onClick={() => remove(evt.id)}>Remove</Button>
									</td>
								</tr>
							))}
							{list.length === 0 && (
								<tr>
									<td colSpan={6} className="px-3 py-6 text-center text-black/70">No events planned yet — click “New” to add one.</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			)}

			{activeTab === 'details' && (
				<div>
					{!selected ? (
						<div className="subtle">Select an event to view/edit details.</div>
					) : (
						<EventEditor
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
						<div className="subtle">Notes and planning details will appear here.</div>
					) : (
						<Textarea
							value={selected.notes || ''}
							onChange={e => upsert({ ...selected, notes: e.target.value })}
							className="min-h-[200px]"
							placeholder="Agenda, action items, logistics…"
						/>
					)}
				</div>
			)}
		</Card>
	)
}

function EventEditor({ value, onChange, deals }: { value: EventPlan; onChange: (e: EventPlan) => void; deals: { id: string; label: string }[] }) {
	return (
		<div className="space-y-3">
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				<Input value={value.name} onChange={e => onChange({ ...value, name: e.target.value })} placeholder="Event name" />
				<Select value={value.type} onChange={e => onChange({ ...value, type: e.target.value as EventType })}>
					{TYPES.map(t => <option key={t} value={t}>{t.replaceAll('_',' ')}</option>)}
				</Select>
				<Input type="date" value={value.date} onChange={e => onChange({ ...value, date: e.target.value })} />
				<Input value={value.location} onChange={e => onChange({ ...value, location: e.target.value })} placeholder="Location" />
				<Input value={value.hostOrganization || ''} onChange={e => onChange({ ...value, hostOrganization: e.target.value })} placeholder="Host/organizer (optional)" />
				<Input type="number" min={0} value={value.expectedAttendees ?? ''} onChange={e => onChange({ ...value, expectedAttendees: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="Expected attendees (optional)" />
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				<Input value={(value.sponsors || []).join(', ')} onChange={e => onChange({ ...value, sponsors: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} placeholder="Sponsor names (comma-separated)" />
				<Select value={value.linkedDealId || ''} onChange={e => onChange({ ...value, linkedDealId: (e.target.value || undefined) })}>
					<option value="">Link to a Deal (optional)</option>
					{deals.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
				</Select>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				<Input value={value.runOfShowUrl || ''} onChange={e => onChange({ ...value, runOfShowUrl: e.target.value })} placeholder="Run-of-show doc URL (optional)" />
				<Input value={value.waiversUrl || ''} onChange={e => onChange({ ...value, waiversUrl: e.target.value })} placeholder="Waivers doc URL (optional)" />
			</div>
		</div>
	)
}



