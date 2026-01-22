// Dev-only network guard for /demo route
// Logs all fetch/XHR requests to ensure demo makes no protected API calls
// Only blocks same-origin requests to /api/* or /auth/*, never blocks cross-origin requests (e.g., Supabase)

const isDev = import.meta.env.DEV

/**
 * Check if a URL is a same-origin protected endpoint that should be blocked
 * Returns true only if:
 * - Request is same-origin (same origin as current page)
 * - Pathname starts with /api/ or /auth/
 * Never blocks cross-origin requests (e.g., Supabase auth endpoints)
 */
function isSameOriginProtected(urlString: string): boolean {
	try {
		const u = new URL(urlString, window.location.origin)
		const isSameOrigin = u.origin === window.location.origin
		
		if (!isSameOrigin) {
			// Cross-origin request - always allow (e.g., Supabase)
			if (isDev) {
				console.log('[demo-guard] allow cross-origin', u.origin)
			}
			return false
		}
		
		// Same-origin: check if pathname matches protected patterns
		const isProtected = u.pathname.startsWith('/api/') || u.pathname.startsWith('/auth/')
		return isProtected
	} catch (e) {
		// Invalid URL or relative URL that can't be parsed - allow it
		// (relative URLs without leading / are typically same-origin and will be resolved by browser)
		return false
	}
}

export function installDemoNetworkGuard() {
	if (!isDev) return

	const originalFetch = window.fetch
	const originalXHROpen = XMLHttpRequest.prototype.open
	const originalXHRSend = XMLHttpRequest.prototype.send

	const logRequest = (url: string, method: string, type: 'fetch' | 'xhr') => {
		const isProtected = isSameOriginProtected(url)
		const logLevel = isProtected ? 'error' : 'log'
		const prefix = isProtected ? '🚫 PROTECTED CALL' : '📡'
		
		console[logLevel](`[demo-network-guard] ${prefix} ${type.toUpperCase()} ${method} ${url}`)
		
		if (isProtected) {
			console.warn('[demo-guard] blocked same-origin request', url)
			console.error('[demo-network-guard] Demo should not call protected endpoints!')
		}
	}

	// Intercept fetch
	window.fetch = function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
		const method = init?.method || 'GET'
		logRequest(url, method, 'fetch')
		return originalFetch.apply(this, arguments as any)
	}

	// Intercept XMLHttpRequest
	let xhrUrl = ''
	let xhrMethod = 'GET'
	
	XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...rest: any[]) {
		xhrUrl = typeof url === 'string' ? url : url.href
		xhrMethod = method
		return originalXHROpen.apply(this, [method, url, ...rest] as any)
	}

	XMLHttpRequest.prototype.send = function(...args: any[]) {
		logRequest(xhrUrl, xhrMethod, 'xhr')
		return originalXHRSend.apply(this, args.length > 0 ? [args[0]] : [])
	}

	return () => {
		// Cleanup function
		window.fetch = originalFetch
		XMLHttpRequest.prototype.open = originalXHROpen
		XMLHttpRequest.prototype.send = originalXHRSend
	}
}

// Production runtime assertion: prevent demo from calling protected endpoints
// Only blocks same-origin requests, never blocks cross-origin requests (e.g., Supabase)
export function assertDemoSafe(url: string, method: string = 'GET'): void {
	if (isDev) return // Only enforce in production
	
	const isProtected = isSameOriginProtected(url)
	if (isProtected) {
		const error = new Error(`Demo mode cannot call protected endpoint: ${method} ${url}`)
		console.error('[demo-assertion]', error)
		console.warn('[demo-guard] blocked same-origin request', url)
		throw error
	}
}
