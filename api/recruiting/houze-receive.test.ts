import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import type { IncomingMessage } from 'node:http'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
	RECRUITING_ACK_SCHEMA_VERSION,
	RECRUITING_EVENT_SCHEMA_VERSION,
	signRecruitingRequest,
} from '../_lib/athleteHouzeRecruitingContract'
import type { NilRecruitingReceiverConfig } from '../_lib/nilRecruitingReceiverConfig'
import { installLazyParsedBody, restoreVercelRequestBody } from '../_lib/vercelNodeRequestBody'
import { handleHouzeRecruitingReceive, type ReceiverDb } from './houze-receive'

const SECRET = 'development-secret-012345'
const NOW = 1_780_000_000
const CONFIG: NilRecruitingReceiverConfig = {
	mode: 'development',
	hmacSecret: SECRET,
	databaseUrl:
		'postgresql://nil_recruiting_receiver:nil-receiver-dev-only@127.0.0.1:5432/nil_recruiting_receiver_dev',
	maxBodyBytes: 65_536,
	timestampSkewSeconds: 300,
}

const ACK = {
	schemaVersion: RECRUITING_ACK_SCHEMA_VERSION,
	eventId: 'evt_receive_0001',
	idempotencyKey: 'idem_receive_0001',
	houzeAthleteId: 'ath_houze_0001',
	nilAccountId: '11111111-1111-4111-8111-111111111111',
	entityType: 'recruiting_record',
	entityId: 'rec_record_0001',
	requestedRevision: 2,
	currentRevision: 5,
	revisionOutcome: 'current_revision_newer',
	applied: false,
}

function eventBody(overrides: Record<string, unknown> = {}) {
	return JSON.stringify({
		schemaVersion: RECRUITING_EVENT_SCHEMA_VERSION,
		eventId: 'evt_receive_0001',
		idempotencyKey: 'idem_receive_0001',
		houzeAthleteId: 'ath_houze_0001',
		entityType: 'recruiting_record',
		entityId: 'rec_record_0001',
		revision: 1,
		occurredAt: '2026-10-01T03:04:05.000Z',
		payload: { title: 'State camp', status: 'prospect' },
		...overrides,
	})
}

function mockResponse() {
	const headers = new Map<string, string>()
	let body = ''
	const res = {
		statusCode: 200,
		setHeader(name: string, value: string | number) {
			headers.set(name.toLowerCase(), String(value))
		},
		getHeader(name: string) {
			return headers.get(name.toLowerCase())
		},
		end(payload?: string) {
			body = payload ?? ''
		},
	}
	return {
		res: res as unknown as VercelResponse,
		read() {
			return { status: res.statusCode, body: body ? JSON.parse(body) : null, raw: body }
		},
	}
}

function requestFrom(raw: string, options: { signature?: string; materializeBody?: boolean } = {}) {
	const req = Readable.from([]) as IncomingMessage & { method?: string; headers: Record<string, string> }
	req.method = 'POST'
	req.headers = {
		'content-type': 'application/json',
		'content-length': String(Buffer.byteLength(raw)),
		'x-ah-timestamp': String(NOW),
		'x-ah-signature': options.signature ?? signRecruitingRequest(raw, NOW, SECRET),
	}
	if (options.materializeBody) {
		Object.defineProperty(req, 'body', { configurable: true, enumerable: true, writable: true, value: JSON.parse(raw) })
	} else {
		restoreVercelRequestBody(req, Buffer.from(raw))
		installLazyParsedBody(req, Buffer.from(raw), 'application/json')
	}
	return req as VercelRequest
}

function fakeDb(result: unknown, calls: unknown[][]): ReceiverDb {
	return {
		async query(_sql, params) {
			calls.push(params)
			return { rows: [{ result }] }
		},
	}
}

describe('houze recruiting receiver handler', () => {
	it('stays inactive in production and does not read a database', async () => {
		const calls: unknown[][] = []
		const response = mockResponse()
		await handleHouzeRecruitingReceive(requestFrom(eventBody()), response.res, {
			config: null,
			db: fakeDb({}, calls),
		})
		expect(response.read()).toEqual({ status: 503, body: { error: 'receiver_inactive' }, raw: '{"error":"receiver_inactive"}' })
		expect(calls).toEqual([])
	})

	it('verifies original bytes before the parsed body and rejects unknown fields without a write', async () => {
		const raw = `{\n  "schemaVersion": "${RECRUITING_EVENT_SCHEMA_VERSION}",\n  "eventId": "evt_receive_0001",\n  "idempotencyKey": "idem_receive_0001",\n  "houzeAthleteId": "ath_houze_0001",\n  "entityType": "recruiting_record",\n  "entityId": "rec_record_0001",\n  "revision": 1,\n  "occurredAt": "2026-10-01T03:04:05.000Z",\n  "payload": { "title": "State camp", "status": "prospect", "extra": true }\n}\n`
		const calls: unknown[][] = []
		const response = mockResponse()
		await handleHouzeRecruitingReceive(requestFrom(raw), response.res, {
			config: CONFIG,
			nowSeconds: () => NOW,
			db: fakeDb({ status: 'ok', acknowledgement: ACK }, calls),
		})
		expect(response.read().status).toBe(400)
		expect(response.read().body).toEqual({ error: 'unknown_field' })
		expect(calls).toEqual([])
	})

	it('refuses a pre-parsed body instead of signing JSON.stringify(req.body)', async () => {
		const calls: unknown[][] = []
		const response = mockResponse()
		await handleHouzeRecruitingReceive(requestFrom(eventBody(), { materializeBody: true }), response.res, {
			config: CONFIG,
			nowSeconds: () => NOW,
			db: fakeDb({}, calls),
		})
		expect(response.read().body).toEqual({ error: 'raw_body_unavailable' })
		expect(calls).toEqual([])
	})

	it('returns a bound acknowledgement and hides stored content on conflict', async () => {
		const calls: unknown[][] = []
		const ok = mockResponse()
		await handleHouzeRecruitingReceive(requestFrom(eventBody()), ok.res, {
			config: CONFIG,
			nowSeconds: () => NOW,
			db: fakeDb({ status: 'ok', acknowledgement: { ...ACK, privateNote: 'hidden' } }, calls),
		})
		expect(ok.read().status).toBe(503)

		const conflict = mockResponse()
		await handleHouzeRecruitingReceive(requestFrom(eventBody()), conflict.res, {
			config: CONFIG,
			nowSeconds: () => NOW,
			db: fakeDb({ status: 'conflict', acknowledgement: ACK, nilAccountId: ACK.nilAccountId }, calls),
		})
		expect(conflict.read()).toMatchObject({ status: 409, body: { error: 'conflict' } })
		expect(conflict.read().raw).toBe('{"error":"conflict"}')
		expect(calls).toHaveLength(2)
		expect(calls[1]?.[2]).toBe('ath_houze_0001')
	})

	it('returns the allowlisted acknowledgement for a valid newer revision', async () => {
		const response = mockResponse()
		await handleHouzeRecruitingReceive(requestFrom(eventBody()), response.res, {
			config: CONFIG,
			nowSeconds: () => NOW,
			db: fakeDb({ status: 'ok', acknowledgement: ACK }, []),
		})
		expect(response.read().status).toBe(200)
		expect(response.read().body).toEqual(ACK)
	})
})
