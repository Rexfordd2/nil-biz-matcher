import { describe, expect, it } from 'vitest'
import { resolveAppMode } from '../appMode'

describe('resolveAppMode', () => {
	it('honors explicit demo and beta', () => {
		expect(resolveAppMode({ appModeFlag: 'demo', publicMode: true })).toBe('demo')
		expect(resolveAppMode({ appModeFlag: 'beta', publicMode: true })).toBe('beta')
		expect(resolveAppMode({ appModeFlag: 'BETA', publicMode: false })).toBe('beta')
	})

	it('defaults to demo when public mode is true and app mode is absent', () => {
		expect(resolveAppMode({ publicMode: true })).toBe('demo')
		expect(resolveAppMode({ appModeFlag: '', publicMode: true })).toBe('demo')
	})

	it('defaults to beta when public mode is false and app mode is absent', () => {
		expect(resolveAppMode({ publicMode: false })).toBe('beta')
		expect(resolveAppMode({})).toBe('beta')
	})
})
