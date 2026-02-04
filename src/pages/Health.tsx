import { useEffect, useState } from 'react'
import { BUILD_ID } from '../constants/build'
import { APP_INSTANCE } from '../config/env'
import { supabase, supabaseEnvConfigured } from '../lib/supabaseClient'
import Button from '../components/ui/Button'

type HealthzResponse = {
	buildId: string
	timestamp: string
	appInstance: string
	configPresence: {
		hasViteSupabaseUrl: boolean
		hasViteSupabaseAnonKey: boolean
		hasViteGoogleMapsApiKey: boolean
		hasGoogleMapsServerKey: boolean
		hasVercelGitCommitSha: boolean
	}
	supabase?: {
		configured: boolean
		connected: boolean
		error: string | null
	}
}

export default function Health() {
	const [serverHealth, setServerHealth] = useState<HealthzResponse | null>(null)
	const [serverError, setServerError] = useState<string | null>(null)
	const [authState, setAuthState] = useState<'checking' | 'logged-in' | 'logged-out'>('checking')
	const [copied, setCopied] = useState(false)

	useEffect(() => {
		// Check auth state
		async function checkAuth() {
			try {
				if (!supabase) {
					setAuthState('logged-out')
					return
				}
				const { data } = await supabase.auth.getSession()
				setAuthState(data?.session ? 'logged-in' : 'logged-out')
			} catch {
				setAuthState('logged-out')
			}
		}

		// Fetch server health
		async function fetchHealth() {
			try {
				const res = await fetch('/api/healthz', { cache: 'no-store' })
				if (!res.ok) {
					const text = await res.text().catch(() => '')
					throw new Error(`HTTP ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`)
				}
				const data = await res.json() as HealthzResponse
				setServerHealth(data)
			} catch (e: any) {
				setServerError(String(e?.message || e))
			}
		}

		checkAuth()
		fetchHealth()
	}, [])

	// Client-side env presence checks
	const clientEnvPresence = {
		hasSupabaseUrl: Boolean(import.meta.env.VITE_SUPABASE_URL),
		hasAnonKey: Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY),
		hasGoogleMapsKey: Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY),
	}

	async function copyJson() {
		try {
			const payload = {
				appInstance: APP_INSTANCE,
				buildId: BUILD_ID,
				server: serverHealth,
				clientEnvPresence,
				authState,
				timestamp: new Date().toISOString()
			}
			await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
			setCopied(true)
			setTimeout(() => setCopied(false), 1200)
		} catch {}
	}

	return (
		<div className="min-h-screen bg-background">
			<header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
				<div className="mx-auto max-w-3xl px-4 md:px-6 py-4 flex items-center justify-between">
					<h1 className="headline text-2xl">Health Check</h1>
					<a
						href="/"
						className="text-sm text-gray-300 hover:text-white underline"
					>
						← Home
					</a>
				</div>
			</header>
			<main className="mx-auto max-w-3xl px-4 md:px-6 py-6 space-y-4">
				{/* App Instance */}
				<section className="card p-4 space-y-2">
					<div className="flex items-center justify-between">
						<div className="text-white font-semibold">App Instance</div>
						<Button onClick={copyJson} variant="ghost">
							{copied ? 'Copied' : 'Copy JSON'}
						</Button>
					</div>
					<div className="text-sm text-gray-300 space-y-1">
						<div>
							Instance:{' '}
							<span className="text-white font-mono" data-testid="app-instance">
								{APP_INSTANCE}
							</span>
						</div>
						<div className="text-xs text-gray-400">
							Set via VITE_APP_INSTANCE environment variable
						</div>
					</div>
				</section>

				{/* Build Information */}
				<section className="card p-4 space-y-2">
					<div className="text-white font-semibold">Build Information</div>
					<div className="text-sm text-gray-300 space-y-1">
						<div>
							Client BUILD_ID:{' '}
							<span className="text-white font-mono" data-testid="client-build-id">
								{BUILD_ID}
							</span>
						</div>
						<div>
							Server BUILD_ID:{' '}
							{serverHealth ? (
								<span className="text-white font-mono" data-testid="server-build-id">
									{serverHealth.buildId}
								</span>
							) : serverError ? (
								<span className="text-amber-300">{serverError}</span>
							) : (
								<span className="text-gray-400">loading…</span>
							)}
						</div>
						{serverHealth && (
							<div>
								Timestamp:{' '}
								<span className="text-gray-400 text-xs">
									{new Date(serverHealth.timestamp).toLocaleString()}
								</span>
							</div>
						)}
					</div>
				</section>

				{/* Environment Variables */}
				<section className="card p-4 space-y-2">
					<div className="text-white font-semibold">Environment Configuration</div>
					<div className="text-sm text-gray-300 space-y-1">
						<div>
							hasSupabaseUrl:{' '}
							<span className={clientEnvPresence.hasSupabaseUrl ? 'text-green-400' : 'text-red-400'}>
								{String(clientEnvPresence.hasSupabaseUrl)}
							</span>
						</div>
						<div>
							hasAnonKey:{' '}
							<span className={clientEnvPresence.hasAnonKey ? 'text-green-400' : 'text-red-400'}>
								{String(clientEnvPresence.hasAnonKey)}
							</span>
						</div>
						<div>
							hasGoogleMapsKey:{' '}
							<span className={clientEnvPresence.hasGoogleMapsKey ? 'text-green-400' : 'text-red-400'}>
								{String(clientEnvPresence.hasGoogleMapsKey)}
							</span>
						</div>
						{serverHealth && (
							<div className="mt-3 pt-3 border-t border-border">
								<div className="text-xs uppercase tracking-wide text-gray-400 mb-2">
									Server-side checks
								</div>
								<div>
									hasGoogleMapsServerKey:{' '}
									<span
										className={
											serverHealth.configPresence.hasGoogleMapsServerKey
												? 'text-green-400'
												: 'text-red-400'
										}
									>
										{String(serverHealth.configPresence.hasGoogleMapsServerKey)}
									</span>
								</div>
							</div>
						)}
					</div>
				</section>

				{/* Auth State */}
				<section className="card p-4 space-y-2">
					<div className="text-white font-semibold">Authentication Status</div>
					<div className="text-sm text-gray-300 space-y-1">
						<div>
							Current auth state:{' '}
							<span
								className={
									authState === 'logged-in'
										? 'text-green-400'
										: authState === 'logged-out'
										? 'text-gray-400'
										: 'text-amber-400'
								}
								data-testid="auth-state"
							>
								{authState}
							</span>
						</div>
						<div>
							Supabase configured:{' '}
							<span className={supabaseEnvConfigured ? 'text-green-400' : 'text-red-400'}>
								{String(supabaseEnvConfigured)}
							</span>
						</div>
						{serverHealth?.supabase && (
							<div className="mt-3 pt-3 border-t border-border">
								<div className="text-xs uppercase tracking-wide text-gray-400 mb-2">
									Supabase health
								</div>
								<div>
									Connected:{' '}
									<span
										className={
											serverHealth.supabase.connected ? 'text-green-400' : 'text-red-400'
										}
									>
										{String(serverHealth.supabase.connected)}
									</span>
								</div>
								{serverHealth.supabase.error && (
									<div className="text-xs text-amber-300 mt-1">
										Error: {serverHealth.supabase.error}
									</div>
								)}
							</div>
						)}
					</div>
				</section>

				{/* JSON dump */}
				<section className="card p-4 space-y-2">
					<div className="text-white font-semibold">Raw JSON</div>
					<pre className="bg-mid border border-border rounded-md p-3 whitespace-pre-wrap text-gray-100 text-xs overflow-auto max-h-96">
						{JSON.stringify(
							{
								appInstance: APP_INSTANCE,
								buildId: BUILD_ID,
								server: serverHealth,
								clientEnvPresence,
								authState,
								timestamp: new Date().toISOString()
							},
							null,
							2
						)}
					</pre>
				</section>
			</main>
		</div>
	)
}
