import type { EventPlan } from '../../types'
import { decodeEvent, encodeEvent } from './eventCodec'
import {
	getWorkflowClient,
	listWorkflowClientIds,
	normalizeWorkflowRepoError,
	requireUserId,
} from './repositoryShared'
import type {
	RepoGetResult,
	RepoInsertMissingResult,
	RepoListResult,
	RepoWriteResult,
} from './types'

function sortEvents(a: EventPlan, b: EventPlan): number {
	return (a.date || '').localeCompare(b.date || '') || a.id.localeCompare(b.id)
}

export async function listEventsForUser(userId: string): Promise<RepoListResult<EventPlan>> {
	if (!requireUserId(userId)) return { ok: false, error: 'unauthorized' }
	const client = getWorkflowClient()
	if (!client) return { ok: false, error: 'unavailable' }

	const { data, error } = await client
		.from('events')
		.select('*')
		.eq('user_id', userId)
		.order('updated_at', { ascending: false })

	if (error) return { ok: false, error: normalizeWorkflowRepoError(error) }

	const records: EventPlan[] = []
	let rejectedCount = 0
	for (const row of data || []) {
		const decoded = decodeEvent(row)
		if (decoded.ok) records.push(decoded.value)
		else rejectedCount += 1
	}
	records.sort(sortEvents)
	return { ok: true, records, rejectedCount }
}

export async function getEventByClientId(
	userId: string,
	clientId: string
): Promise<RepoGetResult<EventPlan>> {
	if (!requireUserId(userId)) return { ok: false, error: 'unauthorized' }
	if (!clientId) return { ok: false, error: 'unauthorized' }
	const client = getWorkflowClient()
	if (!client) return { ok: false, error: 'unavailable' }

	const { data, error } = await client
		.from('events')
		.select('*')
		.eq('user_id', userId)
		.eq('client_id', clientId)
		.maybeSingle()

	if (error) return { ok: false, error: normalizeWorkflowRepoError(error) }
	if (!data) return { ok: true, record: null }

	const decoded = decodeEvent(data)
	if (!decoded.ok) return { ok: false, error: 'decode_failure' }
	return { ok: true, record: decoded.value }
}

export async function upsertEventForUser(
	userId: string,
	record: EventPlan
): Promise<RepoWriteResult> {
	if (!requireUserId(userId)) return { ok: false, error: 'unauthorized' }
	const client = getWorkflowClient()
	if (!client) return { ok: false, error: 'unavailable' }

	const encoded = encodeEvent(userId, record)
	if (!encoded.ok) return { ok: false, error: 'decode_failure' }

	const row = { ...encoded.value, user_id: userId }
	const { error } = await client.from('events').upsert(row, { onConflict: 'user_id,client_id' })

	if (error) return { ok: false, error: 'write_failure' }
	return { ok: true }
}

export async function deleteEventForUser(
	userId: string,
	clientId: string
): Promise<RepoWriteResult> {
	if (!requireUserId(userId)) return { ok: false, error: 'unauthorized' }
	if (!clientId) return { ok: false, error: 'unauthorized' }
	const client = getWorkflowClient()
	if (!client) return { ok: false, error: 'unavailable' }

	const { error } = await client
		.from('events')
		.delete()
		.eq('user_id', userId)
		.eq('client_id', clientId)

	if (error) return { ok: false, error: 'write_failure' }
	return { ok: true }
}

export async function insertMissingLegacyEvents(
	userId: string,
	records: EventPlan[]
): Promise<RepoInsertMissingResult> {
	if (!requireUserId(userId)) return { ok: false, error: 'unauthorized' }
	const client = getWorkflowClient()
	if (!client) return { ok: false, error: 'unavailable' }

	const existing = await listWorkflowClientIds('events', userId)
	if (!existing.ok) return { ok: false, error: existing.error }
	const existingIds = new Set(existing.clientIds)

	const toInsert = []
	let skippedExisting = 0
	let skippedInvalid = 0
	for (const record of records) {
		const encoded = encodeEvent(userId, record)
		if (!encoded.ok) {
			skippedInvalid += 1
			continue
		}
		if (existingIds.has(encoded.value.client_id)) {
			skippedExisting += 1
			continue
		}
		toInsert.push({ ...encoded.value, user_id: userId })
		existingIds.add(encoded.value.client_id)
	}

	if (toInsert.length === 0) {
		return { ok: true, inserted: 0, skippedExisting, skippedInvalid }
	}

	const { error } = await client
		.from('events')
		.upsert(toInsert, { onConflict: 'user_id,client_id', ignoreDuplicates: true })

	if (error) return { ok: false, error: 'write_failure' }
	return { ok: true, inserted: toInsert.length, skippedExisting, skippedInvalid }
}
