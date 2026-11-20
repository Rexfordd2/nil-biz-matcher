// One origin for the acceptance run, like the Vercel deployment plus Supabase:
//   /auth/v1/*  -> local Supabase Auth      /rest/v1/* -> local PostgREST
//   /api/*      -> compiled API handlers    everything else -> built SPA
// SMTP_HOST/SMTP_PORT point at a sink here that records every connection, so
// any attempt to send mail is observable and nothing leaves the machine.
import { createReadStream, existsSync, statSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import { extname, join, normalize } from 'node:path'
import { pathToFileURL } from 'node:url'

const { APP_PORT, AUTH_PORT, REST_PORT, DIST, API_OUT, SINK_LOG, SMTP_PORT } = process.env
const sinks = { smtpConnections: 0, apiCalls: [] }
const flush = () => writeFileSync(SINK_LOG, JSON.stringify(sinks, null, 2))
flush()

net.createServer(socket => {
	sinks.smtpConnections += 1
	flush()
	socket.destroy()
}).listen(Number(SMTP_PORT), '127.0.0.1')

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' }

function proxy(req, res, port, prefix) {
	const upstream = http.request(
		{ host: '127.0.0.1', port: Number(port), method: req.method, path: req.url.slice(prefix.length) || '/', headers: { ...req.headers, host: `127.0.0.1:${port}` } },
		up => {
			res.writeHead(up.statusCode, up.headers)
			up.pipe(res)
		},
	)
	upstream.on('error', () => { res.writeHead(502); res.end() })
	req.pipe(upstream)
}

async function readBody(req) {
	const chunks = []
	for await (const c of req) chunks.push(c)
	const raw = Buffer.concat(chunks).toString('utf8')
	if (!raw) return undefined
	if ((req.headers['content-type'] || '').includes('application/json')) {
		try { return JSON.parse(raw) } catch { return raw }
	}
	return raw
}

async function api(req, res, url) {
	const file = join(API_OUT, normalize(url.pathname).replace(/^\/+/, '') + '.js')
	if (!file.startsWith(join(API_OUT, 'api')) || !existsSync(file)) {
		res.writeHead(404, { 'content-type': 'application/json' })
		return res.end('{"error":"Not found"}')
	}
	const mod = await import(pathToFileURL(file).href)
	req.query = Object.fromEntries(url.searchParams)
	req.body = await readBody(req)
	req.cookies = Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(c => c.trim().split('=')))
	res.status = code => { res.statusCode = code; return res }
	res.json = body => {
		if (!res.getHeader('content-type')) res.setHeader('content-type', 'application/json')
		res.end(JSON.stringify(body))
		return res
	}
	res.send = body => {
		if (typeof body === 'object' && !Buffer.isBuffer(body)) return res.json(body)
		res.end(body)
		return res
	}
	res.redirect = (a, b) => {
		const [code, location] = typeof a === 'number' ? [a, b] : [307, a]
		res.writeHead(code, { location })
		res.end()
		return res
	}
	const record = { method: req.method, path: url.pathname }
	sinks.apiCalls.push(record)
	try {
		await mod.default(req, res)
	} catch (error) {
		record.threw = String(error?.message || error)
		if (!res.headersSent) { res.statusCode = 500; res.end('{"error":"Internal error"}') }
	}
	record.status = res.statusCode
	record.location = res.getHeader('location') ?? null
	flush()
}

function file(req, res, url) {
	let path = join(DIST, normalize(decodeURIComponent(url.pathname)))
	if (!path.startsWith(DIST) || !existsSync(path) || statSync(path).isDirectory()) path = join(DIST, 'index.html')
	res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' })
	createReadStream(path).pipe(res)
}

http.createServer((req, res) => {
	const url = new URL(req.url, `http://127.0.0.1:${APP_PORT}`)
	if (url.pathname.startsWith('/auth/v1')) return proxy(req, res, AUTH_PORT, '/auth/v1')
	if (url.pathname.startsWith('/rest/v1')) return proxy(req, res, REST_PORT, '/rest/v1')
	if (url.pathname.startsWith('/api/')) return void api(req, res, url)
	return file(req, res, url)
}).listen(Number(APP_PORT), '127.0.0.1')
