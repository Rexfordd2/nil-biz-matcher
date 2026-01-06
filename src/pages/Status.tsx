import { TERMS_VERSION } from '../constants/legal'
import { BUILD_ID } from '../config/env'

const BUILD_TIME: string = (import.meta.env.VITE_BUILD_TIME as string) || 'unknown'
const ENV_MODE: string = (import.meta.env.VITE_ENV as string) || (import.meta.env.PROD ? 'prod' : import.meta.env.MODE || 'dev')

const LIVE_FEATURES: string[] = [
	'Public homepage at `/` with hero video + how-to steps + CTAs',
	'Auth-gated app under `/app/*` with returnTo redirect',
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
	return (
		<div className="mx-auto max-w-3xl px-4 md:px-6 py-10 space-y-8">
			<header>
				<h1 className="text-3xl font-bold mb-2">Current Site Status</h1>
				<p className="text-sm text-foreground/70">
					Build <span className="font-mono">{BUILD_ID}</span> • {BUILD_TIME} • Terms {TERMS_VERSION} • Env {ENV_MODE}
				</p>
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


