import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const supabaseMock = vi.hoisted(() => ({
	getUser: vi.fn(),
	maybeSingle: vi.fn(),
	from: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
	createClient: vi.fn(() => {
		const query = {
			select: () => query,
			eq: () => query,
			maybeSingle: supabaseMock.maybeSingle,
		}
		supabaseMock.from.mockReturnValue(query)
		return { auth: { getUser: supabaseMock.getUser }, from: supabaseMock.from }
	}),
}))

import handler from './report.js'

const CANARY_ID = 'nil-canary-0001'
const ENV_KEYS = [
	'VITE_SUPABASE_URL',
	'VITE_SUPABASE_ANON_KEY',
	'NEXT_PUBLIC_SUPABASE_URL',
	'NEXT_PUBLIC_SUPABASE_ANON_KEY',
	'ATHLETE_HOUZE_REPORT_URL',
	'ATHLETE_HOUZE_REPORT_HMAC_SECRET',
	'ATHLETE_HOUZE_REPORTING_MODE',
	'ATHLETE_HOUZE_REPORT_CANARY_EXTERNAL_ID',
	'VERCEL_ENV',
]

function canaryUser(overrides: Record<string, unknown> = {}) {
	return {
		id: '00000000-0000-4000-8000-000000000001',
		app_metadata: {
			athlete_houze_external_id: CANARY_ID,
			workflow_cloud_persistence_canary: true,
			synthetic_test_data: true,
			...overrides,
		},
		user_metadata: {},
	}
}

function request(init: Partial<VercelRequest> = {}): VercelRequest {
	return {
		method: 'POST',
		headers: { authorization: 'Bearer synthetic-token' },
		body: { clientId: 'opportunity-canary-0001' },
		...init,
	} as VercelRequest
}

function response() {
	const res = {
		statusCode: 0,
		body: undefined as unknown,
		headers: {} as Record<string, string>,
		setHeader(name: string, value: string) {
			res.headers[name] = value
			return res
		},
		status(code: number) {
			res.statusCode = code
			return res
		},
		json(body: unknown) {
			res.body = body
			return res
		},
	}
	return res
}

async function call(req: VercelRequest) {
	const res = response()
	await handler(req, res as unknown as VercelResponse)
	return res
}

function configureIntegration() {
	process.env.ATHLETE_HOUZE_REPORT_URL = 'https://athlete-houze.invalid/api/app-reports'
	process.env.ATHLETE_HOUZE_REPORT_HMAC_SECRET = 'test-secret-do-not-use-in-production'
	process.env.ATHLETE_HOUZE_REPORTING_MODE = 'canary'
	process.env.ATHLETE_HOUZE_REPORT_CANARY_EXTERNAL_ID = CANARY_ID
}

describe('POST /api/integrations/athlete-houze/report', () => {
	const savedEnv: Record<string, string | undefined> = {}
	const fetchMock = vi.fn()

	beforeEach(() => {
		for (const key of ENV_KEYS) {
			savedEnv[key] = process.env[key]
			delete process.env[key]
		}
		process.env.VITE_SUPABASE_URL = 'https://synthetic.supabase.invalid'
		process.env.VITE_SUPABASE_ANON_KEY = 'synthetic-anon-key'
		supabaseMock.getUser.mockReset()
		supabaseMock.maybeSingle.mockReset()
		supabaseMock.from.mockClear()
		fetchMock.mockReset()
		vi.stubGlobal('fetch', fetchMock)
	})

	afterEach(() => {
		for (const key of ENV_KEYS) {
			if (savedEnv[key] === undefined) delete process.env[key]
			else process.env[key] = savedEnv[key]
		}
		vi.unstubAllGlobals()
	})

	it('answers non-POST requests with 405 before reading anything', async () => {
		const res = await call(request({ method: 'GET', headers: {} }))
		expect(res.statusCode).toBe(405)
		expect(res.headers.Allow).toBe('POST')
		expect(supabaseMock.getUser).not.toHaveBeenCalled()
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('rejects requests without a bearer token', async () => {
		const res = await call(request({ headers: {} }))
		expect(res.statusCode).toBe(401)
		expect(supabaseMock.getUser).not.toHaveBeenCalled()
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('rejects an invalid bearer token', async () => {
		configureIntegration()
		supabaseMock.getUser.mockResolvedValue({ data: { user: null }, error: new Error('bad jwt') })
		const res = await call(request())
		expect(res.statusCode).toBe(401)
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it.each([undefined, '', ' ', '../etc', 'a'.repeat(201), 42])(
		'rejects invalid clientId %j',
		async clientId => {
			const res = await call(request({ body: { clientId } }))
			expect(res.statusCode).toBe(400)
			expect(supabaseMock.getUser).not.toHaveBeenCalled()
			expect(fetchMock).not.toHaveBeenCalled()
		}
	)

	it('returns a controlled 503 when integration settings are missing', async () => {
		supabaseMock.getUser.mockResolvedValue({ data: { user: canaryUser() }, error: null })
		const res = await call(request())
		expect(res.statusCode).toBe(503)
		expect(res.body).toEqual({ error: 'Integration unavailable' })
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('returns a controlled 503 when Supabase settings are missing', async () => {
		delete process.env.VITE_SUPABASE_URL
		configureIntegration()
		const res = await call(request())
		expect(res.statusCode).toBe(503)
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it.each([
		['no external id', { athlete_houze_external_id: undefined }],
		['another external id', { athlete_houze_external_id: 'nil-real-athlete-0002' }],
		['not a canary', { workflow_cloud_persistence_canary: false }],
		['not synthetic', { synthetic_test_data: undefined }],
	])('forbids non-canary users (%s)', async (_label, overrides) => {
		configureIntegration()
		supabaseMock.getUser.mockResolvedValue({
			data: { user: canaryUser(overrides) },
			error: null,
		})
		const res = await call(request())
		expect(res.statusCode).toBe(403)
		expect(supabaseMock.from).not.toHaveBeenCalled()
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('ignores canary flags placed in user-editable user_metadata', async () => {
		configureIntegration()
		supabaseMock.getUser.mockResolvedValue({
			data: {
				user: {
					id: '00000000-0000-4000-8000-000000000002',
					app_metadata: {},
					user_metadata: {
						athlete_houze_external_id: CANARY_ID,
						workflow_cloud_persistence_canary: true,
						synthetic_test_data: true,
					},
				},
			},
			error: null,
		})
		const res = await call(request())
		expect(res.statusCode).toBe(403)
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('returns 404 when the canary does not own the source record', async () => {
		configureIntegration()
		supabaseMock.getUser.mockResolvedValue({ data: { user: canaryUser() }, error: null })
		supabaseMock.maybeSingle.mockResolvedValue({ data: null, error: null })
		const res = await call(request())
		expect(res.statusCode).toBe(404)
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('delivers a signed synthetic report for the authorized canary', async () => {
		configureIntegration()
		supabaseMock.getUser.mockResolvedValue({ data: { user: canaryUser() }, error: null })
		supabaseMock.maybeSingle.mockResolvedValue({
			data: {
				client_id: 'opportunity-canary-0001',
				status: 'idea',
				category: 'local_brand_deal',
				updated_at: '2026-08-09T20:00:00.000Z',
			},
			error: null,
		})
		fetchMock.mockResolvedValue(new Response('{"accepted":true}', { status: 202 }))

		const res = await call(request())

		expect(res.statusCode).toBe(202)
		expect(res.body).toEqual({ accepted: true })
		expect(fetchMock).toHaveBeenCalledTimes(1)
		const [url, init] = fetchMock.mock.calls[0]
		expect(url).toBe('https://athlete-houze.invalid/api/app-reports')
		expect(init.headers['x-ah-signature']).toMatch(/^sha256=[0-9a-f]{64}$/)
		const sent = JSON.parse(init.body)
		expect(sent.externalAthleteId).toBe(CANARY_ID)
		expect(sent.sourceRecordId).toBe('opportunity-canary-0001')
		expect(sent.evidencePayload.attributes.synthetic_test_data).toBe(true)
	})

	it('returns 503 without leaking details when delivery is rejected', async () => {
		configureIntegration()
		supabaseMock.getUser.mockResolvedValue({ data: { user: canaryUser() }, error: null })
		supabaseMock.maybeSingle.mockResolvedValue({
			data: {
				client_id: 'opportunity-canary-0001',
				status: 'idea',
				category: 'local_brand_deal',
				updated_at: '2026-08-09T20:00:00.000Z',
			},
			error: null,
		})
		fetchMock.mockResolvedValue(new Response('{"error":"bad signature"}', { status: 401 }))
		const res = await call(request())
		expect(res.statusCode).toBe(503)
		expect(res.body).toEqual({ error: 'Integration delivery failed' })
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})
})
