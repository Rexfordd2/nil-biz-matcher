/**
 * Lightweight fetch instrumentation for Supabase debugging.
 * Monkey-patches window.fetch ONLY when VITE_DIAGNOSTICS=true.
 * Logs any requests to supabase.co domains (method, URL hostname, response status OR thrown error).
 * Does NOT block anything - logs only.
 */

const ENABLED = import.meta.env.VITE_DIAGNOSTICS === 'true'

if (ENABLED && typeof window !== 'undefined') {
	const originalFetch = window.fetch

	window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
		
		try {
			const urlObj = new URL(url, window.location.origin)
			const hostname = urlObj.hostname
			
			// Only log requests to supabase.co domains
			if (hostname.includes('supabase.co')) {
				const method = init?.method || 'GET'
				
				// Log the request attempt
				console.log('[FETCH_PROBE]', {
					method,
					hostname,
					url: urlObj.href,
					timestamp: new Date().toISOString()
				})
				
				try {
					const response = await originalFetch.call(this, input, init)
					
					// Log successful response
					console.log('[FETCH_PROBE]', {
						method,
						hostname,
						status: response.status,
						statusText: response.statusText,
						url: urlObj.href,
						timestamp: new Date().toISOString()
					})
					
					return response
				} catch (error: any) {
					// Log thrown error
					console.log('[FETCH_PROBE]', {
						method,
						hostname,
						error: {
							name: error?.name,
							message: error?.message,
							stack: error?.stack
						},
						url: urlObj.href,
						timestamp: new Date().toISOString()
					})
					
					throw error
				}
			}
		} catch (urlParseError) {
			// If URL parsing fails, just pass through to original fetch
		}
		
		// For non-supabase.co requests, pass through unchanged
		return originalFetch.call(this, input, init)
	}
	
	console.log('[FETCH_PROBE] Enabled - monitoring supabase.co requests')
}
