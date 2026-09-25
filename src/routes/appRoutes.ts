/**
 * Canonical NIL Roster application routes under /app/*.
 * Single source of truth for pathname ↔ Tab ↔ parent destination.
 */

export type AppDestination =
	| 'today'
	| 'passport'
	| 'recruiting'
	| 'network'
	| 'opportunities'
	| 'career'
	| 'learn'
	| 'settings'

/** Existing App.tsx Tab values that can appear in the authenticated shell. */
export type AppTab =
	| 'Welcome'
	| 'Athlete'
	| 'Businesses'
	| 'Discover'
	| 'Matches'
	| 'Deals'
	| 'Opportunities'
	| 'Events'
	| 'Dashboard'
	| 'Profile Preview'
	| 'Resources'
	| 'Guidelines'
	| 'NIL Hub'
	| 'Vendor Directory'
	| 'Recruiting'
	| 'Recruiting Board'
	| 'Outreach Drafts'
	| 'Settings'
	| 'Extras'
	| 'Network'
	| 'Career Studio'
	| 'Sign Up'
	| 'Log In'

export type AppRouteDef = {
	path: string
	tab: AppTab
	destination: AppDestination
}

/** Explicit leaf routes (no redirects). */
export const APP_ROUTES: readonly AppRouteDef[] = [
	{ path: '/app/today', tab: 'Dashboard', destination: 'today' },
	{ path: '/app/today/welcome', tab: 'Welcome', destination: 'today' },

	{ path: '/app/passport/profile', tab: 'Athlete', destination: 'passport' },
	{ path: '/app/passport/public', tab: 'Profile Preview', destination: 'passport' },

	{ path: '/app/recruiting/search', tab: 'Recruiting', destination: 'recruiting' },
	{ path: '/app/recruiting/board', tab: 'Recruiting Board', destination: 'recruiting' },
	{ path: '/app/recruiting/drafts', tab: 'Outreach Drafts', destination: 'recruiting' },

	{ path: '/app/network', tab: 'Network', destination: 'network' },

	{ path: '/app/opportunities/businesses', tab: 'Businesses', destination: 'opportunities' },
	{ path: '/app/opportunities/discover', tab: 'Discover', destination: 'opportunities' },
	{ path: '/app/opportunities/matches', tab: 'Matches', destination: 'opportunities' },
	{ path: '/app/opportunities/pipeline', tab: 'Opportunities', destination: 'opportunities' },
	{ path: '/app/opportunities/deals', tab: 'Deals', destination: 'opportunities' },
	{ path: '/app/opportunities/events', tab: 'Events', destination: 'opportunities' },

	{ path: '/app/career', tab: 'Career Studio', destination: 'career' },
	{ path: '/app/career/legacy-extras', tab: 'Extras', destination: 'career' },

	{ path: '/app/learn/nil-hub', tab: 'NIL Hub', destination: 'learn' },
	{ path: '/app/learn/resources', tab: 'Resources', destination: 'learn' },
	{ path: '/app/learn/guidelines', tab: 'Guidelines', destination: 'learn' },
	{ path: '/app/learn/vendors', tab: 'Vendor Directory', destination: 'learn' },

	{ path: '/app/settings', tab: 'Settings', destination: 'settings' },
] as const

/** Parent path → default leaf (replaceState). */
export const APP_DEFAULT_REDIRECTS: Readonly<Record<string, string>> = {
	'/app': '/app/today',
	'/app/': '/app/today',
	'/app/passport': '/app/passport/profile',
	'/app/passport/': '/app/passport/profile',
	'/app/recruiting': '/app/recruiting/search',
	'/app/recruiting/': '/app/recruiting/search',
	// Legacy Recruiting Blast URL stays valid as an alias.
	'/app/recruiting/blast': '/app/recruiting/drafts',
	'/app/recruiting/blast/': '/app/recruiting/drafts',
	'/app/opportunities': '/app/opportunities/pipeline',
	'/app/opportunities/': '/app/opportunities/pipeline',
	'/app/learn': '/app/learn/nil-hub',
	'/app/learn/': '/app/learn/nil-hub',
}

export const UNKNOWN_APP_FALLBACK = '/app/today'

export type NavItem = {
	destination: AppDestination
	label: string
	/** Default path when selecting this destination from global nav. */
	path: string
}

export const PRIMARY_NAV: readonly NavItem[] = [
	{ destination: 'today', label: 'Today', path: '/app/today' },
	{ destination: 'passport', label: 'Athlete Passport', path: '/app/passport/profile' },
	{ destination: 'recruiting', label: 'Recruiting', path: '/app/recruiting/search' },
	{ destination: 'network', label: 'Network', path: '/app/network' },
	{ destination: 'opportunities', label: 'Opportunities', path: '/app/opportunities/pipeline' },
	{ destination: 'career', label: 'Career Studio', path: '/app/career' },
]

export const SECONDARY_NAV: readonly NavItem[] = [
	{ destination: 'learn', label: 'Learn & Support', path: '/app/learn/nil-hub' },
	{ destination: 'settings', label: 'Settings', path: '/app/settings' },
]

/** Athlete beta: first-order navigation stays to four destinations. */
export const ATHLETE_PRIMARY_NAV: readonly NavItem[] = PRIMARY_NAV.filter(n =>
	(['today', 'passport', 'recruiting', 'opportunities'] as AppDestination[]).includes(n.destination),
)

/** Athlete beta: kept reachable under "More / Explore" instead of first-order nav. */
export const EXPLORE_NAV: readonly NavItem[] = [
	...PRIMARY_NAV.filter(n => n.destination === 'network' || n.destination === 'career'),
	...SECONDARY_NAV.filter(n => n.destination === 'learn'),
]

export const ACCOUNT_NAV: readonly NavItem[] = SECONDARY_NAV.filter(n => n.destination === 'settings')

export type AppNavSection = {
	title: string
	/** Rendered collapsed until opened or until one of its destinations is active. */
	collapsible?: boolean
	items: Array<{ key: string; label: string; path: string }>
}

function toItems(items: readonly NavItem[]) {
	return items.map(n => ({ key: n.destination, label: n.label, path: n.path }))
}

/** First-order destinations for the bottom bar / primary list. */
export function getPrimaryNav(options: { athleteExperience?: boolean } = {}): readonly NavItem[] {
	return options.athleteExperience ? ATHLETE_PRIMARY_NAV : PRIMARY_NAV
}

/** Shared sidebar / mobile menu sections (single definition). */
export function getAppNavSections(options: { athleteExperience?: boolean } = {}): AppNavSection[] {
	if (options.athleteExperience) {
		return [
			{ title: 'Primary', items: toItems(ATHLETE_PRIMARY_NAV) },
			{ title: 'More / Explore', collapsible: true, items: toItems(EXPLORE_NAV) },
			{ title: 'Account', items: toItems(ACCOUNT_NAV) },
		]
	}
	return [
		{ title: 'Primary', items: toItems(PRIMARY_NAV) },
		{ title: 'Secondary', items: toItems(SECONDARY_NAV) },
	]
}

export type RecruitingSubnavItem = {
	path: string
	label: string
	testId: string
}

export const RECRUITING_SUBNAV: readonly RecruitingSubnavItem[] = [
	{ path: '/app/recruiting/search', label: 'Search', testId: 'search' },
	{ path: '/app/recruiting/board', label: 'Board', testId: 'board' },
	{ path: '/app/recruiting/drafts', label: 'Outreach Drafts', testId: 'drafts' },
]

export type OpportunitiesSubnavItem = {
	path: string
	label: string
	tab: AppTab
}

export const OPPORTUNITIES_SUBNAV: readonly OpportunitiesSubnavItem[] = [
	{ path: '/app/opportunities/pipeline', label: 'Pipeline', tab: 'Opportunities' },
	{ path: '/app/opportunities/businesses', label: 'Businesses', tab: 'Businesses' },
	{ path: '/app/opportunities/discover', label: 'Discover', tab: 'Discover' },
	{ path: '/app/opportunities/matches', label: 'Matches', tab: 'Matches' },
	{ path: '/app/opportunities/deals', label: 'Deals', tab: 'Deals' },
	{ path: '/app/opportunities/events', label: 'Events', tab: 'Events' },
]

const pathToRoute = new Map(APP_ROUTES.map(r => [r.path, r]))
const tabToPath = new Map(APP_ROUTES.map(r => [r.tab, r.path]))

export type ResolvedAppRoute = {
	pathname: string
	tab: AppTab
	destination: AppDestination
	/** When set, caller should replaceState to this path. */
	redirectTo?: string
	known: boolean
}

function normalizePathname(pathname: string): string {
	if (!pathname) return '/'
	if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1)
	return pathname
}

export function isAppPathname(pathname: string): boolean {
	return pathname === '/app' || pathname.startsWith('/app/')
}

/**
 * Resolve an /app pathname to tab + parent destination.
 * Non-/app paths are not handled here.
 */
export function resolveAppPath(pathname: string): ResolvedAppRoute {
	const raw = pathname || '/'
	const path = normalizePathname(raw)

	if (!isAppPathname(path)) {
		return {
			pathname: path,
			tab: 'Dashboard',
			destination: 'today',
			redirectTo: UNKNOWN_APP_FALLBACK,
			known: false,
		}
	}

	const defaultTarget = APP_DEFAULT_REDIRECTS[path] ?? APP_DEFAULT_REDIRECTS[raw]
	if (defaultTarget) {
		const leaf = pathToRoute.get(defaultTarget)!
		return {
			pathname: path,
			tab: leaf.tab,
			destination: leaf.destination,
			redirectTo: defaultTarget,
			known: true,
		}
	}

	const exact = pathToRoute.get(path)
	if (exact) {
		return {
			pathname: path,
			tab: exact.tab,
			destination: exact.destination,
			known: true,
		}
	}

	// Unknown /app/* → Today (safe, no public 404 loop)
	return {
		pathname: path,
		tab: 'Dashboard',
		destination: 'today',
		redirectTo: UNKNOWN_APP_FALLBACK,
		known: false,
	}
}

export function pathForTab(tab: AppTab): string | null {
	return tabToPath.get(tab) ?? null
}

export function destinationForPath(pathname: string): AppDestination {
	return resolveAppPath(pathname).destination
}

export function navPathForDestination(destination: AppDestination): string {
	const fromPrimary = PRIMARY_NAV.find(n => n.destination === destination)
	if (fromPrimary) return fromPrimary.path
	const fromSecondary = SECONDARY_NAV.find(n => n.destination === destination)
	if (fromSecondary) return fromSecondary.path
	return UNKNOWN_APP_FALLBACK
}
