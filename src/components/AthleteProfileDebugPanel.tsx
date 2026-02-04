import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import type { SupabaseErrorRaw } from '../hooks/useAutosaveProfile'

type Props = {
	user: User | null
	profileFetched: boolean
	lastSaveAttempt: number | null
	lastSavedAt: number | null
	status: string
	error: string | null
	errorRaw: SupabaseErrorRaw | null
}

// Component to show last save payload details
function ProfileSnapshotSection() {
	const [expanded, setExpanded] = useState(false)
	const [lastPayload, setLastPayload] = useState<any>(null)

	useEffect(() => {
		// Poll for updated payload from window
		const interval = setInterval(() => {
			const payload = (window as any).__lastProfileSavePayload
			if (payload && payload !== lastPayload) {
				setLastPayload(payload)
			}
		}, 500)
		return () => clearInterval(interval)
	}, [lastPayload])

	if (!lastPayload) {
		return (
			<div className="bg-purple-950/30 rounded p-2 border border-purple-700">
				<div className="text-purple-400 font-semibold">📸 Profile Snapshot</div>
				<div className="text-purple-200 text-[10px] mt-1">
					No save payload captured yet. Make a change to the profile to see what gets saved.
				</div>
			</div>
		)
	}

	return (
		<div className="bg-purple-950/30 rounded p-3 border border-purple-700 space-y-2">
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="w-full flex items-center justify-between text-left"
			>
				<div className="text-purple-400 font-semibold">📸 Profile Snapshot (Last Save)</div>
				<span className="text-purple-400">{expanded ? '▼' : '▶'}</span>
			</button>
			
			<div className="text-[10px] text-purple-200">
				Last captured: {new Date(lastPayload.timestamp).toLocaleString()}
			</div>

			<div className="grid grid-cols-2 gap-2">
				<div className="bg-surface/50 rounded p-2 border border-border">
					<div className="text-gray-400 mb-1">Total Keys</div>
					<div className="text-white font-mono">{lastPayload.keys?.length || 0}</div>
				</div>
				<div className="bg-surface/50 rounded p-2 border border-border">
					<div className="text-gray-400 mb-1">Payload Size</div>
					<div className="text-white font-mono">{(lastPayload.fullSize / 1024).toFixed(1)} KB</div>
				</div>
			</div>

			<div className="bg-surface/50 rounded p-2 border border-border">
				<div className="text-gray-400 mb-1">Top-Level Keys</div>
				<div className="text-white text-[10px] font-mono break-all">
					{lastPayload.keys?.join(', ')}
				</div>
			</div>

			{expanded && (
				<div className="bg-surface/50 rounded p-2 border border-border">
					<div className="text-gray-400 mb-2">Critical Fields (Deep Sample)</div>
					<pre className="text-[9px] text-white font-mono overflow-auto max-h-96 bg-background p-2 rounded">
						{JSON.stringify(lastPayload.criticalFields, null, 2)}
					</pre>
				</div>
			)}
		</div>
	)
}

export default function AthleteProfileDebugPanel({
	user,
	profileFetched,
	lastSaveAttempt,
	lastSavedAt,
	status,
	error,
	errorRaw
}: Props) {
	const [expanded, setExpanded] = useState(true)

	// Extract environment info
	const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
	const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
	const envMode = import.meta.env.MODE
	
	const hasViteSupabaseUrl = Boolean(supabaseUrl && supabaseUrl.trim() !== '')
	const hasViteSupabaseAnonKey = Boolean(supabaseAnonKey && supabaseAnonKey.trim() !== '')
	
	let supabaseHostname = '—'
	if (hasViteSupabaseUrl) {
		try {
			supabaseHostname = new URL(supabaseUrl!).hostname
		} catch {
			supabaseHostname = 'invalid URL'
		}
	}

	// Log environment diagnostics to console when ?debug=1
	useEffect(() => {
		if (typeof window !== 'undefined') {
			const params = new URLSearchParams(window.location.search)
			if (params.get('debug') === '1') {
				console.log('[Debug Panel] Environment Diagnostics:', {
					supabaseHostname,
					environmentMode: envMode,
					hasViteSupabaseUrl,
					hasViteSupabaseAnonKey,
					userId: user?.id || null,
					userEmail: user?.email || null,
					profileFetched,
					status,
					timestamp: new Date().toISOString()
				})
			}
		}
	}, [supabaseHostname, envMode, hasViteSupabaseUrl, hasViteSupabaseAnonKey, user?.id, user?.email, profileFetched, status])

	// Only show if ?debug=1 is in URL
	if (typeof window !== 'undefined') {
		const params = new URLSearchParams(window.location.search)
		if (params.get('debug') !== '1') return null
	}

	return (
		<div className="mb-4 border border-amber-500 rounded-lg bg-amber-950/20">
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-amber-900/10"
			>
				<div className="flex items-center gap-2">
					<span className="text-amber-400 font-semibold">🔍 Athlete Profile Debug</span>
					<span className="text-xs text-amber-300/60">(?debug=1 only)</span>
				</div>
				<span className="text-amber-400">{expanded ? '▼' : '▶'}</span>
			</button>

			{expanded && (
				<div className="px-4 pb-4 space-y-3 text-xs">
					{/* Environment Configuration */}
					<div className="bg-blue-950/30 rounded p-3 border border-blue-700 space-y-2">
						<div className="text-blue-400 font-semibold mb-2">Environment Configuration</div>
						
						<div className="grid grid-cols-2 gap-2">
							<div>
								<span className="text-gray-400">Supabase Hostname:</span>
								<div className="text-white mt-1 text-[10px] font-mono break-all bg-surface/50 p-1 rounded">
									{supabaseHostname}
								</div>
							</div>
							<div>
								<span className="text-gray-400">Environment Mode:</span>
								<div className="text-white mt-1 text-[10px] font-mono bg-surface/50 p-1 rounded">
									{envMode}
								</div>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-2">
							<div className="flex items-center gap-2">
								<span className={`inline-block w-2 h-2 rounded-full ${hasViteSupabaseUrl ? 'bg-green-400' : 'bg-red-400'}`} />
								<span className="text-gray-400">VITE_SUPABASE_URL:</span>
								<span className="text-white text-[10px]">
									{hasViteSupabaseUrl ? '✓ Set' : '✗ Missing'}
								</span>
							</div>
							<div className="flex items-center gap-2">
								<span className={`inline-block w-2 h-2 rounded-full ${hasViteSupabaseAnonKey ? 'bg-green-400' : 'bg-red-400'}`} />
								<span className="text-gray-400">VITE_SUPABASE_ANON_KEY:</span>
								<span className="text-white text-[10px]">
									{hasViteSupabaseAnonKey ? '✓ Set' : '✗ Missing'}
								</span>
							</div>
						</div>
					</div>

					{/* User Info */}
					<div className="grid grid-cols-2 gap-2">
						<div className="bg-surface/50 rounded p-2 border border-border">
							<div className="text-gray-400 mb-1">Current User ID</div>
							<div className="text-white font-mono text-[10px] break-all">
								{user?.id || '—'}
							</div>
						</div>
						<div className="bg-surface/50 rounded p-2 border border-border">
							<div className="text-gray-400 mb-1">User Email</div>
							<div className="text-white text-[10px] break-all">
								{user?.email || '—'}
							</div>
						</div>
					</div>

					{/* Fetch Status */}
					<div className="bg-surface/50 rounded p-2 border border-border">
						<div className="text-gray-400 mb-1">Profile Fetch Status</div>
						<div className="flex items-center gap-2">
							<span className={`inline-block w-2 h-2 rounded-full ${profileFetched ? 'bg-green-400' : 'bg-red-400'}`} />
							<span className="text-white">
								{profileFetched ? '✓ Profile fetched from database' : '✗ Profile not fetched yet'}
							</span>
						</div>
					</div>

					{/* Save Status */}
					<div className="grid grid-cols-2 gap-2">
						<div className="bg-surface/50 rounded p-2 border border-border">
							<div className="text-gray-400 mb-1">Current Status</div>
							<div className="text-white">
								<span className={`inline-block w-2 h-2 rounded-full mr-2 ${
									status === 'saved' ? 'bg-green-400' :
									status === 'saving' ? 'bg-yellow-400 animate-pulse' :
									status === 'error' ? 'bg-red-400' :
									status === 'loading' ? 'bg-blue-400 animate-pulse' :
									'bg-gray-400'
								}`} />
								{status}
							</div>
						</div>
						<div className="bg-surface/50 rounded p-2 border border-border">
							<div className="text-gray-400 mb-1">Last Save Attempt</div>
							<div className="text-white text-[10px]">
								{lastSaveAttempt ? new Date(lastSaveAttempt).toLocaleString() : '—'}
							</div>
						</div>
					</div>

					{/* Last Saved */}
					<div className="bg-surface/50 rounded p-2 border border-border">
						<div className="text-gray-400 mb-1">Last Successful Save</div>
						<div className="text-white text-[10px]">
							{lastSavedAt ? (
								<>
									{new Date(lastSavedAt).toLocaleString()}
									<span className="ml-2 text-gray-400">
										({Math.round((Date.now() - lastSavedAt) / 1000)}s ago)
									</span>
								</>
							) : '—'}
						</div>
					</div>

					{/* Error Display */}
					{error && (
						<div className="bg-red-950/30 rounded p-2 border border-red-700">
							<div className="text-red-400 font-semibold mb-1">Error Message</div>
							<div className="text-red-200 text-[10px] font-mono break-all">
								{error}
							</div>
						</div>
					)}

					{/* Raw Supabase Error */}
					{errorRaw && (
						<div className="bg-red-950/30 rounded p-3 border border-red-700 space-y-2">
							<div className="text-red-400 font-semibold">Raw Supabase Error Details</div>
							
							{errorRaw.timestamp && (
								<div>
									<span className="text-gray-400">Timestamp:</span>
									<span className="text-white ml-2 text-[10px]">
										{new Date(errorRaw.timestamp).toLocaleString()}
									</span>
								</div>
							)}

							{errorRaw.userId && (
								<div>
									<span className="text-gray-400">User ID:</span>
									<span className="text-white ml-2 text-[10px] font-mono break-all">
										{errorRaw.userId}
									</span>
								</div>
							)}

							{errorRaw.code && (
								<div>
									<span className="text-gray-400">Error Code:</span>
									<span className="text-red-300 ml-2 font-mono font-bold">
										{errorRaw.code}
									</span>
								</div>
							)}

							{errorRaw.status && (
								<div>
									<span className="text-gray-400">HTTP Status:</span>
									<span className="text-white ml-2 font-mono">
										{errorRaw.status}
									</span>
								</div>
							)}

							{errorRaw.message && (
								<div>
									<span className="text-gray-400">Message:</span>
									<div className="text-red-200 mt-1 text-[10px] font-mono bg-red-950/50 p-2 rounded break-all">
										{errorRaw.message}
									</div>
								</div>
							)}

							{errorRaw.details && (
								<div>
									<span className="text-gray-400">Details:</span>
									<div className="text-red-200 mt-1 text-[10px] font-mono bg-red-950/50 p-2 rounded break-all">
										{errorRaw.details}
									</div>
								</div>
							)}

							{errorRaw.hint && (
								<div>
									<span className="text-gray-400">Hint:</span>
									<div className="text-amber-200 mt-1 text-[10px] font-mono bg-amber-950/50 p-2 rounded break-all">
										{errorRaw.hint}
									</div>
								</div>
							)}

							{errorRaw.payloadKeys && errorRaw.payloadKeys.length > 0 && (
								<div>
									<span className="text-gray-400">Payload Keys Being Saved:</span>
									<div className="text-white mt-1 text-[10px] font-mono bg-surface/50 p-2 rounded">
										{errorRaw.payloadKeys.join(', ')}
									</div>
								</div>
							)}
						</div>
					)}

					{/* Profile Snapshot (Last Save Payload) */}
					<ProfileSnapshotSection />

					{/* Success State (no errors) */}
					{!error && !errorRaw && profileFetched && status === 'saved' && (
						<div className="bg-green-950/30 rounded p-2 border border-green-700">
							<div className="text-green-400 font-semibold">✓ All Systems Operational</div>
							<div className="text-green-200 text-[10px] mt-1">
								Profile is fetched and saves are working correctly.
							</div>
						</div>
					)}

					{/* Help Text */}
					<div className="text-gray-500 text-[10px] border-t border-border pt-2 mt-3">
						<div className="font-semibold mb-1">Debug Mode Active</div>
						<ul className="list-disc list-inside space-y-1">
							<li>This panel only shows when URL contains <code className="bg-surface px-1 rounded">?debug=1</code></li>
							<li>All save errors are logged to browser console with full details</li>
							<li>Check Network tab for raw Supabase API requests/responses</li>
							<li>Remove <code className="bg-surface px-1 rounded">?debug=1</code> to hide this panel</li>
						</ul>
					</div>
				</div>
			)}
		</div>
	)
}
