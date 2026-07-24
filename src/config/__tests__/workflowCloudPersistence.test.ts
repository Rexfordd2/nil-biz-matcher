import { describe, expect, it } from 'vitest'
import { isWorkflowCloudPersistenceEnabled } from '../workflowCloudPersistence'

describe('isWorkflowCloudPersistenceEnabled', () => {
	it('returns false when flag is absent', () => {
		expect(
			isWorkflowCloudPersistenceEnabled({
				envFlag: '',
				supabaseConfigured: true,
			})
		).toBe(false)
		expect(
			isWorkflowCloudPersistenceEnabled({
				envFlag: undefined,
				supabaseConfigured: true,
			})
		).toBe(false)
	})

	it('returns false when flag is "false"', () => {
		expect(
			isWorkflowCloudPersistenceEnabled({
				envFlag: 'false',
				supabaseConfigured: true,
			})
		).toBe(false)
	})

	it('returns false when flag is "TRUE" (case-sensitive exact match required)', () => {
		expect(
			isWorkflowCloudPersistenceEnabled({
				envFlag: 'TRUE',
				supabaseConfigured: true,
			})
		).toBe(false)
	})

	it('returns false when flag is "1" or other truthy-like strings', () => {
		expect(
			isWorkflowCloudPersistenceEnabled({
				envFlag: '1',
				supabaseConfigured: true,
			})
		).toBe(false)
		expect(
			isWorkflowCloudPersistenceEnabled({
				envFlag: 'yes',
				supabaseConfigured: true,
			})
		).toBe(false)
	})

	it('returns false when flag is true but Supabase is not configured', () => {
		expect(
			isWorkflowCloudPersistenceEnabled({
				envFlag: 'true',
				supabaseConfigured: false,
			})
		).toBe(false)
	})

	it('returns true only when flag is exactly "true" and Supabase is configured', () => {
		expect(
			isWorkflowCloudPersistenceEnabled({
				envFlag: 'true',
				supabaseConfigured: true,
			})
		).toBe(true)
	})
})
