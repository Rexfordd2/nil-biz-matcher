import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

// Minimal wrapper to adapt Node's ServerResponse to a Vercel-like response
function wrapRes(res: any) {
	const r: any = res
	r.status = (code: number) => {
		res.statusCode = code
		return r
	}
	r.json = (obj: any) => {
		if (!res.headersSent) {
			res.setHeader('Content-Type', 'application/json')
		}
		res.end(JSON.stringify(obj))
	}
	r.send = (data: any) => {
		if (typeof data === 'object' && data !== null && !Buffer.isBuffer(data)) {
			if (!res.headersSent) {
				res.setHeader('Content-Type', 'application/json')
			}
			res.end(JSON.stringify(data))
		} else {
			res.end(String(data))
		}
	}
	return r
}

// Compute a build identifier at build time:
// - Prefer VITE_BUILD_ID if provided (from Vercel env or local)
// - Else use VERCEL_GIT_COMMIT_SHA when building on Vercel
// - Else fallback to ISO timestamp
const __rawBuildId = (process.env.VITE_BUILD_ID || process.env.VERCEL_GIT_COMMIT_SHA || new Date().toISOString())
// If it looks like a git SHA, shorten to 7 characters
const __buildId = /^[a-f0-9]{7,40}$/i.test(__rawBuildId) ? __rawBuildId.slice(0, 7) : __rawBuildId

/**
 * Build-time plugin to assert debug routes are protected in production.
 * Fails the build if debug routes would be exposed without proper guards.
 * 
 * Note: This check ensures that production builds require explicit opt-in
 * for debug access via VITE_DIAGNOSTICS or VITE_DEBUG_KEY.
 * Runtime protection in RootRouter.tsx provides the actual access control.
 */
function debugRoutesProtectionPlugin(): Plugin {
	return {
		name: 'debug-routes-protection',
		buildStart() {
			// Only check in production builds (not dev mode or preview)
			// Skip check if explicitly in dev mode
			const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV
			if (isDev) {
				return
			}

			// Check if this is a production build
			const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
			if (!isProduction) {
				return
			}

			const diagnosticsEnabled = String(process.env.VITE_DIAGNOSTICS || '').toLowerCase() === 'true'
			const hasDebugKey = Boolean(process.env.VITE_DEBUG_KEY && process.env.VITE_DEBUG_KEY.trim().length > 0)

			// Production builds require explicit opt-in for debug access:
			// - If VITE_DIAGNOSTICS=true → allow build (full diagnostics enabled)
			// - Else if VITE_DEBUG_KEY is set (non-empty) → allow build (debug key protection)
			// - Else → fail build (no protection configured)
			if (!diagnosticsEnabled && !hasDebugKey) {
				this.error(
					'[SECURITY] Debug routes must be protected in production builds.\n' +
					'To enable debug access in production, set one of:\n' +
					'  - VITE_DIAGNOSTICS=true (enables all debug routes)\n' +
					'  - VITE_DEBUG_KEY=<secret> (enables access via ?debugKey=<secret> query param)\n' +
					'\n' +
					'Current env: NODE_ENV=' + (process.env.NODE_ENV || 'undefined') + 
					', VITE_DIAGNOSTICS=' + (process.env.VITE_DIAGNOSTICS || 'not set') + 
					', VITE_DEBUG_KEY=' + (hasDebugKey ? '***set***' : 'not set') +
					'\n' +
					'Note: Runtime protection in RootRouter.tsx will enforce access control.'
				)
			}
		}
	}
}

export default defineConfig({
	base: '/',
	define: {
		// Expose a stable, build-time value for the client via a global constant
		__BUILD_ID__: JSON.stringify(__buildId)
	},
	plugins: [
		react(),
		debugRoutesProtectionPlugin(),
		{
			name: 'inject-build-id-html',
			transformIndexHtml(html) {
				// Preserve OG/Twitter meta tags if they exist, inject build ID
				let result = html.replace(
					'<div id="root">',
					`<div id="root"><div data-testid="build-id" style="display:none">${__buildId}</div>`
				)
				// Ensure OG tags are preserved (Vite may strip them, so re-add if missing)
				if (!result.includes('og:title')) {
					// If OG tags are missing, inject them before closing </head>
					const ogTags = `
		<!-- Open Graph / Facebook -->
		<meta property="og:type" content="website" />
		<meta property="og:url" content="https://athlete-ledger.vercel.app/" />
		<meta property="og:title" content="Athlete Ledger - Connect with College Coaches" />
		<meta property="og:description" content="The platform for athletes to discover and connect with college coaches. Showcase your profile and find your perfect match." />
		<meta property="og:image" content="https://athlete-ledger.vercel.app/athlete-ledger-logo.png" />
		
		<!-- Twitter -->
		<meta name="twitter:card" content="summary_large_image" />
		<meta name="twitter:url" content="https://athlete-ledger.vercel.app/" />
		<meta name="twitter:title" content="Athlete Ledger - Connect with College Coaches" />
		<meta name="twitter:description" content="The platform for athletes to discover and connect with college coaches. Showcase your profile and find your perfect match." />
		<meta name="twitter:image" content="https://athlete-ledger.vercel.app/athlete-ledger-logo.png" />`
					result = result.replace('</head>', `${ogTags}\n\t</head>`)
				}
				return result
			}
		},
		{
			name: 'local-api-middleware',
			configureServer(server) {
				server.middlewares.use(async (req, res, next) => {
					try {
						const urlStr = req.url || '/'
						if (!urlStr.startsWith('/api/')) return next()
						const url = new URL(urlStr, 'http://localhost')
						const pathname = url.pathname // e.g. /api/auth/me
						// Map /api/foo/bar -> /api/foo/bar.ts
						const modulePath = `${pathname}.ts`
						// Load the API handler using Vite's module loader (TS supported)
						const mod = await (server as any).ssrLoadModule(modulePath).catch(() => null)
						const handler = mod?.default
						if (typeof handler !== 'function') {
							// Dev fallback for key routes when serverless runtime isn't available
							if (pathname === '/api/recruiting/send') {
								const resLike = wrapRes(res)
								resLike.status(503).json({ error: 'Email not configured' })
								return
							}
							return next()
						}

						// Augment the request with query/body like VercelRequest
						;(req as any).query = Object.fromEntries(url.searchParams.entries())

						// If body is expected, read and parse it before invoking handler
						if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
							let raw = ''
							req.on('data', (chunk: any) => {
								raw += chunk
							})
							req.on('end', async () => {
								try {
									;(req as any).body = raw ? JSON.parse(raw) : undefined
								} catch {
									;(req as any).body = undefined
								}
								const resLike = wrapRes(res)
								try {
									await handler(req as any, resLike)
								} catch {
									// Fall through to next on error to not break dev
									return next()
								}
								if (!res.writableEnded) res.end()
							})
							return
						}

						const resLike = wrapRes(res)
						try {
							await handler(req as any, resLike)
						} catch {
							return next()
						}
						if (!res.writableEnded) res.end()
					} catch {
						return next()
					}
				})
			}
		}
	],
	server: {
		port: 5173,
		// Disable proxy for /api during local development; handled by middleware above
		proxy: {}
	}
})


