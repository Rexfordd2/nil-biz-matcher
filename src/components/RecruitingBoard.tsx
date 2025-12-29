import Card from './ui/Card'
import Button from './ui/Button'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'

type Org = {
	id: string
	name: string
	sport: string | null
	level: string | null
	org_type: string | null
	city: string | null
	region: string | null
	country: string | null
	website_url: string | null
}

type Row = {
	targetId: string
	org: Org
	status: string
}

const STATUS_COLUMNS: string[] = ['To Contact', 'Contacted', 'In Progress', 'Offer/Visit', 'Closed']

export default function RecruitingBoard() {
	const [rows, setRows] = useState<Row[]>([])
	const { user } = useAuth()

	useEffect(() => {
		let cancelled = false
		async function loadData() {
			if (!supabase || !user) {
				setRows([])
				return
			}
			const { data, error } = await supabase
				.from('user_targets')
				.select('id, status, orgs:org_id(*)')
				.eq('user_id', user.id)
				.order('updated_at', { ascending: false })
			if (cancelled) return
			if (error || !Array.isArray(data)) {
				setRows([])
				return
			}
			const mapped: Row[] = (data as any[])
				.filter(r => r.orgs && r.orgs.id)
				.map(r => ({
					targetId: String(r.id),
					status: String(r.status || 'To Contact'),
					org: {
						id: String(r.orgs.id),
						name: String(r.orgs.name || 'Org'),
						sport: r.orgs.sport ?? null,
						level: r.orgs.level ?? null,
						org_type: r.orgs.org_type ?? null,
						city: r.orgs.city ?? null,
						region: r.orgs.region ?? null,
						country: r.orgs.country ?? null,
						website_url: r.orgs.website_url ?? null
					}
				}))
			setRows(mapped)
		}
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		loadData()
		return () => { cancelled = true }
	}, [user])

	const byColumn = useMemo(() => {
		const m: Record<string, Row[]> = Object.fromEntries(STATUS_COLUMNS.map(s => [s, [] as Row[]]))
		for (const r of rows) {
			const col = STATUS_COLUMNS.includes(r.status) ? r.status : 'To Contact'
			m[col].push(r)
		}
		return m
	}, [rows])

	async function updateStatus(targetId: string, status: string) {
		if (!supabase || !user) return
		const { error } = await supabase.from('user_targets').update({ status }).eq('id', targetId).eq('user_id', user.id)
		if (!error) {
			setRows(curr => curr.map(r => (r.targetId === targetId ? { ...r, status } : r)))
		}
	}

	return (
		<div className="grid grid-cols-1 md:grid-cols-5 xl:grid-cols-5 gap-4">
			{STATUS_COLUMNS.map(col => (
				<Card key={col} title={col}>
					<div className="space-y-2">
						{byColumn[col].length === 0 && <div className="subtle text-sm">—</div>}
						{byColumn[col].map(r => (
							<div key={r.targetId} className="bg-mid border border-border rounded-md p-2">
								<div className="text-white font-semibold text-sm truncate">{r.org.name}</div>
								<div className="text-xs text-gray-400 truncate">
									{[r.org.level, r.org.sport, r.org.org_type].filter(Boolean).join(' • ')}
								</div>
								<div className="mt-2 flex flex-wrap gap-1">
									{STATUS_COLUMNS.map(s => (
										<Button key={s} variant="ghost" className="text-xs px-2 py-1" onClick={() => updateStatus(r.targetId, s)}>{s}</Button>
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


