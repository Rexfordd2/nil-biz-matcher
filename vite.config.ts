import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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

export default defineConfig({
	base: '/',
	define: {
		// Expose a stable, build-time value for the client
		'import.meta.env.VITE_BUILD_ID': JSON.stringify(__buildId)
	},
	plugins: [
		react(),
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


