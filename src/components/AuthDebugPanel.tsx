import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { _getAuthDebugInfo } from '../lib/auth/navigation'

/**
 * Auth Debug Panel
 * 
 * Only visible when ?debug=1 is in the URL
 * Displays current auth state and recent auth events
 */

type AuthEvent = {
	event: string
	timestamp: string
	hasSession: boolean
	userId?: string
}

export default function AuthDebugPanel() {
	const { user } = useAuth()
	const [debugInfo, setDebugInfo] = useState(_getAuthDebugInfo())
	const [authEvents, setAuthEvents] = useState<AuthEvent[]>([])
	const [isVisible, setIsVisible] = useState(false)

	// Check if debug mode is enabled
	useEffect(() => {
		const params = new URLSearchParams(window.location.search)
		setIsVisible(params.get('debug') === '1')
	}, [])

	// Update debug info on location change
	useEffect(() => {
		function updateDebugInfo() {
			setDebugInfo(_getAuthDebugInfo())
		}
		
		window.addEventListener('popstate', updateDebugInfo)
		const interval = setInterval(updateDebugInfo, 1000)
		
		return () => {
			window.removeEventListener('popstate', updateDebugInfo)
			clearInterval(interval)
		}
	}, [])

	// Listen to auth state changes
	useEffect(() => {
		// Create an auth event when user changes
		const event: AuthEvent = {
			event: user ? 'SIGNED_IN' : 'SIGNED_OUT',
			timestamp: new Date().toISOString(),
			hasSession: Boolean(user),
			userId: user?.id
		}
		
		setAuthEvents(prev => [...prev.slice(-4), event]) // Keep last 5 events
	}, [user])

	if (!isVisible) {
		return null
	}

	return (
		<div 
			className="fixed bottom-4 right-4 z-50 w-80 bg-surface border-2 border-yellow-400 rounded-lg shadow-2xl p-4"
			data-testid="auth-debug-panel"
		>
			<div className="flex items-center justify-between mb-3">
				<h3 className="text-white font-bold text-sm flex items-center gap-2">
					<span className="inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
					Auth Debug
				</h3>
				<button
					onClick={() => setIsVisible(false)}
					className="text-gray-400 hover:text-white text-xs"
					aria-label="Hide debug panel"
				>
					Hide
				</button>
			</div>
			
			<div className="space-y-3 text-xs">
				{/* Current State */}
				<div className="bg-mid rounded-md p-2 space-y-1">
					<div className="text-gray-400 font-semibold">Current State</div>
					<div className="text-white">
						Path: <span className="text-blue-300">{debugInfo.currentPath}</span>
					</div>
					<div className="text-white">
						Session: <span className={user ? 'text-green-300' : 'text-red-300'}>
							{user ? 'Yes' : 'No'}
						</span>
					</div>
					{user && (
						<div className="text-white">
							User ID: <span className="text-blue-300 text-[10px] font-mono">
								{user.id.substring(0, 8)}...
							</span>
						</div>
					)}
					<div className="text-white">
						Token: <span className={debugInfo.hasSessionToken ? 'text-green-300' : 'text-red-300'}>
							{debugInfo.hasSessionToken ? 'Present' : 'Missing'}
						</span>
					</div>
				</div>

				{/* Auth Events */}
				<div className="bg-mid rounded-md p-2">
					<div className="text-gray-400 font-semibold mb-2">Recent Auth Events</div>
					{authEvents.length === 0 ? (
						<div className="text-gray-500 text-[10px]">No events yet</div>
					) : (
						<div className="space-y-1 max-h-32 overflow-y-auto">
							{authEvents.slice().reverse().map((event, idx) => (
								<div key={idx} className="text-[10px] border-l-2 border-gray-600 pl-2 py-1">
									<div className="text-white font-semibold">{event.event}</div>
									<div className="text-gray-400">
										{new Date(event.timestamp).toLocaleTimeString()}
									</div>
									{event.userId && (
										<div className="text-blue-300 font-mono">
											{event.userId.substring(0, 8)}...
										</div>
									)}
								</div>
							))}
						</div>
					)}
				</div>

				{/* Actions */}
				<div className="flex gap-2 text-[10px]">
					<button
						onClick={() => setAuthEvents([])}
						className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded"
					>
						Clear Events
					</button>
					<button
						onClick={() => window.location.reload()}
						className="flex-1 bg-blue-700 hover:bg-blue-600 text-white px-2 py-1 rounded"
					>
						Reload Page
					</button>
				</div>
			</div>
		</div>
	)
}
