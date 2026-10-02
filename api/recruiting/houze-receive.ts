import type { IncomingMessage, ServerResponse } from 'node:http'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
	parseRecruitingAcknowledgement,
	parseRecruitingEvent,
	RecruitingEventRejected,
	verifyRecruitingSignature,
	type RecruitingAcknowledgement,
	type ValidatedRecruitingEvent,
} from '../_lib/athleteHouzeRecruitingContract'
import {
	loadNilRecruitingReceiverConfig,
	type NilRecruitingReceiverConfig,
} from '../_lib/nilRecruitingReceiverConfig'
import {
	NIL_RECRUITING_RECEIVER_MAX_BODY_BYTES,
	readOriginalRequestBytes,
	RequestBodyError,
} from '../_lib/vercelNodeRequestBody'

export type ReceiverQueryResult = { rows: Array<Record<string, unknown>> }

export type ReceiverDb = {
	query(sql: string, params: unknown[]): Promise<ReceiverQueryResult>
}

type ReceiverEnvironment = Readonly<Record<string, string | undefined>>

export type HouzeReceiveDeps = {
	env?: ReceiverEnvironment
	db?: ReceiverDb
	nowSeconds?: () => number
	config?: NilRecruitingReceiverConfig | null
}

type CommitStatus =
	| 'ok'
	| 'conflict'
	| 'mapping_missing'
	| 'mapping_revoked'
	| 'mapping_mismatch'
	| 'invalid_event'

const COMMIT_SQL = `SELECT public.commit_recruiting_inbound_event(
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
) AS result`

let sharedPool: import('pg').Pool | null = null
let sharedPoolUrl: string | null = null

async function databaseFor(config: NilRecruitingReceiverConfig): Promise<ReceiverDb> {
	if (!sharedPool || sharedPoolUrl !== config.databaseUrl) {
		if (sharedPool) await sharedPool.end().catch(() => undefined)
		const { default: pg } = await import('pg')
		sharedPool = new pg.Pool({
			connectionString: config.databaseUrl,
			max: 8,
			connectionTimeoutMillis: 5_000,
		})
		sharedPoolUrl = config.databaseUrl
	}
	const pool = sharedPool
	return {
		query(sql, params) {
			return pool.query(sql, params)
		},
	}
}

function header(req: IncomingMessage, name: string): string | undefined {
	const value = req.headers[name]
	if (Array.isArray(value)) return value[0]
	return value
}

function sendJson(res: ServerResponse, status: number, body: Record<string, unknown>): void {
	const payload = JSON.stringify(body)
	res.statusCode = status
	if (!res.getHeader('content-type')) {
		res.setHeader('content-type', 'application/json; charset=utf-8')
	}
	res.setHeader('cache-control', 'no-store')
	res.setHeader('content-length', Buffer.byteLength(payload))
	res.end(payload)
}

function httpError(res: ServerResponse, status: number, error: string): void {
	sendJson(res, status, { error })
}

async function commitEvent(db: ReceiverDb, event: ValidatedRecruitingEvent): Promise<unknown> {
	const result = await db.query(COMMIT_SQL, [
		event.eventId,
		event.idempotencyKey,
		event.houzeAthleteId,
		event.claimedNilAccountId,
		event.claimedClerkUserId,
		event.entityType,
		event.entityId,
		event.revision,
		event.occurredAt,
		event.payload.title,
		event.payload.status,
		event.payload.note,
	])
	return result.rows[0]?.result
}

function acknowledgementFromCommit(result: unknown): RecruitingAcknowledgement | CommitStatus {
	if (!result || typeof result !== 'object') return 'invalid_event'
	const record = result as { status?: unknown; acknowledgement?: unknown }
	if (record.status === 'ok') return parseRecruitingAcknowledgement(record.acknowledgement)
	if (
		record.status === 'conflict' ||
		record.status === 'mapping_missing' ||
		record.status === 'mapping_revoked' ||
		record.status === 'mapping_mismatch' ||
		record.status === 'invalid_event'
	) {
		return record.status
	}
	throw new Error('invalid_commit_result')
}

/**
 * Inbound Athlete Houze recruiting receiver.
 * Original bytes are read before req.body. Production stays inactive.
 */
export async function handleHouzeRecruitingReceive(
	req: VercelRequest,
	res: VercelResponse,
	deps: HouzeReceiveDeps = {}
): Promise<void> {
	res.setHeader('cache-control', 'no-store')
	if (req.method !== 'POST') {
		res.setHeader('allow', 'POST')
		httpError(res, 405, 'method_not_allowed')
		return
	}

	const config =
		deps.config === undefined ? loadNilRecruitingReceiverConfig(deps.env ?? process.env) : deps.config
	if (!config) {
		httpError(res, 503, 'receiver_inactive')
		return
	}

	let raw: Buffer
	try {
		raw = await readOriginalRequestBytes(req, config.maxBodyBytes || NIL_RECRUITING_RECEIVER_MAX_BODY_BYTES)
	} catch (error) {
		if (error instanceof RequestBodyError) {
			httpError(res, error.code === 'payload_too_large' ? 413 : 400, error.code)
			return
		}
		httpError(res, 400, 'raw_body_unavailable')
		return
	}

	const contentType = header(req, 'content-type')?.split(';')[0]?.trim().toLowerCase()
	if (contentType !== 'application/json') {
		httpError(res, 415, 'unsupported_media_type')
		return
	}

	const nowSeconds = deps.nowSeconds ? deps.nowSeconds() : Math.floor(Date.now() / 1000)
	const signatureOk = verifyRecruitingSignature(
		raw,
		header(req, 'x-ah-timestamp'),
		header(req, 'x-ah-signature'),
		config.hmacSecret,
		nowSeconds,
		config.timestampSkewSeconds
	)
	if (!signatureOk) {
		httpError(res, 401, 'invalid_signature')
		return
	}

	let event: ValidatedRecruitingEvent
	try {
		event = parseRecruitingEvent(raw)
	} catch (error) {
		if (error instanceof RecruitingEventRejected) {
			httpError(res, 400, error.code)
			return
		}
		httpError(res, 400, 'invalid_event')
		return
	}

	try {
		const db = deps.db ?? (await databaseFor(config))
		const committed = acknowledgementFromCommit(await commitEvent(db, event))
		if (committed === 'conflict') {
			httpError(res, 409, 'conflict')
			return
		}
		if (
			committed === 'mapping_missing' ||
			committed === 'mapping_revoked' ||
			committed === 'mapping_mismatch'
		) {
			httpError(res, 403, committed)
			return
		}
		if (committed === 'invalid_event') {
			httpError(res, 400, 'invalid_event')
			return
		}
		sendJson(res, 200, committed)
	} catch (error) {
		const code = error instanceof Error ? error.name : 'error'
		console.error('[houze-recruiting-receive]', code)
		httpError(res, 503, 'database_unavailable')
	}
}

export default function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
	return handleHouzeRecruitingReceive(req, res)
}
