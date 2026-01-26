import { useEffect, useMemo, useState } from 'react'
import Observability, { type ObservabilityEntry } from '../lib/obs'

export default function DiagnosticsPanel() {
	const [open, setOpen] = useState(false)
	const [now, setNow] = useState(0)

	// Poll to refresh logs periodically when open
	useEffect(() => {
		if (!open) return
		const id = setInterval(() => setNow(Date.now()), 1000)
		return () => clearInterval(id)
	}, [open])

	const logs = useMemo<ObservabilityEntry[]>(() => {
		const a = Observability.getLogs({ feature: 'discover', limit: 20 })
		const b = Observability.getLogs({ feature: 'recruitment', limit: 20 })
		const c = Observability.getLogs({ feature: 'discover_api', limit: 20 })
		const d = Observability.getLogs({ feature: 'recruitment_api', limit: 20 })
		return [...a, ...b, ...c, ...d].sort((x, y) => (x.tsMs - y.tsMs))
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [now])

	const lastDiscoverId = Observability.getLastRequestId('discover') || Observability.getLastRequestId('discover_api')
	const lastRecruitId = Observability.getLastRequestId('recruitment') || Observability.getLastRequestId('recruitment_api')

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(v => !v)}
				className="fixed bottom-4 right-4 z-40 rounded-md bg-amber-700 text-white px-3 py-2 text-sm shadow hover:bg-amber-600"
			>
				{open ? 'Hide Diagnostics' : 'Diagnostics'}
			</button>
			{open && (
				<div className="fixed bottom-16 right-4 z-40 w-[560px] max-h-[60vh] overflow-auto rounded-md border border-border bg-background/95 backdrop-blur p-3">
					<div className="text-white font-semibold mb-2">Observability Diagnostics</div>
					<div className="text-xs text-gray-300 mb-2">
						<span className="mr-3">Last Discover requestId: <code>{lastDiscoverId || '—'}</code></span>
						<span>Last Recruitment requestId: <code>{lastRecruitId || '—'}</code></span>
					</div>
					<table className="w-full text-xs">
						<thead>
							<tr className="text-gray-400">
								<th className="text-left pr-2">time</th>
								<th className="text-left pr-2">feature</th>
								<th className="text-left pr-2">status</th>
								<th className="text-left pr-2">route</th>
								<th className="text-left pr-2">requestId</th>
								<th className="text-left pr-2">duration</th>
								<th className="text-left">error</th>
							</tr>
						</thead>
						<tbody>
							{logs.slice(-20).map((l, idx) => (
								<tr key={idx} className="text-gray-200">
									<td className="pr-2 align-top">{new Date(l.tsMs).toLocaleTimeString()}</td>
									<td className="pr-2 align-top">{l.feature}</td>
									<td className="pr-2 align-top">{l.status}</td>
									<td className="pr-2 align-top">{l.route}</td>
									<td className="pr-2 align-top"><code>{l.requestId}</code></td>
									<td className="pr-2 align-top">{typeof l.durationMs === 'number' ? `${l.durationMs}ms` : ''}</td>
									<td className="align-top">
										{l.errorMessage ? `${l.errorName || 'Error'}: ${l.errorMessage}` : ''}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</>
	)
}

