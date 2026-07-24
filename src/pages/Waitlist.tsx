import { useEffect, useState } from 'react'
import { navigate } from '../routes/RootRouter'
import Button from '../components/ui/Button'
import WaitlistEmbed from '../components/WaitlistEmbed'
import { BUILD_ID } from '../lib/buildInfo'
import { setOpenGraphTags } from '../lib/metaTags'
import { hasWaitlistJoined, markWaitlistJoined } from '../lib/waitlistState'
import { isDemoMode } from '../config/appMode'
import { goToLogin } from '../lib/auth/navigation'

export default function Waitlist() {
	const [joined, setJoined] = useState(() => hasWaitlistJoined())
	
	// Set Open Graph meta tags
	useEffect(() => {
		setOpenGraphTags({
			title: 'NIL Roster — Join Waitlist',
			description: 'Get early access to NIL Roster. Build a verified athlete profile, find the right place to play, grow your professional network, and connect with businesses.',
			url: window.location.href,
			type: 'website'
		})
	}, [])
	
	function handleAlreadyJoined() {
		markWaitlistJoined()
		setJoined(true)
	}

	return (
		<div className="min-h-screen">
			<div className="fixed top-2 right-3 text-xs text-black" data-testid="build-id">{BUILD_ID}</div>
			<header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
				<div className="mx-auto max-w-6xl px-4 md:px-6 py-4 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="w-8 h-8 rounded-lg bg-brand-red shadow-glow overflow-hidden">
							<img
								src="/nil-roster-logo.png"
								alt="NIL Roster Logo"
								className="w-full h-full object-cover"
								onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
							/>
						</div>
						<h1 className="headline text-2xl">NIL Roster</h1>
					</div>
					<div className="flex items-center gap-2">
						<Button data-testid="header-home-button" onClick={() => navigate('/')} variant="ghost">Home</Button>
					</div>
				</div>
			</header>
			<main className="mx-auto max-w-2xl px-4 md:px-6 py-10 space-y-8">
				<section className="text-center space-y-4">
					<h2 data-testid="waitlist-heading" className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900">
						Join the Waitlist
					</h2>
					<p className="text-gray-700 text-lg max-w-xl mx-auto">
						Get early access to NIL Roster and be the first to know when we launch.
					</p>
				</section>

				<section className="card p-6">
					{joined ? (
						<div className="text-center space-y-4">
							<p className="text-green-600 font-medium text-lg">✓ You're on the list</p>
							<p className="text-sm text-gray-600">We'll notify you when NIL Roster launches.</p>
							<div className="flex flex-col gap-2">
								<Button
									onClick={() => goToLogin('/app')}
									className="w-full red-glow"
									data-testid="waitlist-page-success-login"
								>
									Log In
								</Button>
								<Button
									onClick={() => navigate(isDemoMode() ? '/demo' : '/')}
									variant="secondary"
									className="w-full"
									data-testid="waitlist-page-success-back"
								>
									{isDemoMode() ? 'Back to Demo' : 'Back Home'}
								</Button>
							</div>
						</div>
					) : (
						<>
							<WaitlistEmbed source="waitlist-page" />
							<div className="mt-4 text-center">
								<button
									onClick={handleAlreadyJoined}
									className="text-sm text-gray-500 hover:text-gray-700 underline"
									data-testid="already-joined-button"
								>
									I already joined
								</button>
							</div>
						</>
					)}
				</section>

				<section className="text-center">
					<Button data-testid="back-home-button" onClick={() => navigate('/')} variant="secondary">
						Back to Home
					</Button>
				</section>
			</main>
			<footer className="border-t border-border mt-8 py-6">
				<div className="mx-auto max-w-6xl px-4 md:px-6 text-xs text-gray-400">
					By using NIL Roster, you agree to our <a className="underline" onClick={() => navigate('/terms')}>Terms</a>. <span className="mx-2">•</span>
					<a className="underline" onClick={() => navigate('/status')}>Status</a>
				</div>
			</footer>
		</div>
	)
}
