import { useEffect, useMemo, useState } from 'react'
import Button from '../components/ui/Button'
import { BUILD_ID } from '../constants/build'
import Observability from '../lib/obs'

type HealthzOk = { 
	buildId: string
	timestamp: string
	configPresence: {
		hasViteSupabaseUrl: boolean
		hasViteSupabaseAnonKey: boolean
		hasViteGoogleMapsApiKey: boolean
		hasGoogleMapsServerKey: boolean
		hasCseKey: boolean
		hasCseCx: boolean
		hasVercelGitCommitSha: boolean
	}
}

export default function DebugBuild() {
	const [serverInfo, setServerInfo] = useState<HealthzOk | null>(null)
	const [serverError, setServerError] = useState<string | null>(null)
	const [copied, setCopied] = useState(false)

	useEffect(() => {
		let cancelled = false
		async function load() {
			setServerError(null)
			try {
				const res = await fetch('/api/healthz', { cache: 'no-store' })
				if (!res.ok) {
					const text = await res.text().catch(() => '')
					throw new Error(`HTTP ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`)
				}
				const data = (await res.json()) as HealthzOk
				if (!cancelled) setServerInfo(data)
			} catch (e: any) {
				if (!cancelled) {
					setServerInfo(null)
					setServerError(String(e?.message || e))
				}
			}
		}
		load()
		return () => {
			cancelled = true
		}
	}, [])

	const diagnosticsEnabled = useMemo<boolean>(() => {
		return Boolean((Observability as any)?.isDiagnosticsEnabled?.())
	}, [])

	// Client-side config presence checks (VITE_* variables are client-side only)
	const clientConfigPresence = useMemo(() => {
		return {
			hasViteSupabaseUrl: Boolean(import.meta.env.VITE_SUPABASE_URL),
			hasViteSupabaseAnonKey: Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY),
			hasViteGoogleMapsApiKey: Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY),
			hasCseKey: Boolean(import.meta.env.VITE_GOOGLE_CSE_API_KEY),
			hasCseCx: Boolean(import.meta.env.VITE_GOOGLE_CSE_CX),
		}
	}, [])

	const payload = useMemo(() => {
		return {
			clientBuildId: BUILD_ID,
			server: serverInfo,
			serverError,
			host: typeof window !== 'undefined' ? window.location.host : '',
			diagnosticsEnabled,
			configPresence: {
				...clientConfigPresence,
				...(serverInfo?.configPresence || {})
			}
		}
	}, [serverInfo, serverError, diagnosticsEnabled, clientConfigPresence])

	async function copyJson() {
		try {
			await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
			setCopied(true)
			setTimeout(() => setCopied(false), 1200)
		} catch {}
	}

	return (
		<div className="min-h-screen">
			<header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
				<div className="mx-auto max-w-3xl px-4 md:px-6 py-4 flex items-center justify-between">
					<h1 className="headline text-2xl">Build Debug</h1>
					<div className="text-xs text-black">{`Build: ${BUILD_ID}`}</div>
				</div>
			</header>
			<main className="mx-auto max-w-3xl px-4 md:px-6 py-6 space-y-4">
				<section className="card p-4 space-y-2">
					<div className="flex items-center justify-between">
						<div className="text-white font-semibold">Info</div>
						<Button onClick={copyJson} variant="ghost">{copied ? 'Copied' : 'Copy JSON'}</Button>
					</div>
					<div className="text-sm text-gray-300 space-y-1">
						<div>
							Client BUILD_ID:{' '}
							<span className="text-white" data-testid="client-build-id">
								{BUILD_ID}
							</span>
						</div>
						<div>
							Server /healthz:{' '}
							{serverInfo ? (
								<>
									<span className="text-white" data-testid="server-build-id">
										{serverInfo.buildId}
									</span>
									<span className="text-gray-400">{` @ ${serverInfo.timestamp}`}</span>
								</>
							) : serverError ? (
								<span className="text-amber-300" data-testid="server-build-id">
									{serverError}
								</span>
							) : (
								<span className="text-gray-400">loading…</span>
							)}
						</div>
						<div>
							Hostname:{' '}
							<span className="text-white">
								{typeof window !== 'undefined' ? window.location.host : ''}
							</span>
						</div>
						<div>
							Diagnostics enabled:{' '}
							<span className="text-white">{String(diagnosticsEnabled)}</span>
						</div>
					</div>
				</section>
				<section className="card p-4 space-y-2">
					<div className="text-white font-semibold">Config Presence (from /api/healthz)</div>
					<div className="text-sm text-gray-300 space-y-1">
						<div>
							hasViteSupabaseUrl:{' '}
							<span className={serverInfo?.configPresence?.hasViteSupabaseUrl ? 'text-green-400' : 'text-red-400'}>
								{serverInfo ? String(serverInfo.configPresence.hasViteSupabaseUrl) : 'loading…'}
							</span>
						</div>
						<div>
							hasViteSupabaseAnonKey:{' '}
							<span className={serverInfo?.configPresence?.hasViteSupabaseAnonKey ? 'text-green-400' : 'text-red-400'}>
								{serverInfo ? String(serverInfo.configPresence.hasViteSupabaseAnonKey) : 'loading…'}
							</span>
						</div>
						<div>
							hasViteGoogleMapsApiKey:{' '}
							<span className={serverInfo?.configPresence?.hasViteGoogleMapsApiKey ? 'text-green-400' : 'text-red-400'}>
								{serverInfo ? String(serverInfo.configPresence.hasViteGoogleMapsApiKey) : 'loading…'}
							</span>
						</div>
						<div>
							hasGoogleMapsServerKey:{' '}
							<span className={serverInfo?.configPresence?.hasGoogleMapsServerKey ? 'text-green-400' : 'text-red-400'}>
								{serverInfo ? String(serverInfo.configPresence.hasGoogleMapsServerKey) : 'loading…'}
							</span>
						</div>
						<div>
							hasCseKey:{' '}
							<span className={serverInfo?.configPresence?.hasCseKey ? 'text-green-400' : 'text-red-400'}>
								{serverInfo ? String(serverInfo.configPresence.hasCseKey) : 'loading…'}
							</span>
						</div>
						<div>
							hasCseCx:{' '}
							<span className={serverInfo?.configPresence?.hasCseCx ? 'text-green-400' : 'text-red-400'}>
								{serverInfo ? String(serverInfo.configPresence.hasCseCx) : 'loading…'}
							</span>
						</div>
						<div>
							hasVercelGitCommitSha:{' '}
							<span className={serverInfo?.configPresence?.hasVercelGitCommitSha ? 'text-green-400' : 'text-red-400'}>
								{serverInfo ? String(serverInfo.configPresence.hasVercelGitCommitSha) : 'loading…'}
							</span>
						</div>
					</div>
				</section>
				<section className="card p-4">
					<div className="text-white font-semibold mb-2">JSON</div>
					<pre className="bg-mid border border-border rounded-md p-3 whitespace-pre-wrap text-gray-100 text-xs overflow-auto">
						{JSON.stringify(payload, null, 2)}
					</pre>
				</section>
			</main>
		</div>
	)
}

