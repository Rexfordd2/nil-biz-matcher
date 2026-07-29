import type { CurrentUser } from '../../utils/auth'
import { readWorkflowCloudPersistenceCanary } from './workflowCanaryClaim'

/**
 * Map a Supabase Auth user (or session user) to the app CurrentUser shape.
 * Retains only the sanitized canary boolean from app_metadata — never raw metadata.
 */
export function mapSupabaseUserToCurrent(userLike: unknown | null | undefined): CurrentUser | null {
	if (!userLike || typeof userLike !== 'object') return null
	const su = userLike as {
		id?: unknown
		email?: unknown
		user_metadata?: Record<string, unknown> | null
		app_metadata?: unknown
	}
	if (typeof su.id !== 'string' || !su.id) return null

	const userMeta = su.user_metadata && typeof su.user_metadata === 'object' ? su.user_metadata : {}

	return {
		id: su.id,
		email: typeof su.email === 'string' ? su.email : '',
		fullName:
			(typeof userMeta.full_name === 'string' && userMeta.full_name) ||
			(typeof su.email === 'string' && su.email) ||
			'User',
		role: (typeof userMeta.role === 'string' && userMeta.role) || 'athlete',
		marketingConsent: Boolean(userMeta.marketingConsent),
		// Exact app_metadata boolean only — user_metadata must not affect this.
		workflowCloudPersistenceCanary: readWorkflowCloudPersistenceCanary(su.app_metadata),
	}
}
