/**
 * Controlled rollout flag for workflow cloud persistence (opportunities, deals, events).
 *
 * Default absent → false. Only exact string "true" enables.
 * Also requires Supabase configuration. No query param or UI control.
 * PR-4B1 wires live components behind this flag; production default remains false.
 */

import { supabaseEnvConfigured } from '../lib/supabaseClient'

export type WorkflowCloudPersistenceInput = {
	/** Raw VITE_WORKFLOW_CLOUD_PERSISTENCE value. */
	envFlag?: string
	/** Whether Supabase URL + anon key are configured. */
	supabaseConfigured?: boolean
}

function readEnvFlag(): string {
	if (typeof import.meta !== 'undefined' && import.meta.env) {
		const raw = import.meta.env.VITE_WORKFLOW_CLOUD_PERSISTENCE
		if (raw === undefined || raw === null) return ''
		return String(raw)
	}
	return ''
}

/**
 * Returns true only when the env flag is exactly `"true"` AND Supabase is configured.
 * Case-sensitive: `"TRUE"` / `"True"` do not enable.
 */
export function isWorkflowCloudPersistenceEnabled(
	input: WorkflowCloudPersistenceInput = {}
): boolean {
	const flag = input.envFlag ?? readEnvFlag()
	if (flag !== 'true') return false
	const configured = input.supabaseConfigured ?? supabaseEnvConfigured
	return Boolean(configured)
}
