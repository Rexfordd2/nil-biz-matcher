import { describe, expect, it } from 'vitest'
import { isLocalE2EAuthBypassAllowed } from '../e2e'

describe('isLocalE2EAuthBypassAllowed', () => {
	it('requires VITE_E2E_BYPASS_AUTH === "true"', () => {
		expect(
			isLocalE2EAuthBypassAllowed({
				envFlag: 'false',
				hostname: 'localhost',
				hasWindow: true,
			})
		).toBe(false)
		expect(
			isLocalE2EAuthBypassAllowed({
				envFlag: '',
				hostname: 'localhost',
				hasWindow: true,
			})
		).toBe(false)
		expect(
			isLocalE2EAuthBypassAllowed({
				envFlag: 'true',
				hostname: 'localhost',
				hasWindow: true,
			})
		).toBe(true)
	})

	it('allows only loopback hostnames when flag is set', () => {
		for (const hostname of ['localhost', '127.0.0.1', '::1']) {
			expect(
				isLocalE2EAuthBypassAllowed({
					envFlag: 'true',
					hostname,
					hasWindow: true,
				})
			).toBe(true)
		}
	})

	it('rejects remote, LAN, and deployed hostnames even with flag set', () => {
		const blocked = [
			'athlete-ledger.vercel.app',
			'athletehouze.com',
			'nil-biz-matcher.workers.dev',
			'192.168.1.10',
			'10.0.0.5',
			'example.com',
			'',
		]
		for (const hostname of blocked) {
			expect(
				isLocalE2EAuthBypassAllowed({
					envFlag: 'true',
					hostname,
					hasWindow: true,
				})
			).toBe(false)
		}
	})

	it('returns false without a browser window (SSR / non-browser)', () => {
		expect(
			isLocalE2EAuthBypassAllowed({
				envFlag: 'true',
				hostname: 'localhost',
				hasWindow: false,
			})
		).toBe(false)
	})

	it('is case-insensitive for hostname and flag', () => {
		expect(
			isLocalE2EAuthBypassAllowed({
				envFlag: 'TRUE',
				hostname: 'LocalHost',
				hasWindow: true,
			})
		).toBe(true)
	})
})
