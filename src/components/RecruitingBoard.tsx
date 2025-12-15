import Card from './ui/Card'
import Button from './ui/Button'
import { useEffect, useMemo, useState } from 'react'
import { CollegeProgram } from '../recruiting/programTypes'
import { getTargetsFor, RecruitingStatus, upsertTarget } from '../recruiting/pipeline'
import { SAMPLE_PROGRAMS } from '../recruiting/programData'
import { load } from '../utils/storage'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'

type Row = {
	targetId: string
	program: CollegeProgram
	status: RecruitingStatus
}

const COLUMNS: RecruitingStatus[] = [
	'not_contacted',
	'researching',
	'contacted',
	'in_conversation',
	'offer_received',
	'committed',
	'archived'
]

export default function RecruitingBoard() {
	const [rows, setRows] = useState<Row[]>([])
	const { user } = useAuth()

	useEffect(() => {
		let cancelled = false
		async function loadData() {
			// Prefer Supabase when configured and logged in
			if (supabase && user) {
				const { data, error } = await supabase
					.from('recruiting_targets')
					.select('id, program, status')
					.eq('user_id', user.id)
					.order('created_at', { ascending: false })
				if (!cancelled && !error && Array.isArray(data)) {
					const mapped: Row[] = data
						.map((r: any) => ({ targetId: r.id, program: r.program as CollegeProgram, status: r.status as RecruitingStatus }))
					setRows(mapped)
					return
				}
			}
			// Fallback to localStorage pipeline
			const athlete = load<any>('athlete', null)
			const athleteId: string | null = athlete?.id || null
			const targets = getTargetsFor(athleteId || undefined)
			const byId: Record<string, CollegeProgram> = Object.fromEntries(SAMPLE_PROGRAMS.map(p => [p.id, p]))
			const mapped: Row[] = targets
				.map(t => (byId[t.programId] ? { targetId: t.id, program: byId[t.programId], status: t.status } : null))
				.filter(Boolean) as Row[]
			if (!cancelled) setRows(mapped)
		}
		loadData()
		return () => { cancelled = true }
	}, [user])

	const byColumn = useMemo(() => {
		const m: Record<RecruitingStatus, Row[]> = {
			not_contacted: [], researching: [], contacted: [], in_conversation: [], offer_received: [], committed: [], archived: []
		}
		for (const r of rows) m[r.status].push(r)
		return m
	}, [rows])

	async function updateStatus(targetId: string, status: RecruitingStatus) {
		// Try cloud update first
		if (supabase && user) {
			const { error } = await supabase.from('recruiting_targets').update({ status }).eq('id', targetId)
			if (!error) {
				setRows(curr => curr.map(r => (r.targetId === targetId ? { ...r, status } : r)))
				return
			}
		}
		// Fallback local
		const athlete = load<any>('athlete', null)
		const athleteId: string | null = athlete?.id || null
		const t = getTargetsFor(athleteId || undefined).find(x => x.id === targetId)
		if (!t) return
		upsertTarget({ ...t, status })
		setRows(curr => curr.map(r => (r.targetId === targetId ? { ...r, status } : r)))
	}

	return (
		<div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-7 gap-4">
			{COLUMNS.map(col => (
				<Card key={col} title={col.replaceAll('_',' ')}>
					<div className="space-y-3">
						{byColumn[col].length === 0 && <div className="subtle text-sm">—</div>}
						{byColumn[col].map(r => (
							<div key={r.targetId} className="bg-mid border border-border rounded-md p-3">
								<div className="text-white font-semibold truncate">{r.program.name}</div>
								<div className="text-xs text-gray-400 truncate">{[r.program.sport, r.program.level, r.program.conference].filter(Boolean).join(' • ')}</div>
								<div className="mt-2 flex flex-wrap gap-2">
									{(['not_contacted','researching','contacted','in_conversation','offer_received','committed','archived'] as RecruitingStatus[]).map(s => (
										<Button key={s} variant="ghost" onClick={() => updateStatus(r.targetId, s)}>{s.replaceAll('_',' ')}</Button>
									))}
								</div>
							</div>
						))}
					</div>
				</Card>
			))}
		</div>
	)
}


