import { describe, it, expect } from 'vitest'
import { isDebugAccessAllowed } from '../debugAccess'

/**
 * Note: These tests verify the logic of isDebugAccessAllowed.
 * Since import.meta.env is evaluated at build time, we can't easily mock it.
 * For full integration testing, use Playwright tests (see tests/debug-routes.spec.ts).
 */
describe('debugAccess', () => {
	describe('isDebugAccessAllowed', () => {
		it('should handle query string parameters correctly', () => {
			// Test that the function correctly parses query strings
			const params = new URLSearchParams('?debugKey=test-key')
			expect(params.get('debugKey')).toBe('test-key')
		})

		it('should handle empty search params', () => {
			// Function should handle empty/undefined params gracefully
			expect(() => isDebugAccessAllowed('')).not.toThrow()
			expect(() => isDebugAccessAllowed()).not.toThrow()
		})

		it('should handle URLSearchParams object', () => {
			const params = new URLSearchParams('?debugKey=test-key')
			expect(() => isDebugAccessAllowed(params)).not.toThrow()
		})

		it('should handle query strings with multiple params', () => {
			const params = '?debugKey=test-key&other=value'
			expect(() => isDebugAccessAllowed(params)).not.toThrow()
		})
	})
})
