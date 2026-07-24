import { describe, expect, it } from 'vitest'
import {
	destinationForPath,
	pathForTab,
	resolveAppPath,
	UNKNOWN_APP_FALLBACK,
} from '../appRoutes'

describe('appRoutes resolveAppPath', () => {
	it('redirects /app to /app/today', () => {
		const r = resolveAppPath('/app')
		expect(r.redirectTo).toBe('/app/today')
		expect(r.tab).toBe('Dashboard')
		expect(r.destination).toBe('today')
	})

	it('maps primary defaults', () => {
		expect(resolveAppPath('/app/passport').redirectTo).toBe('/app/passport/profile')
		expect(resolveAppPath('/app/recruiting').redirectTo).toBe('/app/recruiting/search')
		expect(resolveAppPath('/app/opportunities').redirectTo).toBe('/app/opportunities/pipeline')
		expect(resolveAppPath('/app/learn').redirectTo).toBe('/app/learn/nil-hub')
	})

	it('maps leaf routes to tabs and parent destinations', () => {
		expect(resolveAppPath('/app/recruiting/board')).toMatchObject({
			tab: 'Recruiting Board',
			destination: 'recruiting',
			known: true,
		})
		expect(resolveAppPath('/app/opportunities/deals')).toMatchObject({
			tab: 'Deals',
			destination: 'opportunities',
		})
		expect(resolveAppPath('/app/passport/public')).toMatchObject({
			tab: 'Profile Preview',
			destination: 'passport',
		})
		expect(resolveAppPath('/app/network')).toMatchObject({
			tab: 'Network',
			destination: 'network',
		})
		expect(resolveAppPath('/app/career')).toMatchObject({
			tab: 'Career Studio',
			destination: 'career',
		})
	})

	it('falls back unknown /app paths to Today', () => {
		const r = resolveAppPath('/app/does-not-exist')
		expect(r.redirectTo).toBe(UNKNOWN_APP_FALLBACK)
		expect(r.destination).toBe('today')
		expect(r.known).toBe(false)
	})

	it('pathForTab and destinationForPath stay aligned', () => {
		expect(pathForTab('Recruiting Blast')).toBe('/app/recruiting/blast')
		expect(destinationForPath('/app/learn/guidelines')).toBe('learn')
		expect(destinationForPath('/app/today/welcome')).toBe('today')
	})
})
