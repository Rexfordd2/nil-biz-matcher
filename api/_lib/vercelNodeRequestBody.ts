import type { IncomingMessage } from 'node:http'
import { PassThrough } from 'node:stream'

/**
 * Maximum accepted recruiting-receiver body.
 * Enforced while reading original bytes, before JSON.parse or req.body.
 */
export const NIL_RECRUITING_RECEIVER_MAX_BODY_BYTES = 65_536

export class RequestBodyError extends Error {
	readonly code: 'raw_body_unavailable' | 'payload_too_large'

	constructor(code: 'raw_body_unavailable' | 'payload_too_large') {
		super(code)
		this.name = 'RequestBodyError'
		this.code = code
	}
}

/**
 * Replay the original bytes on `data`/`end`, matching `@vercel/node`
 * `restoreBody` (dev-server addHelpers). `req.on('data')` is rebound to that
 * buffer so a handler can read the signed bytes after helpers run.
 */
export function restoreVercelRequestBody(req: IncomingMessage, body: Buffer): void {
	const replicateBody = new PassThrough()
	const on = replicateBody.on.bind(replicateBody)
	const originalOn = req.on.bind(req)
	req.read = replicateBody.read.bind(replicateBody) as IncomingMessage['read']
	const rebound = ((name: string, listener: (...args: unknown[]) => void) =>
		name === 'data' || name === 'end' ? on(name, listener) : originalOn(name, listener)) as IncomingMessage['on']
	req.on = rebound
	req.addListener = rebound
	replicateBody.write(body)
	replicateBody.end()
}

/**
 * Lazy parsed body, matching `@vercel/node` `setLazyProp(req, 'body', ...)`.
 * The getter does not run until `req.body` is touched, and it parses the
 * already captured buffer rather than re-reading the stream.
 */
export function installLazyParsedBody(
	req: IncomingMessage,
	raw: Buffer,
	contentType: string | string[] | undefined
): void {
	const header = Array.isArray(contentType) ? contentType[0] : contentType
	const parse = () => {
		const type = (header || '').split(';')[0]?.trim().toLowerCase()
		if (type !== 'application/json' || raw.length === 0) return undefined
		try {
			return JSON.parse(raw.toString('utf8')) as unknown
		} catch {
			return undefined
		}
	}
	Object.defineProperty(req, 'body', {
		configurable: true,
		enumerable: true,
		get() {
			const value = parse()
			Object.defineProperty(req, 'body', {
				configurable: true,
				enumerable: true,
				writable: true,
				value,
			})
			return value
		},
		set(value: unknown) {
			Object.defineProperty(req, 'body', {
				configurable: true,
				enumerable: true,
				writable: true,
				value,
			})
		},
	})
}

function bodyAlreadyMaterialized(req: IncomingMessage): boolean {
	const descriptor = Object.getOwnPropertyDescriptor(req, 'body')
	return Boolean(descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value'))
}

/**
 * Read the original request bytes from the restored Vercel stream.
 * Call this before any access to `req.body`. A materialized `req.body` is
 * refused so signed bytes are never rebuilt with JSON.stringify.
 */
export function readOriginalRequestBytes(
	req: IncomingMessage,
	maxBytes = NIL_RECRUITING_RECEIVER_MAX_BODY_BYTES
): Promise<Buffer> {
	if (bodyAlreadyMaterialized(req)) {
		return Promise.reject(new RequestBodyError('raw_body_unavailable'))
	}
	const declared = req.headers['content-length']
	const declaredLength = Array.isArray(declared) ? declared[0] : declared
	if (declaredLength !== undefined && declaredLength !== '') {
		const size = Number(declaredLength)
		if (!Number.isFinite(size) || size < 0 || size > maxBytes) {
			return Promise.reject(new RequestBodyError('payload_too_large'))
		}
	}

	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = []
		let total = 0
		let settled = false
		const finish = (error: Error | null, body?: Buffer) => {
			if (settled) return
			settled = true
			if (error) reject(error)
			else resolve(body ?? Buffer.alloc(0))
		}
		const onData = (chunk: Buffer | string) => {
			const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
			total += buf.length
			if (total > maxBytes) {
				finish(new RequestBodyError('payload_too_large'))
				return
			}
			chunks.push(buf)
		}
		const onEnd = () => finish(null, Buffer.concat(chunks))
		const onError = (error: Error) => finish(error)
		req.on('data', onData)
		req.on('end', onEnd)
		req.on('error', onError)
	})
}
