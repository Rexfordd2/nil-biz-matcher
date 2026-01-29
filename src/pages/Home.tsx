import { useState, useEffect } from 'react'
import Button from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { navigate } from '../routes/RootRouter'
import { YOUTUBE_INTRO_VIDEO_ID } from '../config/content'
import { BUILD_ID } from '../lib/buildInfo'
import Observability from '../lib/obs'
import { setOpenGraphTags } from '../lib/metaTags'
import WaitlistForm from '../components/WaitlistForm'

const WAITLIST_CONFIRMED_KEY = 'al_waitlist_confirmed'

export default function Home() {
	const { user } = useAuth()
	const [waitlistConfirmed, setWaitlistConfirmed] = useState(() => {
		return localStorage.getItem(WAITLIST_CONFIRMED_KEY) === 'true'
	})

	const embedUrl = import.meta.env.VITE_WAITLIST_EMBED_URL
	const embedTitle = import.meta.env.VITE_WAITLIST_EMBED_TITLE || 'Waitlist signup form'

	// Set Open Graph meta tags
	useEffect(() => {
		setOpenGraphTags({
			title: 'Athlete Ledger - Turn Your Hustle into a Real NIL Game Plan',
			description: 'Build your athlete profile, discover local businesses, and track NIL opportunities—all with safety and compliance built in.',
			url: window.location.href,
			type: 'website'
		})
	}, [])

	// Extract UTM params and referral info from URL
	const getUtmParams = () => {
		const params = new URLSearchParams(window.location.search)
		return {
			utm_source: params.get('utm_source') || null,
			utm_medium: params.get('utm_medium') || null,
			utm_campaign: params.get('utm_campaign') || null,
			utm_term: params.get('utm_term') || null,
			utm_content: params.get('utm_content') || null
		}
	}

	function handleConfirmWaitlist() {
		localStorage.setItem(WAITLIST_CONFIRMED_KEY, 'true')
		setWaitlistConfirmed(true)
		Observability.log({
			feature: 'ui',
			route: 'landing.waitlist.confirmed',
			status: 'ui_action'
		})
	}

	function handleOpenWaitlistForm() {
		if (embedUrl) {
			window.open(embedUrl, '_blank', 'noopener,noreferrer')
		}
		Observability.log({
			feature: 'ui',
			route: 'landing.waitlist.open',
			status: 'ui_action'
		})
	}

	function handleTryDemo() {
		Observability.log({
			feature: 'ui',
			route: 'landing.cta.demo',
			status: 'ui_action'
		})
		navigate('/demo')
	}

	function handleSaveProgress() {
		Observability.log({
			feature: 'ui',
			route: 'landing.cta.save_progress',
			status: 'ui_action'
		})
		// Scroll to waitlist form
		document.getElementById('waitlist-form')?.scrollIntoView({ behavior: 'smooth' })
	}

	return (
		<div className="min-h-screen">
			<div className="fixed top-2 right-3 text-xs text-black" data-testid="build-id">{BUILD_ID}</div>
			<header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
				<div className="mx-auto max-w-6xl px-4 md:px-6 py-4 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="w-8 h-8 rounded-lg bg-brand-red shadow-glow overflow-hidden">
							<img
								src="/athlete-ledger-logo.png"
								alt="Athlete Ledger Logo"
								className="w-full h-full object-cover"
								onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
							/>
						</div>
						<h1 className="headline text-2xl">Athlete Ledger</h1>
					</div>
					<div className="flex items-center gap-2">
						{user ? (
							<Button data-testid="header-dashboard-button" onClick={() => navigate('/app')} className="red-glow">Go to Dashboard</Button>
						) : (
							<Button data-testid="header-save-progress-button" onClick={handleSaveProgress} className="red-glow">Save my progress</Button>
						)}
					</div>
				</div>
			</header>
			<main className="mx-auto max-w-6xl px-4 md:px-6 py-10 space-y-10">
				<section className="text-center space-y-6">
					<h2 data-testid="hero-heading" className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900">
						Turn Your Hustle into a Real NIL Game Plan
					</h2>
					<p className="text-gray-700 text-lg max-w-2xl mx-auto font-medium">
						Build your athlete profile, discover local businesses, and track NIL opportunities—all with safety and compliance built in.
					</p>
					<div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
						<Button data-testid="try-demo-button" onClick={handleTryDemo} className="red-glow">
							Try Demo
						</Button>
						<Button data-testid="save-progress-button" onClick={handleSaveProgress} variant="secondary">
							Save my progress
						</Button>
					</div>
					<p className="text-sm text-gray-600 mt-2">No login required. Save progress with email.</p>
					<div className="aspect-video w-full max-w-3xl mx-auto rounded-lg overflow-hidden border border-border bg-mid">
						<iframe
							className="w-full h-full"
							src={`https://www.youtube.com/embed/${YOUTUBE_INTRO_VIDEO_ID}`}
							title="Athlete Ledger Intro"
							frameBorder={0}
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
							allowFullScreen
						/>
					</div>
				</section>

				{/* Waitlist Form */}
				<section id="waitlist-form" className="card p-6 max-w-md mx-auto">
					<h3 className="text-lg font-semibold text-gray-900 mb-3 text-center">Get Early Access</h3>
					{waitlistConfirmed ? (
						<div className="text-center space-y-4">
							<p className="text-green-600 font-medium text-lg">✓ You're in!</p>
							<p className="text-sm text-gray-600">We'll notify you when Athlete Ledger launches.</p>
						</div>
					) : (
						<WaitlistForm
							source="landing"
							onSuccess={handleConfirmWaitlist}
						/>
					)}
				</section>

				<section className="space-y-4">
					<h3 data-testid="how-it-works-heading" className="headline text-xl text-gray-900 text-center">How it works</h3>
					<ol className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<li className="card p-4">
							<div className="text-gray-900 font-semibold mb-1">1) Learn NIL 101</div>
							<p className="text-gray-700 text-sm">
								Understand what Name, Image, and Likeness actually means, what’s allowed vs. not,
								basics of eligibility, disclosures, and taxes. We give plain‑language guides,
								short videos, and checklists so you stay compliant from day one.
							</p>
							<p className="text-gray-600 text-sm mt-1">
								We highlight key concepts like pay‑for‑play bans, school policy differences, consent for minors,
								and why clear ad disclosures matter—so you avoid mistakes that could affect eligibility.
							</p>
						</li>
						<li className="card p-4">
							<div className="text-gray-900 font-semibold mb-1">2) Build a standout profile</div>
							<p className="text-gray-700 text-sm">
								Showcase your sport, highlights, and story in a brand‑safe way parents and coaches
								appreciate. Our prompts help you express value clearly so businesses see why you’re
								a great partner.
							</p>
							<p className="text-gray-600 text-sm mt-1">
								We coach you on content pillars, photos/video, and tone. Add audience stats and strengths so
								local brands can quickly see fit—and parents/coaches can comfortably support your outreach.
							</p>
						</li>
						<li className="card p-4">
							<div className="text-gray-900 font-semibold mb-1">3) Discover the right partners</div>
							<p className="text-gray-700 text-sm">
								Match with local businesses that fit your audience and goals. Learn what brands look
								for and how to present a simple, realistic NIL plan that respects school and state rules.
							</p>
							<p className="text-gray-600 text-sm mt-1">
								We teach evaluation basics: brand safety, audience overlap, seasonality, and category norms.
								Save notes and reasons to believe—so every pitch feels tailored and professional.
							</p>
						</li>
						<li className="card p-4">
							<div className="text-gray-900 font-semibold mb-1">4) Outreach like a pro</div>
							<p className="text-gray-700 text-sm">
								Use respectful scripts, email/text templates, and do/don’t checklists to start the
								conversation the right way—coach and parent‑friendly, compliance‑first, and easy to follow.
							</p>
							<p className="text-gray-600 text-sm mt-1">
								We cover expectations, rates, and scope. For minors, include a parent/guardian. Use clear,
								honest messaging and keep records of what you sent, promised, and delivered.
							</p>
						</li>
						<li className="card p-4">
							<div className="text-gray-900 font-semibold mb-1">5) Track deals, compliance, and growth</div>
							<p className="text-gray-700 text-sm">
								Organize offers, tasks, and events with simple notes and disclosures. Our built‑in
								micro‑lessons help you improve each step so your NIL activity stays smart, safe, and effective.
							</p>
							<p className="text-gray-600 text-sm mt-1">
								Track deliverables, due dates, and consideration (cash/gear/services), plus usage rights and exclusivity.
								Export a clean log for school reporting and share updates with parents/coaches anytime.
							</p>
						</li>
					</ol>
				</section>

			<section className="text-center">
				{user ? (
					<Button data-testid="footer-dashboard-button" onClick={() => navigate('/app')} className="red-glow">Go to Dashboard</Button>
				) : (
					<div className="flex flex-col items-center justify-center gap-3">
						<Button data-testid="footer-save-progress-button" onClick={handleSaveProgress} className="red-glow">Save my progress</Button>
						<p className="text-sm text-gray-600">No login required. Save progress with email.</p>
					</div>
				)}
			</section>
			</main>
			<footer className="border-t border-border mt-8 py-6">
				<div className="mx-auto max-w-6xl px-4 md:px-6 text-xs text-gray-400">
					By using Athlete Ledger, you agree to our <a className="underline" onClick={() => navigate('/terms')}>Terms</a>. <span className="mx-2">•</span>
					<a className="underline" onClick={() => navigate('/status')}>Status</a>
				</div>
			</footer>
		</div>
	)
}


