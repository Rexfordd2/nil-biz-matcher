import { describe, expect, it } from 'vitest'
import { readWorkflowCloudPersistenceCanary } from '../workflowCanaryClaim'
import { mapSupabaseUserToCurrent } from '../mapSupabaseUser'

describe('readWorkflowCloudPersistenceCanary', () => {
	it('missing claim → false', () => {
		expect(readWorkflowCloudPersistenceCanary(undefined)).toBe(false)
		expect(readWorkflowCloudPersistenceCanary(null)).toBe(false)
		expect(readWorkflowCloudPersistenceCanary({})).toBe(false)
	})

	it('false → false', () => {
		expect(
			readWorkflowCloudPersistenceCanary({ workflow_cloud_persistence_canary: false })
		).toBe(false)
	})

	it('exact true → true', () => {
		expect(
			readWorkflowCloudPersistenceCanary({ workflow_cloud_persistence_canary: true })
		).toBe(true)
	})

	it('string "true" → false', () => {
		expect(
			readWorkflowCloudPersistenceCanary({ workflow_cloud_persistence_canary: 'true' })
		).toBe(false)
	})

	it('numeric 1 → false', () => {
		expect(
			readWorkflowCloudPersistenceCanary({ workflow_cloud_persistence_canary: 1 })
		).toBe(false)
	})
})

describe('mapSupabaseUserToCurrent (AuthContext claim mapping)', () => {
	it('copies claim only from app_metadata', () => {
		const mapped = mapSupabaseUserToCurrent({
			id: 'u1',
			email: 'a@example.invalid',
			app_metadata: { workflow_cloud_persistence_canary: true },
			user_metadata: { full_name: 'A', role: 'athlete' },
		})
		expect(mapped?.workflowCloudPersistenceCanary).toBe(true)
	})

	it('user_metadata true does not grant claim', () => {
		const mapped = mapSupabaseUserToCurrent({
			id: 'u1',
			email: 'a@example.invalid',
			app_metadata: {},
			user_metadata: { workflow_cloud_persistence_canary: true, full_name: 'A' },
		})
		expect(mapped?.workflowCloudPersistenceCanary).toBe(false)
	})

	it('string true in app_metadata → false', () => {
		const mapped = mapSupabaseUserToCurrent({
			id: 'u1',
			email: 'a@example.invalid',
			app_metadata: { workflow_cloud_persistence_canary: 'true' },
		})
		expect(mapped?.workflowCloudPersistenceCanary).toBe(false)
	})

	it('missing claim → false', () => {
		const mapped = mapSupabaseUserToCurrent({
			id: 'u1',
			email: 'a@example.invalid',
		})
		expect(mapped?.workflowCloudPersistenceCanary).toBe(false)
	})

	it('null user → null (sign-out reset path)', () => {
		expect(mapSupabaseUserToCurrent(null)).toBe(null)
		expect(mapSupabaseUserToCurrent(undefined)).toBe(null)
	})

	it('session change updates claim', () => {
		const before = mapSupabaseUserToCurrent({
			id: 'u1',
			email: 'a@example.invalid',
			app_metadata: {},
		})
		const after = mapSupabaseUserToCurrent({
			id: 'u1',
			email: 'a@example.invalid',
			app_metadata: { workflow_cloud_persistence_canary: true },
		})
		expect(before?.workflowCloudPersistenceCanary).toBe(false)
		expect(after?.workflowCloudPersistenceCanary).toBe(true)
	})

	it('mock / incomplete users default false', () => {
		const mapped = mapSupabaseUserToCurrent({
			id: 'mock-1',
			email: 'mock@example.invalid',
			user_metadata: { full_name: 'Mock' },
		})
		expect(mapped?.workflowCloudPersistenceCanary).toBe(false)
	})

	it('does not expose raw app_metadata on CurrentUser', () => {
		const mapped = mapSupabaseUserToCurrent({
			id: 'u1',
			email: 'a@example.invalid',
			app_metadata: {
				workflow_cloud_persistence_canary: true,
				provider: 'email',
				secret_flag: 'nope',
			},
		})
		expect(mapped).not.toHaveProperty('app_metadata')
		expect(Object.keys(mapped || {})).not.toContain('app_metadata')
		expect(mapped?.workflowCloudPersistenceCanary).toBe(true)
	})
})

describe('E2E bypass cannot manufacture canary claim', () => {
	it('localStorage / query-shaped objects are not auth users', () => {
		expect(
			mapSupabaseUserToCurrent({
				workflow_cloud_persistence_canary: true,
				app_metadata: { workflow_cloud_persistence_canary: 'true' },
			})
		).toBe(null)
	})

	it('isLocalE2EAuthBypassAllowed path has no claim field without real session mapping', () => {
		// Bypass grants route access only; CurrentUser without session stays null / no claim.
		const withoutSession = mapSupabaseUserToCurrent(null)
		expect(withoutSession).toBe(null)
	})
})
