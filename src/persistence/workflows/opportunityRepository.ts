import type { Opportunity } from '../../types'
import { decodeOpportunity, encodeOpportunity } from './opportunityCodec'
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
	RepoUpsertResult,
	RepoWriteResult,
} from './types'

const OPPORTUNITY_STATUS_ORDER = [
	'idea',
	'targeted',
	'pitched',
	'in_discussion',
	'launched',
	'archived',
] as const

function sortOpportunities(a: Opportunity, b: Opportunity): number {
	const ai = OPPORTUNITY_STATUS_ORDER.indexOf(a.status as (typeof OPPORTUNITY_STATUS_ORDER)[number])
	const bi = OPPORTUNITY_STATUS_ORDER.indexOf(b.status as (typeof OPPORTUNITY_STATUS_ORDER)[number])
	const aIdx = ai === -1 ? OPPORTUNITY_STATUS_ORDER.length : ai
	const bIdx = bi === -1 ? OPPORTUNITY_STATUS_ORDER.length : bi
	return aIdx - bIdx || a.id.localeCompare(b.id)
}

export async function listOpportunitiesForUser(userId: string): Promise<RepoListResult<Opportunity>> {
	if (!requireUserId(userId)) return { ok: false, error: 'unauthorized' }
	const client = getWorkflowClient()
	if (!client) return { ok: false, error: 'unavailable' }

	const { data, error } = await client
		.from('opportunities')
		.select('*')
		.eq('user_id', userId)
		.order('updated_at', { ascending: false })

	if (error) return { ok: false, error: normalizeWorkflowRepoError(error) }

	const records: Opportunity[] = []
	let rejectedCount = 0
	for (const row of data || []) {
		const decoded = decodeOpportunity(row)
		if (decoded.ok) records.push(decoded.value)
		else rejectedCount += 1
	}
	records.sort(sortOpportunities)
	return { ok: true, records, rejectedCount }
}

export async function getOpportunityByClientId(
	userId: string,
	clientId: string
): Promise<RepoGetResult<Opportunity>> {
	if (!requireUserId(userId)) return { ok: false, error: 'unauthorized' }
	if (!clientId) return { ok: false, error: 'unauthorized' }
	const client = getWorkflowClient()
	if (!client) return { ok: false, error: 'unavailable' }

	const { data, error } = await client
		.from('opportunities')
		.select('*')
		.eq('user_id', userId)
		.eq('client_id', clientId)
		.maybeSingle()

	if (error) return { ok: false, error: normalizeWorkflowRepoError(error) }
	if (!data) return { ok: true, record: null }

	const decoded = decodeOpportunity(data)
	if (!decoded.ok) return { ok: false, error: 'decode_failure' }
	return { ok: true, record: decoded.value }
}

export async function upsertOpportunityForUser(
	userId: string,
	record: Opportunity
): Promise<RepoUpsertResult<Opportunity>> {
	if (!requireUserId(userId)) return { ok: false, error: 'unauthorized' }
	const client = getWorkflowClient()
	if (!client) return { ok: false, error: 'unavailable' }

	const encoded = encodeOpportunity(userId, record)
	if (!encoded.ok) return { ok: false, error: 'decode_failure' }

	const decoded = decodeOpportunity(encoded.value)
	if (!decoded.ok) return { ok: false, error: 'decode_failure' }

	const row = { ...encoded.value, user_id: userId }
	const { error } = await client
		.from('opportunities')
		.upsert(row, { onConflict: 'user_id,client_id' })

	if (error) return { ok: false, error: 'write_failure' }
	return { ok: true, record: decoded.value }
}

export async function deleteOpportunityForUser(
	userId: string,
	clientId: string
): Promise<RepoWriteResult> {
	if (!requireUserId(userId)) return { ok: false, error: 'unauthorized' }
	if (!clientId) return { ok: false, error: 'unauthorized' }
	const client = getWorkflowClient()
	if (!client) return { ok: false, error: 'unavailable' }

	const { error } = await client
		.from('opportunities')
		.delete()
		.eq('user_id', userId)
		.eq('client_id', clientId)

	if (error) return { ok: false, error: 'write_failure' }
	return { ok: true }
}

/**
 * Insert only records whose client_id is not already present for this user.
 * Never overwrites existing cloud rows. Safe to retry. Does not touch localStorage.
 */
export async function insertMissingLegacyOpportunities(
	userId: string,
	records: Opportunity[]
): Promise<RepoInsertMissingResult> {
	if (!requireUserId(userId)) return { ok: false, error: 'unauthorized' }
	const client = getWorkflowClient()
	if (!client) return { ok: false, error: 'unavailable' }

	const existing = await listWorkflowClientIds('opportunities', userId)
	if (!existing.ok) return { ok: false, error: existing.error }
	const existingIds = new Set(existing.clientIds)

	const toInsert = []
	let skippedExisting = 0
	let skippedInvalid = 0
	for (const record of records) {
		const encoded = encodeOpportunity(userId, record)
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
		.from('opportunities')
		.upsert(toInsert, { onConflict: 'user_id,client_id', ignoreDuplicates: true })

	// Batch failed — do not claim any inserts succeeded.
	if (error) return { ok: false, error: 'write_failure' }
	return { ok: true, inserted: toInsert.length, skippedExisting, skippedInvalid }
}
