import type { DealLogEntry } from '../../types'
import { decodeDeal, encodeDeal } from './dealCodec'
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

function sortDeals(a: DealLogEntry, b: DealLogEntry): number {
	return (b.startDate || '').localeCompare(a.startDate || '') || b.id.localeCompare(a.id)
}

export async function listDealsForUser(userId: string): Promise<RepoListResult<DealLogEntry>> {
	if (!requireUserId(userId)) return { ok: false, error: 'unauthorized' }
	const client = getWorkflowClient()
	if (!client) return { ok: false, error: 'unavailable' }

	const { data, error } = await client
		.from('deals')
		.select('*')
		.eq('user_id', userId)
		.order('updated_at', { ascending: false })

	if (error) return { ok: false, error: normalizeWorkflowRepoError(error) }

	const records: DealLogEntry[] = []
	let rejectedCount = 0
	for (const row of data || []) {
		const decoded = decodeDeal(row)
		if (decoded.ok) records.push(decoded.value)
		else rejectedCount += 1
	}
	records.sort(sortDeals)
	return { ok: true, records, rejectedCount }
}

export async function getDealByClientId(
	userId: string,
	clientId: string
): Promise<RepoGetResult<DealLogEntry>> {
	if (!requireUserId(userId)) return { ok: false, error: 'unauthorized' }
	if (!clientId) return { ok: false, error: 'unauthorized' }
	const client = getWorkflowClient()
	if (!client) return { ok: false, error: 'unavailable' }

	const { data, error } = await client
		.from('deals')
		.select('*')
		.eq('user_id', userId)
		.eq('client_id', clientId)
		.maybeSingle()

	if (error) return { ok: false, error: normalizeWorkflowRepoError(error) }
	if (!data) return { ok: true, record: null }

	const decoded = decodeDeal(data)
	if (!decoded.ok) return { ok: false, error: 'decode_failure' }
	return { ok: true, record: decoded.value }
}

export async function upsertDealForUser(
	userId: string,
	record: DealLogEntry
): Promise<RepoWriteResult> {
	if (!requireUserId(userId)) return { ok: false, error: 'unauthorized' }
	const client = getWorkflowClient()
	if (!client) return { ok: false, error: 'unavailable' }

	const encoded = encodeDeal(userId, record)
	if (!encoded.ok) return { ok: false, error: 'decode_failure' }

	const row = { ...encoded.value, user_id: userId }
	const { error } = await client.from('deals').upsert(row, { onConflict: 'user_id,client_id' })

	if (error) return { ok: false, error: 'write_failure' }
	return { ok: true }
}

export async function deleteDealForUser(
	userId: string,
	clientId: string
): Promise<RepoWriteResult> {
	if (!requireUserId(userId)) return { ok: false, error: 'unauthorized' }
	if (!clientId) return { ok: false, error: 'unauthorized' }
	const client = getWorkflowClient()
	if (!client) return { ok: false, error: 'unavailable' }

	const { error } = await client
		.from('deals')
		.delete()
		.eq('user_id', userId)
		.eq('client_id', clientId)

	if (error) return { ok: false, error: 'write_failure' }
	return { ok: true }
}

export async function insertMissingLegacyDeals(
	userId: string,
	records: DealLogEntry[]
): Promise<RepoInsertMissingResult> {
	if (!requireUserId(userId)) return { ok: false, error: 'unauthorized' }
	const client = getWorkflowClient()
	if (!client) return { ok: false, error: 'unavailable' }

	const existing = await listWorkflowClientIds('deals', userId)
	if (!existing.ok) return { ok: false, error: existing.error }
	const existingIds = new Set(existing.clientIds)

	const toInsert = []
	let skippedExisting = 0
	let skippedInvalid = 0
	for (const record of records) {
		const encoded = encodeDeal(userId, record)
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
		.from('deals')
		.upsert(toInsert, { onConflict: 'user_id,client_id', ignoreDuplicates: true })

	if (error) return { ok: false, error: 'write_failure' }
	return { ok: true, inserted: toInsert.length, skippedExisting, skippedInvalid }
}
