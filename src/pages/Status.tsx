import { TERMS_VERSION } from '../constants/legal'
import { BUILD_ID } from '../config/env'
import { useEffect, useState } from 'react'
import { supabase, supabaseEnvConfigured } from '../lib/supabaseClient'
import { friendlyMessageForProfilesError } from '../lib/supabaseErrors'

const BUILD_TIME: string = (import.meta.env.VITE_BUILD_TIME as string) || 'unknown'
const ENV_MODE: string = (import.meta.env.VITE_ENV as string) || (import.meta.env.PROD ? 'prod' : import.meta.env.MODE || 'dev')

const LIVE_FEATURES: string[] = [
	'Public homepage at `/` with hero video + how-to steps + CTAs',
	'Anonymous-accessible app under `/app/*` (login optional, not required)',
	'Terms acceptance required on signup + Terms/Privacy pages',
	'Role selection + minors guardian acknowledgment',
	'Onboarding quickstart + reopen link',
	'Password UX: show/hide, confirm, forgot password + `/auth/reset`',
	'Disclaimer banner on Vendor Directory + NIL Hub',
	'Training log moved to Extras'
]

// Edit this array whenever we need to communicate beta limitations
const KNOWN_LIMITATIONS: string[] = [
	'Vendor discovery limited to local search; national brand outreach in development',
	'Email/SMS notifications are basic; richer templates and preferences pending',
	'Some pages use placeholder educational copy; polishing in progress'
]

export default function Status() {
	const [profilesHealth, setProfilesHealth] = useState<'unknown' | 'present' | 'missing' | 'not_configured' | 'error'>('unknown')
	const [profilesDetail, setProfilesDetail] = useState<string>('')
	const [sessionPresent, setSessionPresent] = useState<boolean | null>(null)
	const [routeInfo] = useState<{ path: string; search: string; returnTo: string | null }>(() => {
		const path = window.location.pathname
		const search = window.location.search
		const sp = new URLSearchParams(search)
		const rt = sp.get('returnTo')
		return { path, search, returnTo: rt }
	})

	useEffect(() => {
		let mounted = true
		;(async () => {
			if (!supabaseEnvConfigured || !supabase) {
				if (!mounted) return
				setProfilesHealth('not_configured')
				setSessionPresent(null)
				return
			} else {
				// Session presence
				try {
					const { data } = await supabase.auth.getSession()
					if (!mounted) return
					setSessionPresent(Boolean(data?.session))
				} catch {
					if (!mounted) return
					setSessionPresent(false)
				}
			}
			const { error } = await supabase
				.from('profiles')
				.select('id', { head: true, count: 'exact' })
				.limit(1)
			if (!mounted) return
			if (!error) {
				setProfilesHealth('present')
				setProfilesDetail('Supabase profiles table detected ✅')
			} else {
				const friendly = friendlyMessageForProfilesError(error)
				if (friendly) {
					setProfilesHealth('missing')
					setProfilesDetail('Missing ❌ — run SQL setup')
				} else {
					setProfilesHealth('error')
					setProfilesDetail(error.message || 'Unknown error')
				}
			}
		})()
		return () => {
			mounted = false
		}
	}, [])

	return (
		<div className="mx-auto max-w-3xl px-4 md:px-6 py-10 space-y-8">
			<header>
				<h1 className="text-3xl font-bold mb-2">Current Site Status</h1>
				<p className="text-sm text-foreground/70">
					Build <span className="font-mono">{BUILD_ID}</span> • {BUILD_TIME} • Terms {TERMS_VERSION} • Env {ENV_MODE}
				</p>
				<div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
					<div className="rounded-md border border-border bg-surface px-3 py-2">
						<div>Supabase configured: <span className={supabaseEnvConfigured ? 'text-green-300' : 'text-amber-300'}>{supabaseEnvConfigured ? '✅' : '❌'}</span></div>
						<div>Session present: <span className={sessionPresent ? 'text-green-300' : 'text-amber-300'}>{sessionPresent ? '✅' : sessionPresent === null ? '—' : '❌'}</span></div>
					</div>
					<div className="rounded-md border border-border bg-surface px-3 py-2">
						<div>Route: <span className="font-mono text-white">{routeInfo.path || '/'}</span></div>
						<div>Query: <span className="font-mono text-white">{routeInfo.search || '—'}</span></div>
						<div>returnTo: <span className="font-mono text-white">{routeInfo.returnTo || '—'}</span></div>
					</div>
				</div>
				<div className="mt-3 text-sm">
					{profilesHealth === 'not_configured' ? (
						<div className="rounded-md border border-border bg-surface px-3 py-2 text-gray-300">
							Supabase not configured.
						</div>
					) : profilesHealth === 'unknown' ? null : (
						<div className="rounded-md border border-border bg-surface px-3 py-2">
							<span className={profilesHealth === 'present' ? 'text-green-300' : 'text-amber-300'}>
								{profilesDetail}
							</span>
						</div>
					)}
				</div>
			</header>

			<section className="space-y-2">
				<h2 className="text-xl font-semibold">Live Features</h2>
				<ul className="list-disc pl-6 space-y-1 text-gray-200">
					{LIVE_FEATURES.map((item, idx) => (
						<li key={idx}>{item}</li>
					))}
				</ul>
			</section>

			<section className="space-y-2">
				<h2 className="text-xl font-semibold">Known limitations / Beta</h2>
				{KNOWN_LIMITATIONS.length === 0 ? (
					<p className="text-gray-300">No known limitations at this time.</p>
				) : (
					<ul className="list-disc pl-6 space-y-1 text-gray-200">
						{KNOWN_LIMITATIONS.map((item, idx) => (
							<li key={idx}>{item}</li>
						))}
					</ul>
				)}
			</section>

			<section>
				<p className="text-sm text-gray-300">
					Need help? Contact support at{' '}
					<a className="underline" href="mailto:support@athlete-ledger.com">support@athlete-ledger.com</a>.
				</p>
			</section>
		</div>
	)
}


