/**
 * Google Maps/Places debug panel
 * Shows loader state, recent operations, and errors
 * Only visible with ?debug=1
 */

import { useMemo } from 'react'
import { getGoogleMapsStatus } from '../lib/google/loader'
import { hasGoogleMapsKey, APP_INSTANCE } from '../config/env'
import Observability, { type ObservabilityEntry } from '../lib/obs'

/**
 * Helper to safely render unknown values as React nodes
 */
function renderValue(v: unknown): React.ReactNode {
	if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
		return String(v)
	}
	if (v === null || v === undefined) {
		return '—'
	}
	if (v instanceof Error) {
		return v.message
	}
	// For objects and other types, stringify
	try {
		return <pre className="whitespace-pre-wrap break-all">{JSON.stringify(v, null, 2)}</pre>
	} catch {
		return String(v)
	}
}

export default function GoogleDebugPanel() {
	const params = new URLSearchParams(window.location.search)
	const showDebug = params.get('debug') === '1'
	
	if (!showDebug) return null
	
	const loaderStatus = getGoogleMapsStatus()
	
	// Get recent Google-related logs (both JS SDK and proxy)
	const recentLogs = useMemo(() => {
		const allLogs = Observability.getLogs({ limit: 100 })
		return allLogs.filter(log => 
			log.route?.startsWith('google.') || 
			log.route?.startsWith('proxy.')
		)
	}, [])
	
	// Get proxy-specific logs
	const proxyLogs = useMemo(() => {
		return recentLogs.filter(log => log.route === 'proxy.places-search')
	}, [recentLogs])
	
	// Get last 5 errors (including proxy errors)
	const recentErrors = useMemo(() => {
		return recentLogs
			.filter(log => log.status === 'error')
			.slice(-5)
			.reverse()
	}, [recentLogs])
	
	// Get last proxy attempts for each feature
	const lastDiscoverProxy = useMemo(() => {
		const logs = proxyLogs.filter(log => log.feature === 'discover')
		return logs[logs.length - 1]
	}, [proxyLogs])
	
	const lastRecruitingProxy = useMemo(() => {
		const logs = proxyLogs.filter(log => log.feature === 'recruitment')
		return logs[logs.length - 1]
	}, [proxyLogs])
	
	// Get last search attempts for each feature (legacy JS SDK)
	const lastDiscoverAttempt = useMemo(() => {
		const discoverLogs = recentLogs.filter(log => 
			log.feature === 'discover' && 
			(log.route === 'google.places.textSearch' || log.route === 'google.geocode.forward')
		)
		return discoverLogs[discoverLogs.length - 1]
	}, [recentLogs])
	
	const lastRecruitingAttempt = useMemo(() => {
		const recruitingLogs = recentLogs.filter(log => 
			log.feature === 'recruitment' && 
			(log.route === 'google.places.textSearch' || log.route === 'google.geocode.forward')
		)
		return recruitingLogs[recruitingLogs.length - 1]
	}, [recentLogs])
	
	return (
		<div className="mb-4 p-3 rounded-md border border-purple-500/50 bg-purple-900/20 text-xs space-y-3">
			<div className="font-semibold text-purple-300 uppercase tracking-wide">
				Google Maps/Places Debug Panel
			</div>
			
			{/* Environment Info */}
			<div className="grid grid-cols-3 gap-2 p-2 bg-black/20 rounded">
				<div>
					<span className="text-gray-400">App Instance:</span>
					<span className="ml-2 text-white font-mono">{APP_INSTANCE}</span>
				</div>
				<div>
					<span className="text-gray-400">Hostname:</span>
					<span className="ml-2 text-white font-mono text-[10px]">{window.location.hostname}</span>
				</div>
				<div>
					<span className="text-gray-400">Has API Key:</span>
					<span className={`ml-2 font-semibold ${hasGoogleMapsKey ? 'text-green-400' : 'text-red-400'}`}>
						{hasGoogleMapsKey ? 'Yes' : 'No'}
					</span>
				</div>
			</div>
			
			{/* Proxy Status */}
			<div className="p-2 bg-black/20 rounded space-y-2">
				<div className="font-semibold text-purple-200">Server-Side Proxy Status</div>
				
				{/* Discover Proxy */}
				<div className="p-1 bg-black/20 rounded">
					<div className="text-gray-300 font-semibold text-[10px] uppercase">Discover (via /api/places-search)</div>
					{lastDiscoverProxy ? (
						<div className="space-y-1 mt-1">
							<div className="grid grid-cols-2 gap-1 text-[10px]">
								<div>
									<span className="text-gray-400">Status:</span>
									<span className={`ml-1 font-semibold ${
										lastDiscoverProxy.status === 'ok' ? 'text-green-400' :
										lastDiscoverProxy.status === 'error' ? 'text-red-400' :
										lastDiscoverProxy.status === 'empty' ? 'text-amber-400' :
										'text-gray-400'
									}`}>
										{lastDiscoverProxy.status}
									</span>
								</div>
								<div>
									<span className="text-gray-400">Cached:</span>
									<span className={`ml-1 font-semibold ${lastDiscoverProxy.meta?.cached ? 'text-blue-400' : 'text-gray-400'}`}>
										{lastDiscoverProxy.meta?.cached ? 'Yes' : 'No'}
									</span>
								</div>
								{lastDiscoverProxy.meta?.query != null && (
									<div className="col-span-2">
										<span className="text-gray-400">Query:</span>
										<span className="ml-1 text-white">{renderValue(lastDiscoverProxy.meta.query)}</span>
									</div>
								)}
								{lastDiscoverProxy.meta?.location != null && (
									<div className="col-span-2">
										<span className="text-gray-400">Location:</span>
										<span className="ml-1 text-white text-[9px]">{renderValue(lastDiscoverProxy.meta.location)}</span>
									</div>
								)}
								{lastDiscoverProxy.meta?.radius != null && (
									<div>
										<span className="text-gray-400">Radius:</span>
										<span className="ml-1 text-white">{renderValue(lastDiscoverProxy.meta.radius)}m</span>
									</div>
								)}
								{lastDiscoverProxy.durationMs && (
									<div>
										<span className="text-gray-400">Duration:</span>
										<span className="ml-1 text-white">{lastDiscoverProxy.durationMs}ms</span>
									</div>
								)}
								{lastDiscoverProxy.meta?.count !== undefined && (
									<div>
										<span className="text-gray-400">Results:</span>
										<span className="ml-1 text-white">{renderValue(lastDiscoverProxy.meta.count)}</span>
									</div>
								)}
								{lastDiscoverProxy.meta?.ts != null && (
									<div className="col-span-2">
										<span className="text-gray-400">Timestamp:</span>
										<span className="ml-1 text-white text-[9px]">{renderValue(lastDiscoverProxy.meta.ts)}</span>
									</div>
								)}
							</div>
							{lastDiscoverProxy.status === 'error' && lastDiscoverProxy.meta?.code != null && (
								<div className="mt-1 p-1 bg-red-900/30 border border-red-700/50 rounded text-[10px]">
									<div className="text-red-400 font-semibold">Code: {renderValue(lastDiscoverProxy.meta.code)}</div>
									{lastDiscoverProxy.errorMessage && (
										<div className="text-red-300 mt-1">{lastDiscoverProxy.errorMessage}</div>
									)}
									{lastDiscoverProxy.meta?.devDetails != null && (
										<div className="text-red-300/70 mt-1 font-mono">{renderValue(lastDiscoverProxy.meta.devDetails)}</div>
									)}
								</div>
							)}
						</div>
					) : (
						<div className="text-gray-500 text-[10px] mt-1">No proxy calls yet</div>
					)}
				</div>
				
				{/* Recruiting Proxy */}
				<div className="p-1 bg-black/20 rounded">
					<div className="text-gray-300 font-semibold text-[10px] uppercase">Recruiting (via /api/places-search)</div>
					{lastRecruitingProxy ? (
						<div className="space-y-1 mt-1">
							<div className="grid grid-cols-2 gap-1 text-[10px]">
								<div>
									<span className="text-gray-400">Status:</span>
									<span className={`ml-1 font-semibold ${
										lastRecruitingProxy.status === 'ok' ? 'text-green-400' :
										lastRecruitingProxy.status === 'error' ? 'text-red-400' :
										lastRecruitingProxy.status === 'empty' ? 'text-amber-400' :
										'text-gray-400'
									}`}>
										{lastRecruitingProxy.status}
									</span>
								</div>
								<div>
									<span className="text-gray-400">Cached:</span>
									<span className={`ml-1 font-semibold ${lastRecruitingProxy.meta?.cached ? 'text-blue-400' : 'text-gray-400'}`}>
										{lastRecruitingProxy.meta?.cached ? 'Yes' : 'No'}
									</span>
								</div>
								{lastRecruitingProxy.meta?.query != null && (
									<div className="col-span-2">
										<span className="text-gray-400">Query:</span>
										<span className="ml-1 text-white">{renderValue(lastRecruitingProxy.meta.query)}</span>
									</div>
								)}
								{lastRecruitingProxy.meta?.location != null && (
									<div className="col-span-2">
										<span className="text-gray-400">Location:</span>
										<span className="ml-1 text-white text-[9px]">{renderValue(lastRecruitingProxy.meta.location)}</span>
									</div>
								)}
								{lastRecruitingProxy.meta?.radius != null && (
									<div>
										<span className="text-gray-400">Radius:</span>
										<span className="ml-1 text-white">{renderValue(lastRecruitingProxy.meta.radius)}m</span>
									</div>
								)}
								{lastRecruitingProxy.durationMs && (
									<div>
										<span className="text-gray-400">Duration:</span>
										<span className="ml-1 text-white">{lastRecruitingProxy.durationMs}ms</span>
									</div>
								)}
								{lastRecruitingProxy.meta?.count !== undefined && (
									<div>
										<span className="text-gray-400">Results:</span>
										<span className="ml-1 text-white">{renderValue(lastRecruitingProxy.meta.count)}</span>
									</div>
								)}
								{lastRecruitingProxy.meta?.ts != null && (
									<div className="col-span-2">
										<span className="text-gray-400">Timestamp:</span>
										<span className="ml-1 text-white text-[9px]">{renderValue(lastRecruitingProxy.meta.ts)}</span>
									</div>
								)}
							</div>
							{lastRecruitingProxy.status === 'error' && lastRecruitingProxy.meta?.code != null && (
								<div className="mt-1 p-1 bg-red-900/30 border border-red-700/50 rounded text-[10px]">
									<div className="text-red-400 font-semibold">Code: {renderValue(lastRecruitingProxy.meta.code)}</div>
									{lastRecruitingProxy.errorMessage && (
										<div className="text-red-300 mt-1">{lastRecruitingProxy.errorMessage}</div>
									)}
									{lastRecruitingProxy.meta?.devDetails != null && (
										<div className="text-red-300/70 mt-1 font-mono">{renderValue(lastRecruitingProxy.meta.devDetails)}</div>
									)}
								</div>
							)}
						</div>
					) : (
						<div className="text-gray-500 text-[10px] mt-1">No proxy calls yet</div>
					)}
				</div>
			</div>
			
			{/* Loader State */}
			<div className="p-2 bg-black/20 rounded space-y-1">
				<div className="font-semibold text-purple-200">Loader State</div>
				<div className="grid grid-cols-3 gap-2">
					<div>
						<span className="text-gray-400">Ready:</span>
						<span className={`ml-2 font-semibold ${loaderStatus.ready ? 'text-green-400' : 'text-gray-400'}`}>
							{loaderStatus.ready ? 'Yes' : 'No'}
						</span>
					</div>
					<div>
						<span className="text-gray-400">Loading:</span>
						<span className={`ml-2 font-semibold ${loaderStatus.loading ? 'text-amber-400' : 'text-gray-400'}`}>
							{loaderStatus.loading ? 'Yes' : 'No'}
						</span>
					</div>
					<div>
						<span className="text-gray-400">Error:</span>
						<span className={`ml-2 font-semibold ${loaderStatus.error ? 'text-red-400' : 'text-green-400'}`}>
							{loaderStatus.error ? 'Yes' : 'No'}
						</span>
					</div>
				</div>
				{loaderStatus.lastLoadedAt && (
					<div className="text-[10px] text-gray-400">
						Last loaded: {new Date(loaderStatus.lastLoadedAt).toLocaleString()}
					</div>
				)}
				{loaderStatus.error && (
					<div className="mt-1 p-1 bg-red-900/30 border border-red-700/50 rounded text-red-300 font-mono text-[10px]">
						{loaderStatus.error.message}
					</div>
				)}
			</div>
			
			{/* Last Search Attempts */}
			<div className="p-2 bg-black/20 rounded space-y-2">
				<div className="font-semibold text-purple-200">Last Search Attempts</div>
				
				{/* Discover */}
				<div className="p-1 bg-black/20 rounded">
					<div className="text-gray-300 font-semibold text-[10px] uppercase">Discover</div>
					{lastDiscoverAttempt ? (
						<div className="space-y-1 mt-1">
							<div className="grid grid-cols-2 gap-1 text-[10px]">
								<div>
									<span className="text-gray-400">Route:</span>
									<span className="ml-1 text-white font-mono">{lastDiscoverAttempt.route}</span>
								</div>
								<div>
									<span className="text-gray-400">Status:</span>
									<span className={`ml-1 font-semibold ${
										lastDiscoverAttempt.status === 'ok' ? 'text-green-400' :
										lastDiscoverAttempt.status === 'error' ? 'text-red-400' :
										lastDiscoverAttempt.status === 'empty' ? 'text-amber-400' :
										'text-gray-400'
									}`}>
										{lastDiscoverAttempt.status}
									</span>
								</div>
								{lastDiscoverAttempt.meta?.query != null && (
									<div className="col-span-2">
										<span className="text-gray-400">Query:</span>
										<span className="ml-1 text-white">{renderValue(lastDiscoverAttempt.meta.query)}</span>
									</div>
								)}
								{lastDiscoverAttempt.meta?.googleStatus != null && (
									<div>
										<span className="text-gray-400">Google Status:</span>
										<span className="ml-1 text-purple-300 font-mono">{renderValue(lastDiscoverAttempt.meta.googleStatus)}</span>
									</div>
								)}
								{lastDiscoverAttempt.durationMs && (
									<div>
										<span className="text-gray-400">Duration:</span>
										<span className="ml-1 text-white">{lastDiscoverAttempt.durationMs}ms</span>
									</div>
								)}
							</div>
							{lastDiscoverAttempt.errorMessage && (
								<div className="p-1 bg-red-900/30 border border-red-700/50 rounded text-red-300 font-mono text-[10px]">
									{lastDiscoverAttempt.errorMessage}
								</div>
							)}
						</div>
					) : (
						<div className="text-gray-500 text-[10px] mt-1">No attempts yet</div>
					)}
				</div>
				
				{/* Recruiting */}
				<div className="p-1 bg-black/20 rounded">
					<div className="text-gray-300 font-semibold text-[10px] uppercase">Recruiting</div>
					{lastRecruitingAttempt ? (
						<div className="space-y-1 mt-1">
							<div className="grid grid-cols-2 gap-1 text-[10px]">
								<div>
									<span className="text-gray-400">Route:</span>
									<span className="ml-1 text-white font-mono">{lastRecruitingAttempt.route}</span>
								</div>
								<div>
									<span className="text-gray-400">Status:</span>
									<span className={`ml-1 font-semibold ${
										lastRecruitingAttempt.status === 'ok' ? 'text-green-400' :
										lastRecruitingAttempt.status === 'error' ? 'text-red-400' :
										lastRecruitingAttempt.status === 'empty' ? 'text-amber-400' :
										'text-gray-400'
									}`}>
										{lastRecruitingAttempt.status}
									</span>
								</div>
								{lastRecruitingAttempt.meta?.query != null && (
									<div className="col-span-2">
										<span className="text-gray-400">Query:</span>
										<span className="ml-1 text-white">{renderValue(lastRecruitingAttempt.meta.query)}</span>
									</div>
								)}
								{lastRecruitingAttempt.meta?.googleStatus != null && (
									<div>
										<span className="text-gray-400">Google Status:</span>
										<span className="ml-1 text-purple-300 font-mono">{renderValue(lastRecruitingAttempt.meta.googleStatus)}</span>
									</div>
								)}
								{lastRecruitingAttempt.durationMs && (
									<div>
										<span className="text-gray-400">Duration:</span>
										<span className="ml-1 text-white">{lastRecruitingAttempt.durationMs}ms</span>
									</div>
								)}
							</div>
							{lastRecruitingAttempt.errorMessage && (
								<div className="p-1 bg-red-900/30 border border-red-700/50 rounded text-red-300 font-mono text-[10px]">
									{lastRecruitingAttempt.errorMessage}
								</div>
							)}
						</div>
					) : (
						<div className="text-gray-500 text-[10px] mt-1">No attempts yet</div>
					)}
				</div>
			</div>
			
			{/* Recent Errors */}
			<div className="p-2 bg-black/20 rounded space-y-2">
				<div className="font-semibold text-purple-200">
					Last 5 Errors (Proxy + JS SDK)
					{recentErrors.length > 0 && (
						<span className="ml-2 text-red-400">({recentErrors.length})</span>
					)}
				</div>
				{recentErrors.length > 0 ? (
					<div className="space-y-1">
						{recentErrors.map((error, idx) => (
							<div key={idx} className="p-1 bg-red-900/20 border border-red-700/30 rounded text-[10px]">
								<div className="grid grid-cols-2 gap-1">
									<div>
										<span className="text-gray-400">Route:</span>
										<span className="ml-1 text-white font-mono">{error.route}</span>
									</div>
									<div>
										<span className="text-gray-400">Time:</span>
										<span className="ml-1 text-white">{new Date(error.time).toLocaleTimeString()}</span>
									</div>
									{error.meta?.code != null && (
										<div>
											<span className="text-gray-400">Error Code:</span>
											<span className="ml-1 text-red-300 font-mono font-semibold">{renderValue(error.meta.code)}</span>
										</div>
									)}
									{error.meta?.googleStatus != null && (
										<div>
											<span className="text-gray-400">Google Status:</span>
											<span className="ml-1 text-red-300 font-mono font-semibold">{renderValue(error.meta.googleStatus)}</span>
										</div>
									)}
									{error.meta?.httpStatus != null && (
										<div>
											<span className="text-gray-400">HTTP Status:</span>
											<span className="ml-1 text-red-300 font-semibold">{renderValue(error.meta.httpStatus)}</span>
										</div>
									)}
									{error.meta?.statusCode != null && (
										<div>
											<span className="text-gray-400">Status Code:</span>
											<span className="ml-1 text-red-300 font-semibold">{renderValue(error.meta.statusCode)}</span>
										</div>
									)}
								</div>
								{error.errorMessage && (
									<div className="mt-1 text-red-300">
										{error.errorMessage}
									</div>
								)}
								{error.meta?.devDetails != null && (
									<div className="mt-1 text-red-300/60 font-mono text-[9px]">
										{renderValue(error.meta.devDetails)}
									</div>
								)}
							</div>
						))}
					</div>
				) : (
					<div className="text-gray-500 text-[10px]">No errors yet</div>
				)}
			</div>
		</div>
	)
}
