import { useEffect, useState, useRef } from 'react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Card from '../ui/Card'
import type { CurrentUser } from '../../utils/auth'
import { supabase } from '../../lib/supabaseClient'
import { friendlyAuthErrorMessage } from '../../lib/supabaseErrors'
import { navigate } from '../../routes/RootRouter'
import { isBetaMode } from '../../config/appMode'
import '../../lib/fetchProbe' // Initialize fetch probe if VITE_DIAGNOSTICS=true

type Props = {
	onLoggedIn: (user: CurrentUser) => void
	onNeedAccount?: () => void
}

export default function LoginSupabase({ onLoggedIn, onNeedAccount }: Props) {
	if (!supabase) {
		return (
			<div className="max-w-md mx-auto">
				<Card title="Cloud login unavailable">
					<div className="text-sm text-gray-300" data-testid="auth-unavailable">
						Supabase is not configured. Configure <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to enable cloud login.
					</div>
				</Card>
			</div>
		)
	}
	const sb = supabase!
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [err, setErr] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [sendingReset, setSendingReset] = useState(false)
	const [resetInfo, setResetInfo] = useState<string | null>(null)
	const [passwordUpdatedNotice, setPasswordUpdatedNotice] = useState(false)
	const [slow, setSlow] = useState(false)
	const [submitCapturedCount, setSubmitCapturedCount] = useState(0)
	const [clickCapturedCount, setClickCapturedCount] = useState(0)
	const [nativeSubmitCount, setNativeSubmitCount] = useState(0)
	const [handleSubmitCount, setHandleSubmitCount] = useState(0)
	const [submitStartCount, setSubmitStartCount] = useState(0)
	const [captureDefaultPrevented, setCaptureDefaultPrevented] = useState(false)
	const [capturePreventedByUs, setCapturePreventedByUs] = useState(false)
	const [captureEventPhase, setCaptureEventPhase] = useState(0)
	const [bridgeFiredCount, setBridgeFiredCount] = useState(0)
	const handleSubmitCountRef = useRef(0)
	const DEBUG_AUTH = import.meta.env.DEV || window.location.search.includes('debugAuth=1')
	const FORCE_SUBMIT_BRIDGE = String(import.meta.env.VITE_FORCE_SUBMIT_BRIDGE || '').toLowerCase() === 'true'
	const SHOW_DEBUG_OVERLAY = import.meta.env.DEV || import.meta.env.VITE_DIAGNOSTICS === 'true'
	const DIAG = String(import.meta.env.VITE_DIAGNOSTICS || '').toLowerCase()
	
	// Debug state - initialize with current values
	const getInitialDebugInfo = () => {
		const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
		let supabaseOrigin = 'not configured'
		if (supabaseUrl) {
			try {
				const url = new URL(supabaseUrl)
				supabaseOrigin = url.origin
			} catch {
				supabaseOrigin = 'invalid URL'
			}
		}
		return {
			online: navigator.onLine,
			locationOrigin: window.location.origin,
			supabaseOrigin,
			lastAuthError: null as string | null
		}
	}
	const [debugInfo, setDebugInfo] = useState<{
		online: boolean
		locationOrigin: string
		supabaseOrigin: string
		lastAuthError: string | null
	}>(getInitialDebugInfo())
	
	// Keep ref in sync with state
	useEffect(() => {
		handleSubmitCountRef.current = handleSubmitCount
	}, [handleSubmitCount])

	useEffect(() => {
		if (!loading) {
			setSlow(false)
			return
		}
		const t = window.setTimeout(() => setSlow(true), 8000)
		return () => window.clearTimeout(t)
	}, [loading])

	useEffect(() => {
		const sp = new URLSearchParams(window.location.search)
		if (sp.get('passwordUpdated') === '1') {
			setPasswordUpdatedNotice(true)
			sp.delete('passwordUpdated')
			const next = `${window.location.pathname}${sp.toString() ? `?${sp.toString()}` : ''}${window.location.hash}`
			window.history.replaceState({}, '', next)
		}
	}, [])

	// Update online status when it changes
	useEffect(() => {
		if (!SHOW_DEBUG_OVERLAY) return
		
		const handleOnline = () => setDebugInfo(prev => ({ ...prev, online: true }))
		const handleOffline = () => setDebugInfo(prev => ({ ...prev, online: false }))
		
		window.addEventListener('online', handleOnline)
		window.addEventListener('offline', handleOffline)
		
		return () => {
			window.removeEventListener('online', handleOnline)
			window.removeEventListener('offline', handleOffline)
		}
	}, [SHOW_DEBUG_OVERLAY])

	// Native DOM submit listener (tripwire)
	useEffect(() => {
		;(window as any).__nativeSubmitCount = 0
		const handler = () => {
			const count = ((window as any).__nativeSubmitCount || 0) + 1
			;(window as any).__nativeSubmitCount = count
			setNativeSubmitCount(count)
		}
		document.addEventListener('submit', handler, true)
		return () => document.removeEventListener('submit', handler, true)
	}, [])

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		setSubmitStartCount(c => c + 1)
		setHandleSubmitCount(c => {
			const newCount = c + 1
			handleSubmitCountRef.current = newCount
			return newCount
		})
		setIsSubmitting(true)
		setLoading(true)
		setErr(null)
		
		// Capture debug info before login attempt
		const online = navigator.onLine
		const locationOrigin = window.location.origin
		const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
		let supabaseOrigin = 'not configured'
		if (supabaseUrl) {
			try {
				const url = new URL(supabaseUrl)
				supabaseOrigin = url.origin
			} catch {
				supabaseOrigin = 'invalid URL'
			}
		}
		
		try {
			if (DEBUG_AUTH) console.log('[login] submit', { email })
			
			// Use signInWithPassword directly to ensure password authentication (not OTP)
			let rawError: any = null
			let signInResult: { data: any; error: any } | null = null
			
			try {
				const result = await sb.auth.signInWithPassword({ email, password })
				signInResult = { data: result.data.user, error: result.error }
			} catch (signInError: any) {
				// Capture raw error details
				rawError = {
					name: signInError?.name,
					message: signInError?.message,
					status: signInError?.status,
					__isAuthError: (signInError as any)?.__isAuthError,
					code: (signInError as any)?.code,
					stack: signInError?.stack
				}
				
				// Update debug info with error
				if (SHOW_DEBUG_OVERLAY) {
					setDebugInfo({
						online,
						locationOrigin,
						supabaseOrigin,
						lastAuthError: JSON.stringify(rawError, null, 2)
					})
				}
				
				// Re-throw to be caught by outer catch
				throw signInError
			}
			
			const { data: u, error } = signInResult
			if (error) {
				// Capture error details from Supabase response
				const errorDetails = {
					name: 'SupabaseAuthError',
					message: error.message,
					status: error.status,
					code: error.code,
					__isAuthError: true
				}
				
				if (SHOW_DEBUG_OVERLAY) {
					setDebugInfo({
						online,
						locationOrigin,
						supabaseOrigin,
						lastAuthError: JSON.stringify(errorDetails, null, 2)
					})
				}
				
				if (DEBUG_AUTH) console.log('[login] error', error)
				setErr(friendlyAuthErrorMessage(error, { context: 'login' }))
				return
			}
			
			// Clear debug error on success
			if (SHOW_DEBUG_OVERLAY) {
				setDebugInfo({
					online,
					locationOrigin,
					supabaseOrigin,
					lastAuthError: null
				})
			}
			
			if (!u) {
				setErr('Unable to load user after login')
				return
			}
			const current: CurrentUser = {
				id: u.id,
				email: u.email || email,
				fullName: (u.user_metadata?.full_name as string) || u.email || 'User',
				role: (u.user_metadata?.role as string) || 'athlete',
				marketingConsent: Boolean(u.user_metadata?.marketingConsent),
				workflowCloudPersistenceCanary: u.app_metadata?.workflow_cloud_persistence_canary === true,
			}
			if (DEBUG_AUTH) console.log('[login] success', { userId: current.id })
			try {
				onLoggedIn(current)
			} catch (cbErr) {
				// eslint-disable-next-line no-console
				console.warn('[login] onLoggedIn error', cbErr)
			}
			// Redirect immediately after success
			const url = new URL(window.location.href)
			const returnTo = url.searchParams.get('returnTo')
			navigate(returnTo || '/app', true)
		} catch (e: any) {
			// Capture exception details
			const exceptionDetails = {
				name: e?.name,
				message: e?.message,
				status: e?.status,
				__isAuthError: (e as any)?.__isAuthError,
				code: (e as any)?.code,
				stack: e?.stack
			}
			
			if (SHOW_DEBUG_OVERLAY) {
				setDebugInfo({
					online,
					locationOrigin,
					supabaseOrigin,
					lastAuthError: JSON.stringify(exceptionDetails, null, 2)
				})
			}
			
			if (DEBUG_AUTH) console.log('[login] exception', e)
			setErr(friendlyAuthErrorMessage(e, { context: 'login' }) || 'We could not sign you in. Please try again.')
		} finally {
			setLoading(false)
			setIsSubmitting(false)
		}
	}

	async function handleForgotPassword() {
		if (!email) {
			setErr('Enter your email to reset password')
			setResetInfo(null)
			return
		}
		setErr(null)
		setResetInfo(null)
		setSendingReset(true)
		try {
			const { error } = await sb.auth.resetPasswordForEmail(email, {
				redirectTo: `${window.location.origin}/auth/reset`,
			})
			if (error) {
				setErr(friendlyAuthErrorMessage(error, { context: 'reset' }))
				return
			}
			// Neutral copy — do not reveal whether the account exists.
			setResetInfo('If an account exists for that email, a password reset link has been sent.')
		} catch (e: any) {
			setErr(friendlyAuthErrorMessage(e, { context: 'reset' }) || 'We could not send a reset email. Please try again.')
		} finally {
			setSendingReset(false)
		}
	}

	return (
		<div className="max-w-md mx-auto">
			<Card title="Log in to NIL Roster">
				{isBetaMode() && (
					<p className="text-sm text-gray-300 mb-4" data-testid="login-beta-message">
						Existing beta members can sign in below.
					</p>
				)}
				{passwordUpdatedNotice && (
					<p className="text-sm text-green-300 mb-4" data-testid="password-updated-notice">
						Password updated. Sign in with your new password.
					</p>
				)}
				<form 
					data-testid="login-form" 
					className="space-y-4" 
					onSubmit={handleSubmit}
					onSubmitCapture={(e) => {
						setSubmitCapturedCount(c => c + 1)
						setCaptureDefaultPrevented(e.defaultPrevented)
						setCaptureEventPhase(e.eventPhase)
						setCapturePreventedByUs(false)
						
						// Check if nativeEvent.defaultPrevented exists (marker for debugging)
						const nativeEvent = (e as any).nativeEvent
						if (nativeEvent && typeof nativeEvent.defaultPrevented !== 'undefined') {
							// Marker exists, can be logged if needed
						}
						
						// Bridge: if handleSubmit isn't firing, call it directly
						if (FORCE_SUBMIT_BRIDGE && handleSubmitCountRef.current === 0 && !e.defaultPrevented) {
							setBridgeFiredCount(c => c + 1)
							handleSubmit(e as any)
						}
					}}
					onClickCapture={() => setClickCapturedCount(c => c + 1)}
				>
					<div data-testid="diag-compiled" style={{ position: 'absolute', left: -9999 }}>
						{DIAG}
					</div>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Email</span>
						<Input
							data-testid="login-email"
							type="email"
							value={email}
							onChange={e => setEmail(e.target.value)}
							placeholder="you@example.com"
						/>
					</label>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Password</span>
						<Input
							data-testid="login-password"
							type="password"
							value={password}
							onChange={e => setPassword(e.target.value)}
							placeholder="••••••••"
						/>
					</label>
					<div data-testid="login-status" aria-live="polite" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
						{isSubmitting ? 'submitting' : 'idle'}
					</div>
					<div data-testid="login-submit-captured" aria-live="polite" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
						{submitCapturedCount}
					</div>
					<div data-testid="login-click-captured" aria-live="polite" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
						{clickCapturedCount}
					</div>
					<div data-testid="login-native-submit-count" aria-live="polite" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
						{nativeSubmitCount}
					</div>
					<div data-testid="login-handle-submit-count" aria-live="polite" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
						{handleSubmitCount}
					</div>
					<div data-testid="login-submit-start-count" style={{ position: 'absolute', left: '-9999px' }}>
						{submitStartCount}
					</div>
					<div data-testid="login-capture-default-prevented" aria-live="polite" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
						{captureDefaultPrevented ? 'true' : 'false'}
					</div>
					<div data-testid="login-capture-event-phase" aria-live="polite" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
						{captureEventPhase}
					</div>
					<div data-testid="login-bridge-fired-count" aria-live="polite" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
						{bridgeFiredCount}
					</div>
					<div data-testid="login-error" aria-live="polite" className="text-red-400 text-sm">
						{err ?? ''}
					</div>
					{resetInfo && (
						<div data-testid="login-reset-info" aria-live="polite" className="text-green-300 text-sm">
							{resetInfo}
						</div>
					)}
					{slow && !err && <div className="text-amber-300 text-xs">Login is taking longer than expected. Refresh and try again.</div>}
					<div className="flex items-center justify-between">
						<Button 
							data-testid="login-submit" 
							data-testid-loading={loading ? 'true' : 'false'} 
							className="red-glow" 
							type="submit" 
							disabled={isSubmitting || sendingReset}
							onClick={() => setClickCapturedCount(c => c + 1)}
						>
							{loading ? <span data-testid="login-loading">Logging in…</span> : 'Log in'}
						</Button>
					</div>
					<div className="flex items-center justify-between">
						<button
							type="button"
							onClick={handleForgotPassword}
							className="text-xs text-gray-300 underline hover:text-white"
							data-testid="login-forgot-password"
							disabled={sendingReset || isSubmitting}
						>
							{sendingReset ? 'Sending reset…' : 'Forgot password?'}
						</button>
						{onNeedAccount && (
							<button type="button" onClick={onNeedAccount} className="text-xs text-gray-300 underline hover:text-white">
								Need an account?
							</button>
						)}
					</div>
				</form>
				<div className="text-xs text-gray-400 mt-3 space-y-2">
					<p>
						By using NIL Roster, you agree to our <a href="/terms" className="underline">Terms</a>.
					</p>
					<div className="flex items-center justify-center gap-3 pt-1">
						<a
							href="https://athletehouze.com"
							target="_blank"
							rel="noreferrer"
							className="underline hover:text-white"
							data-testid="login-athlete-houze"
						>
							Athlete Houze
						</a>
						<span className="text-gray-600">•</span>
						<button
							type="button"
							onClick={() => navigate('/demo')}
							className="underline hover:text-white"
							data-testid="login-nil-roster-demo"
						>
							NIL Roster demo
						</button>
					</div>
				</div>
			</Card>
			{SHOW_DEBUG_OVERLAY && (
				<Card title="Auth Debug Overlay" className="mt-4">
					<div className="space-y-2 text-xs font-mono">
						<div>
							<span className="text-gray-400">ONLINE:</span>{' '}
							<span className={debugInfo.online ? 'text-green-400' : 'text-red-400'}>
								{String(debugInfo.online)}
							</span>
						</div>
						<div>
							<span className="text-gray-400">LOCATION_ORIGIN:</span>{' '}
							<span className="text-gray-300">{debugInfo.locationOrigin}</span>
						</div>
						<div>
							<span className="text-gray-400">SUPABASE_ORIGIN:</span>{' '}
							<span className="text-gray-300">{debugInfo.supabaseOrigin}</span>
						</div>
						<div>
							<span className="text-gray-400">LAST_AUTH_ERROR:</span>
							{debugInfo.lastAuthError ? (
								<pre className="mt-1 p-2 bg-gray-900 rounded text-red-300 overflow-auto max-h-48">
									{debugInfo.lastAuthError}
								</pre>
							) : (
								<span className="text-green-400 ml-2">none</span>
							)}
						</div>
					</div>
				</Card>
			)}
		</div>
	)
}


