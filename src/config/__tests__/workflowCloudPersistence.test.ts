import { describe, expect, it } from 'vitest'
import {
	getWorkflowCloudPersistenceMode,
	isWorkflowCloudPersistenceEnabled,
	parseWorkflowCloudPersistenceMode,
} from '../workflowCloudPersistence'

describe('isWorkflowCloudPersistenceEnabled (master kill switch)', () => {
	it('returns false when master is absent', () => {
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

	it('returns false when master is "false"', () => {
		expect(
			isWorkflowCloudPersistenceEnabled({
				envFlag: 'false',
				supabaseConfigured: true,
			})
		).toBe(false)
	})

	it('returns true when master is exactly "true" and Supabase is configured', () => {
		expect(
			isWorkflowCloudPersistenceEnabled({
				envFlag: 'true',
				supabaseConfigured: true,
			})
		).toBe(true)
	})

	it('returns false when master is true but Supabase is not configured', () => {
		expect(
			isWorkflowCloudPersistenceEnabled({
				envFlag: 'true',
				supabaseConfigured: false,
			})
		).toBe(false)
	})
})

describe('parseWorkflowCloudPersistenceMode / getWorkflowCloudPersistenceMode', () => {
	it('resolves absent / empty / whitespace to off', () => {
		expect(parseWorkflowCloudPersistenceMode(undefined)).toBe('off')
		expect(parseWorkflowCloudPersistenceMode(null)).toBe('off')
		expect(parseWorkflowCloudPersistenceMode('')).toBe('off')
		expect(parseWorkflowCloudPersistenceMode('   ')).toBe('off')
		expect(getWorkflowCloudPersistenceMode({ envMode: undefined })).toBe('off')
		expect(getWorkflowCloudPersistenceMode({ envMode: '' })).toBe('off')
	})

	it('parses off / canary / all', () => {
		expect(parseWorkflowCloudPersistenceMode('off')).toBe('off')
		expect(parseWorkflowCloudPersistenceMode('canary')).toBe('canary')
		expect(parseWorkflowCloudPersistenceMode('all')).toBe('all')
	})

	it('accepts uppercase and surrounding whitespace', () => {
		expect(parseWorkflowCloudPersistenceMode('OFF')).toBe('off')
		expect(parseWorkflowCloudPersistenceMode(' Canary ')).toBe('canary')
		expect(parseWorkflowCloudPersistenceMode('ALL')).toBe('all')
	})

	it('resolves unknown / malformed modes to off', () => {
		expect(parseWorkflowCloudPersistenceMode('maybe')).toBe('off')
		expect(parseWorkflowCloudPersistenceMode('true')).toBe('off')
		expect(parseWorkflowCloudPersistenceMode('1')).toBe('off')
		expect(parseWorkflowCloudPersistenceMode('canary-all')).toBe('off')
		expect(parseWorkflowCloudPersistenceMode('{canary}')).toBe('off')
	})
})
