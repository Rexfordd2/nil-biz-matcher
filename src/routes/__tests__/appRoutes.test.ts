import { describe, expect, it } from 'vitest'
import {
	destinationForPath,
	getAppNavSections,
	getPrimaryNav,
	PRIMARY_NAV,
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
		expect(pathForTab('Outreach Drafts')).toBe('/app/recruiting/drafts')
		expect(destinationForPath('/app/learn/guidelines')).toBe('learn')
		expect(destinationForPath('/app/today/welcome')).toBe('today')
	})
})

describe('athlete beta wayfinding routes', () => {
	it('keeps the legacy Recruiting Blast URL as an alias for Outreach Drafts', () => {
		for (const legacy of ['/app/recruiting/blast', '/app/recruiting/blast/']) {
			const r = resolveAppPath(legacy)
			expect(r.redirectTo).toBe('/app/recruiting/drafts')
			expect(r.tab).toBe('Outreach Drafts')
			expect(r.destination).toBe('recruiting')
			expect(r.known).toBe(true)
		}
		expect(resolveAppPath('/app/recruiting/drafts')).toMatchObject({ tab: 'Outreach Drafts', known: true })
	})

	it('reduces athlete first-order navigation to four destinations', () => {
		expect(getPrimaryNav({ athleteExperience: true }).map(n => n.label)).toEqual([
			'Today',
			'Athlete Passport',
			'Recruiting',
			'Opportunities',
		])
		const sections = getAppNavSections({ athleteExperience: true })
		expect(sections.map(s => s.title)).toEqual(['Primary', 'More / Explore', 'Account'])
		const explore = sections.find(s => s.title === 'More / Explore')!
		expect(explore.collapsible).toBe(true)
		expect(explore.items.map(i => i.label)).toEqual(['Network', 'Career Studio', 'Learn & Support'])
	})

	it('keeps every destination reachable (no routes removed)', () => {
		const athleteKeys = getAppNavSections({ athleteExperience: true }).flatMap(s => s.items.map(i => i.key))
		const fullKeys = getAppNavSections().flatMap(s => s.items.map(i => i.key))
		expect(new Set(athleteKeys)).toEqual(new Set(fullKeys))
		for (const path of ['/app/network', '/app/career', '/app/learn/nil-hub', '/app/settings']) {
			expect(resolveAppPath(path).known).toBe(true)
		}
	})

	it('non-athlete roles keep the full primary navigation', () => {
		expect(getPrimaryNav({ athleteExperience: false })).toBe(PRIMARY_NAV)
	})
})
