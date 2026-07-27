import type { LegacyImportPlan } from './types'

/**
 * Shared workflow persistence modes for Opportunities / Deals / Events.
 *
 * - local: flag off / signed out / deferred "keep using device" — exact prior localStorage behavior
 * - checking: inspecting local + cloud before deciding; mutations disabled
 * - import_required: local has safe insertable records; mutations disabled until Import or Keep using device
 * - conflict: unresolved mismatch/rejection; show local; mutations disabled; Retry only
 * - cloud: cloud is source of truth; writes go repository → state → mirror
 * - unavailable: cloud inspection/write path failed; show local mirror; mutations disabled; Retry only
 */
export type WorkflowPersistenceMode =
	| 'local'
	| 'checking'
	| 'import_required'
	| 'conflict'
	| 'cloud'
	| 'unavailable'

export type WorkflowBootstrapDecision = {
	mode: Exclude<WorkflowPersistenceMode, 'local' | 'checking' | 'unavailable'>
	hasInsertableLocal: boolean
	hasBlockingConflicts: boolean
}

const BLOCKING_CONFLICT_REASONS = new Set([
	'content_mismatch',
	'athlete_mismatch',
	'duplicate_local_content',
])

export type DecideBootstrapOptions = {
	/** Rows skipped by cloud decode during list. */
	cloudRejectedCount?: number
}

/**
 * Decide bootstrap mode from a completed import plan (+ optional cloud decode rejects).
 * Does not perform I/O. Never selects cloud when conflicts/rejections exist.
 */
export function decideWorkflowBootstrapMode<T>(
	plan: LegacyImportPlan<T>,
	options: DecideBootstrapOptions = {}
): WorkflowBootstrapDecision {
	const cloudRejectedCount = options.cloudRejectedCount ?? 0
	const hasInsertableLocal = plan.recordsToInsert.length > 0
	const hasBlockingConflicts =
		plan.rejectedRecords.length > 0 ||
		cloudRejectedCount > 0 ||
		plan.conflicts.some((c) => BLOCKING_CONFLICT_REASONS.has(c.reason))

	if (hasBlockingConflicts) {
		return {
			mode: 'conflict',
			hasInsertableLocal,
			hasBlockingConflicts: true,
		}
	}

	if (hasInsertableLocal) {
		return {
			mode: 'import_required',
			hasInsertableLocal: true,
			hasBlockingConflicts: false,
		}
	}

	return { mode: 'cloud', hasInsertableLocal: false, hasBlockingConflicts: false }
}

/** Whether interactive mutations should write through cloud repositories. */
export function isCloudWriteMode(mode: WorkflowPersistenceMode): boolean {
	return mode === 'cloud'
}

/** Modes where create/edit/delete must be disabled. */
export function areMutationsDisabled(mode: WorkflowPersistenceMode): boolean {
	return (
		mode === 'checking' ||
		mode === 'import_required' ||
		mode === 'conflict' ||
		mode === 'unavailable'
	)
}

/** Whether a status/import gate should render (not plain local). */
export function showsWorkflowStatusUi(mode: WorkflowPersistenceMode): boolean {
	return mode !== 'local'
}
