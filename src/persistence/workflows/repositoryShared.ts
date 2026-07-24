import { supabase, supabaseEnvConfigured } from '../../lib/supabaseClient'
import type { WorkflowRepoError } from './types'

export function normalizeWorkflowRepoError(_err: unknown): WorkflowRepoError {
	// Never surface raw backend messages or private payload content to callers.
	return 'unavailable'
}

export function requireUserId(userId: string | null | undefined): userId is string {
	return typeof userId === 'string' && userId.trim().length > 0
}

export function getWorkflowClient() {
	if (!supabaseEnvConfigured || !supabase) return null
	return supabase
}

export type WorkflowTableName = 'opportunities' | 'deals' | 'events'

/**
 * List existing client_ids for a user without decoding payloads.
 * Avoids missing IDs when a stored row is malformed (decode would skip it).
 */
export async function listWorkflowClientIds(
	table: WorkflowTableName,
	userId: string
): Promise<{ ok: true; clientIds: Set<string> } | { ok: false; error: WorkflowRepoError }> {
	const client = getWorkflowClient()
	if (!client) return { ok: false, error: 'unavailable' }

	const { data, error } = await client.from(table).select('client_id').eq('user_id', userId)

	if (error) return { ok: false, error: normalizeWorkflowRepoError(error) }

	const clientIds = new Set<string>()
	for (const row of data || []) {
		const id = row && typeof (row as { client_id?: unknown }).client_id === 'string'
			? (row as { client_id: string }).client_id
			: ''
		if (id) clientIds.add(id)
	}
	return { ok: true, clientIds }
}
