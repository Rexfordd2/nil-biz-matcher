import { useState, useEffect } from 'react'
import { navigate } from '../routes/RootRouter'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Observability from '../lib/obs'
import DemoDiscover from '../components/DemoDiscover'
import DemoRecruiting from '../components/DemoRecruiting'
import { installDemoNetworkGuard } from '../lib/demoNetworkGuard'
import { setOpenGraphTags } from '../lib/metaTags'

export default function Demo() {
	const [activeTab, setActiveTab] = useState<'discover' | 'recruiting'>('discover')
	const [searchParams, setSearchParams] = useState<{ what?: string; where?: string; sport?: string; location?: string }>({})

	// Install dev-only network guard
	useEffect(() => {
		const cleanup = installDemoNetworkGuard()
		return cleanup
	}, [])

	// Set Open Graph meta tags
	useEffect(() => {
		setOpenGraphTags({
			title: 'Athlete Ledger - Demo',
			description: 'Try Athlete Ledger demo: discover local businesses and recruiting programs. No signup required.',
			url: window.location.href,
			type: 'website'
		})
	}, [])

	useEffect(() => {
		// Parse query params from URL
		const params = new URLSearchParams(window.location.search)
		const what = params.get('what') || undefined
		const where = params.get('where') || undefined
		const sport = params.get('sport') || undefined
		const location = params.get('location') || undefined

		if (what || where) {
			setActiveTab('discover')
			setSearchParams({ what, where })
		} else if (sport || location) {
			setActiveTab('recruiting')
			setSearchParams({ sport, location })
		}

		// Track demo page view
		Observability.log({
			feature: 'ui',
			route: 'demo.view',
			status: 'ui_action',
			meta: { hasParams: Boolean(what || where || sport || location) }
		})
	}, [])

	function handleShare() {
		const params = new URLSearchParams()
		if (activeTab === 'discover' && searchParams.what && searchParams.where) {
			params.set('what', searchParams.what)
			params.set('where', searchParams.where)
		} else if (activeTab === 'recruiting' && searchParams.sport && searchParams.location) {
			params.set('sport', searchParams.sport)
			params.set('location', searchParams.location)
		}

		const shareUrl = `${window.location.origin}/demo${params.toString() ? `?${params.toString()}` : ''}`
		navigator.clipboard.writeText(shareUrl).then(() => {
			Observability.log({
				feature: 'ui',
				route: 'demo.share',
				status: 'ui_action',
				meta: { tab: activeTab, url: shareUrl }
			})
			alert('Link copied to clipboard!')
		}).catch(() => {
			// Fallback: show URL
			prompt('Copy this link:', shareUrl)
		})
	}

	return (
		<div className="min-h-screen">
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
						<span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">DEMO</span>
					</div>
					<div className="flex items-center gap-2">
						<Button onClick={() => navigate('/')} variant="ghost">Back to Home</Button>
						<Button onClick={() => {
							Observability.log({
								feature: 'ui',
								route: 'demo.cta.save_progress',
								status: 'ui_action'
							})
							navigate('/')
							// Small delay to ensure page loads before scrolling
							setTimeout(() => {
								document.getElementById('waitlist-form')?.scrollIntoView({ behavior: 'smooth' })
							}, 100)
						}} className="red-glow">Save my progress</Button>
					</div>
				</div>
			</header>

			<div className="bg-yellow-50 border-b border-yellow-200 py-2">
				<div className="mx-auto max-w-6xl px-4 md:px-6 text-sm text-yellow-800 text-center">
					<strong>Demo mode</strong> — Limited data. No login required. <button onClick={() => {
						navigate('/')
						setTimeout(() => {
							document.getElementById('waitlist-form')?.scrollIntoView({ behavior: 'smooth' })
						}, 100)
					}} className="underline font-semibold">Save progress with email</button>.
				</div>
			</div>

			<main className="mx-auto max-w-6xl px-4 md:px-6 py-6">
				<div className="flex items-center gap-2 mb-6">
					<Button
						variant={activeTab === 'discover' ? 'primary' : 'secondary'}
						onClick={() => setActiveTab('discover')}
					>
						Discover
					</Button>
					<Button
						variant={activeTab === 'recruiting' ? 'primary' : 'secondary'}
						onClick={() => setActiveTab('recruiting')}
					>
						Recruiting
					</Button>
					{(searchParams.what || searchParams.sport) && (
						<Button onClick={handleShare} variant="ghost" className="ml-auto">
							Share Results
						</Button>
					)}
				</div>

				{activeTab === 'discover' ? (
					<DemoDiscover
						initialWhat={searchParams.what}
						initialWhere={searchParams.where}
						onSearch={(what, where) => {
							setSearchParams({ what, where })
							Observability.log({
								feature: 'ui',
								route: 'demo.discover.search',
								status: 'ui_action',
								meta: { what, where }
							})
						}}
					/>
				) : (
					<DemoRecruiting
						initialSport={searchParams.sport}
						initialLocation={searchParams.location}
						onSearch={(sport, location) => {
							setSearchParams({ sport, location })
							Observability.log({
								feature: 'ui',
								route: 'demo.recruiting.search',
								status: 'ui_action',
								meta: { sport, location }
							})
						}}
					/>
				)}
			</main>
		</div>
	)
}
