import { isCloudEligibleAthleteId, type ActiveAthleteId } from './athleteIdentity'
import type { WorkflowCloudPersistenceMode } from '../../config/workflowCloudPersistence'

/**
 * Pure evaluator for account-level workflow cloud-persistence eligibility.
 * No env access, no Supabase calls, no storage, no PII.
 */

export type WorkflowCloudEligibilityInput = {
	masterEnabled: boolean
	mode: WorkflowCloudPersistenceMode
	authenticated: boolean
	athleteId: ActiveAthleteId
	workflowCloudPersistenceCanary: boolean
}

export type WorkflowCloudEligibilityReason =
	| 'master_off'
	| 'mode_off'
	| 'signed_out'
	| 'invalid_athlete'
	| 'canary_claim_missing'
	| 'canary'
	| 'all'

export type WorkflowCloudEligibilityResult = {
	enabled: boolean
	reason: WorkflowCloudEligibilityReason
}

/**
 * Deterministic eligibility for Opportunities / Deals / Events cloud persistence.
 * Master kill switch always wins. Missing/invalid mode is expected to arrive as `'off'`.
 */
export function evaluateWorkflowCloudEligibility(
	input: WorkflowCloudEligibilityInput
): WorkflowCloudEligibilityResult {
	if (!input.masterEnabled) {
		return { enabled: false, reason: 'master_off' }
	}

	if (input.mode === 'off') {
		return { enabled: false, reason: 'mode_off' }
	}

	if (!input.authenticated) {
		return { enabled: false, reason: 'signed_out' }
	}

	if (!isCloudEligibleAthleteId(input.athleteId)) {
		return { enabled: false, reason: 'invalid_athlete' }
	}

	if (input.mode === 'canary') {
		if (input.workflowCloudPersistenceCanary !== true) {
			return { enabled: false, reason: 'canary_claim_missing' }
		}
		return { enabled: true, reason: 'canary' }
	}

	// mode === 'all'
	return { enabled: true, reason: 'all' }
}
