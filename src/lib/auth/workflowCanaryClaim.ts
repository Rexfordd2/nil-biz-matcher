/**
 * Admin-controlled Auth app_metadata canary claim for workflow cloud persistence.
 *
 * Rollout-control boundary only — RLS remains the data-security boundary.
 * Ordinary users can edit portions of user metadata (user_metadata); never read the claim from there.
 * Exact boolean `true` only. Strings/numbers/other truthy values do not count.
 */

export const WORKFLOW_CLOUD_PERSISTENCE_CANARY_KEY = 'workflow_cloud_persistence_canary' as const

/**
 * Read the canary claim from Supabase Auth `app_metadata` only.
 * Never reads `user_metadata`. Never writes metadata.
 */
export function readWorkflowCloudPersistenceCanary(
	appMetadata: unknown
): boolean {
	if (!appMetadata || typeof appMetadata !== 'object' || Array.isArray(appMetadata)) {
		return false
	}
	const value = (appMetadata as Record<string, unknown>)[WORKFLOW_CLOUD_PERSISTENCE_CANARY_KEY]
	return value === true
}
