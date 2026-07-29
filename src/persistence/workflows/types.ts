import type { DealLogEntry, EventPlan, Opportunity } from '../../types'

export const WORKFLOW_SOURCE = 'nil_roster_app' as const

export type CodecSuccess<T> = { ok: true; value: T }
export type CodecFailure = { ok: false; error: 'decode_failure' | 'invalid_record' }

export type OpportunityDbRow = {
	id?: string
	user_id: string
	client_id: string
	athlete_id: string | null
	title: string | null
	status: string | null
	category: string | null
	target_brand_name: string | null
	expected_start_date: string | null
	expected_end_date: string | null
	linked_deal_client_id: string | null
	payload: Record<string, unknown>
	source: string
	created_at?: string
	updated_at?: string
}

export type DealDbRow = {
	id?: string
	user_id: string
	client_id: string
	athlete_id: string | null
	title: string | null
	status: string | null
	brand_name: string | null
	deal_type: string | null
	value_estimate: number | null
	currency: string | null
	start_date: string | null
	end_date: string | null
	payload: Record<string, unknown>
	source: string
	created_at?: string
	updated_at?: string
}

export type EventDbRow = {
	id?: string
	user_id: string
	client_id: string
	athlete_id: string | null
	name: string | null
	event_type: string | null
	event_date: string | null
	location: string | null
	host_organization: string | null
	linked_deal_client_id: string | null
	payload: Record<string, unknown>
	source: string
	created_at?: string
	updated_at?: string
}

export type WorkflowRepoError =
	| 'unavailable'
	| 'unauthorized'
	| 'decode_failure'
	| 'write_failure'

export type RepoListResult<T> =
	| { ok: true; records: T[]; rejectedCount: number }
	| { ok: false; error: WorkflowRepoError }

export type RepoGetResult<T> =
	| { ok: true; record: T | null }
	| { ok: false; error: WorkflowRepoError }

export type RepoWriteResult =
	| { ok: true }
	| { ok: false; error: WorkflowRepoError }

/**
 * Successful upsert returns the canonical domain record (encode → decode)
 * so callers mirror exactly what a subsequent list/decode would produce.
 */
export type RepoUpsertResult<T> =
	| { ok: true; record: T }
	| { ok: false; error: WorkflowRepoError }

export type RepoInsertMissingResult =
	| { ok: true; inserted: number; skippedExisting: number; skippedInvalid: number }
	| { ok: false; error: WorkflowRepoError }

export type ImportRejected = {
	index: number
	reason: 'malformed' | 'duplicate_local' | 'athlete_mismatch'
}

export type ImportConflict = {
	clientId: string
	reason: 'cloud_exists' | 'athlete_mismatch' | 'duplicate_local_content' | 'content_mismatch'
}

export type LegacyImportPlan<T> = {
	recordsToInsert: T[]
	alreadyPresent: T[]
	rejectedRecords: ImportRejected[]
	conflicts: ImportConflict[]
	totalLocal: number
	totalCloud: number
}

export type OpportunityRecord = Opportunity
export type DealRecord = DealLogEntry
export type EventRecord = EventPlan
