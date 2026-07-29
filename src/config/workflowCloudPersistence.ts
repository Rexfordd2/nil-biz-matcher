/**
 * Controlled rollout flags for workflow cloud persistence (opportunities, deals, events).
 *
 * Master kill switch: VITE_WORKFLOW_CLOUD_PERSISTENCE
 *   - Only exact string "true" enables the master switch (plus Supabase configured).
 *   - When master is off, cloud persistence is always disabled regardless of mode/claim.
 *
 * Rollout mode: VITE_WORKFLOW_CLOUD_PERSISTENCE_MODE
 *   - off | canary | all
 *   - Missing / empty / unknown / malformed → off
 *   - Master alone must NOT globally activate cloud; callers must use eligibility.
 *
 * Also requires Supabase configuration. No query param or UI control.
 *
 * Proposed Production canary (NOT ENABLED BY THIS COMMIT):
 *   VITE_WORKFLOW_CLOUD_PERSISTENCE=true
 *   VITE_WORKFLOW_CLOUD_PERSISTENCE_MODE=canary
 *   VITE_EXISTING_USER_LOGIN_ENABLED=true
 *   (signup remains disabled under public mode)
 */

import { supabaseEnvConfigured } from '../lib/supabaseClient'

export type WorkflowCloudPersistenceMode = 'off' | 'canary' | 'all'

export type WorkflowCloudPersistenceInput = {
	/** Raw VITE_WORKFLOW_CLOUD_PERSISTENCE value. */
	envFlag?: string
	/** Whether Supabase URL + anon key are configured. */
	supabaseConfigured?: boolean
}

export type WorkflowCloudPersistenceModeInput = {
	/** Raw VITE_WORKFLOW_CLOUD_PERSISTENCE_MODE value. */
	envMode?: string
}

function readEnvFlag(): string {
	if (typeof import.meta !== 'undefined' && import.meta.env) {
		const raw = import.meta.env.VITE_WORKFLOW_CLOUD_PERSISTENCE
		if (raw === undefined || raw === null) return ''
		return String(raw)
	}
	return ''
}

function readEnvMode(): string {
	if (typeof import.meta !== 'undefined' && import.meta.env) {
		const raw = import.meta.env.VITE_WORKFLOW_CLOUD_PERSISTENCE_MODE
		if (raw === undefined || raw === null) return ''
		return String(raw)
	}
	return ''
}

/**
 * Master kill switch: true only when the env flag is exactly `"true"` AND Supabase is configured.
 * Case-sensitive: `"TRUE"` / `"True"` do not enable.
 * This alone does not activate cloud persistence — combine with mode + eligibility.
 */
export function isWorkflowCloudPersistenceEnabled(
	input: WorkflowCloudPersistenceInput = {}
): boolean {
	const flag = input.envFlag ?? readEnvFlag()
	if (flag !== 'true') return false
	const configured = input.supabaseConfigured ?? supabaseEnvConfigured
	return Boolean(configured)
}

/**
 * Parse rollout mode. Missing, empty, whitespace-only, or unknown → `'off'`.
 * Comparison is case-insensitive after trim (e.g. `" Canary "` → `'canary'`).
 */
export function parseWorkflowCloudPersistenceMode(
	raw: string | undefined | null
): WorkflowCloudPersistenceMode {
	if (raw === undefined || raw === null) return 'off'
	const normalized = String(raw).trim().toLowerCase()
	if (normalized === 'canary') return 'canary'
	if (normalized === 'all') return 'all'
	if (normalized === 'off') return 'off'
	return 'off'
}

/** Read and parse VITE_WORKFLOW_CLOUD_PERSISTENCE_MODE (safe default: off). */
export function getWorkflowCloudPersistenceMode(
	input: WorkflowCloudPersistenceModeInput = {}
): WorkflowCloudPersistenceMode {
	return parseWorkflowCloudPersistenceMode(input.envMode ?? readEnvMode())
}
