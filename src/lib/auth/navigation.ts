import { navigate } from '../../routes/RootRouter'
import { signOut } from '../authSupabase'

/**
 * Central auth navigation utilities
 * 
 * These functions provide a single, reliable entrypoint for all login/logout actions
 * across the application, ensuring consistent behavior and proper auth state management.
 */

/**
 * Navigate to login page with optional return path
 * 
 * @param returnTo - Path to return to after successful login (defaults to current path)
 * 
 * @example
 * // From any component
 * goToLogin() // returns to current page after login
 * goToLogin('/app') // returns to /app after login
 */
export function goToLogin(returnTo?: string): void {
	const DEBUG_AUTH = import.meta.env.DEV || window.location.search.includes('debugAuth=1')
	
	// Use current path if not specified
	const effectiveReturnTo = returnTo || window.location.pathname
	
	if (DEBUG_AUTH) {
		console.log('[auth-nav] goToLogin', { returnTo: effectiveReturnTo })
	}
	
	// Always navigate to login with returnTo parameter
	navigate(`/auth/login?returnTo=${encodeURIComponent(effectiveReturnTo)}`)
}

/**
 * Log out and navigate to login page
 * 
 * This function:
 * 1. Signs out from Supabase
 * 2. Clears all auth state from localStorage
 * 3. Navigates to login page (replace mode to prevent back button issues)
 * 
 * @example
 * // From logout button
 * <button onClick={goToLogout}>Log Out</button>
 */
export async function goToLogout(): Promise<void> {
	const DEBUG_AUTH = import.meta.env.DEV || window.location.search.includes('debugAuth=1')
	
	if (DEBUG_AUTH) {
		console.log('[auth-nav] goToLogout start')
	}
	
	try {
		// 1. Sign out from Supabase
		await signOut()
		if (DEBUG_AUTH) {
			console.log('[auth-nav] signOut completed')
		}
	} catch (error) {
		// Log error but continue with cleanup
		console.error('[auth-nav] signOut error:', error)
	}
	
	// 2. Clear any cached auth-related data from localStorage
	try {
		// Clear user-specific profile drafts
		Object.keys(localStorage).forEach(key => {
			if (key.startsWith('athleteProfileDraft:')) {
				localStorage.removeItem(key)
			}
		})
		
		// Clear any Supabase session tokens
		Object.keys(localStorage).forEach(key => {
			if (key.startsWith('sb-') && key.includes('auth-token')) {
				localStorage.removeItem(key)
			}
		})
		
		if (DEBUG_AUTH) {
			console.log('[auth-nav] localStorage cleared')
		}
	} catch (error) {
		// Silently fail if localStorage is unavailable
		console.warn('[auth-nav] localStorage cleanup failed:', error)
	}
	
	// 3. Navigate to login with replace to prevent back button returning to authenticated state
	if (DEBUG_AUTH) {
		console.log('[auth-nav] navigating to /auth/login (replace mode)')
	}
	
	window.location.replace('/auth/login')
}

/**
 * Get current auth state for debugging
 * Internal use only - exposed via debug panel
 */
export function _getAuthDebugInfo() {
	const hasSessionToken = Object.keys(localStorage).some(key => 
		key.startsWith('sb-') && key.includes('auth-token')
	)
	
	return {
		currentPath: window.location.pathname,
		hasSessionToken,
		search: window.location.search,
		timestamp: new Date().toISOString()
	}
}
