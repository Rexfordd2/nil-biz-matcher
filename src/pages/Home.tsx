import Button from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { navigate } from '../routes/RootRouter'
import { YOUTUBE_INTRO_VIDEO_ID } from '../config/content'

export default function Home() {
	const { user } = useAuth()
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
					</div>
					<div className="flex items-center gap-2">
						{user ? (
							<Button onClick={() => navigate('/app')} className="red-glow">Go to Dashboard</Button>
						) : (
							<>
								<button className="text-gray-300 hover:text-white" onClick={() => navigate('/auth/login')}>Log In</button>
								<Button onClick={() => navigate('/auth/signup')} className="red-glow">Create Profile</Button>
							</>
						)}
					</div>
				</div>
			</header>
			<main className="mx-auto max-w-6xl px-4 md:px-6 py-10 space-y-10">
				<section className="text-center space-y-4">
					<h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
						Athlete Ledger: Turn Your Hustle into a Real NIL Game Plan
					</h2>
					<p className="text-gray-200 text-lg max-w-3xl mx-auto">
						Build your athlete profile, find the right businesses, and communicate professionally—with safety for teens and clarity for parents.
					</p>
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
					<div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
						<Button onClick={() => navigate('/auth/signup')} className="red-glow">
							Create Profile
						</Button>
						<button
							onClick={() => navigate('/auth/login')}
							className="text-sm text-gray-300 underline hover:text-white"
						>
							Log In
						</button>
					</div>
				</section>

				<section className="space-y-4">
					<h3 className="headline text-xl text-white text-center">How it works</h3>
					<ol className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<li className="card p-4">
							<div className="text-white font-semibold mb-1">1) Create your profile</div>
							<p className="text-gray-300 text-sm">Add sports, film, and your “My Story” so brands and coaches quickly understand you.</p>
						</li>
						<li className="card p-4">
							<div className="text-white font-semibold mb-1">2) Discover businesses</div>
							<p className="text-gray-300 text-sm">Use our discovery tools to find good‑fit local businesses and plan simple outreach.</p>
						</li>
						<li className="card p-4">
							<div className="text-white font-semibold mb-1">3) Talk like a pro</div>
							<p className="text-gray-300 text-sm">Use respectful scripts and checklists (teen/parent‑safe) to start conversations the right way.</p>
						</li>
						<li className="card p-4">
							<div className="text-white font-semibold mb-1">4) Track deals & events</div>
							<p className="text-gray-300 text-sm">Keep everything organized and school‑friendly, with simple compliance notes.</p>
						</li>
						<li className="card p-4">
							<div className="text-white font-semibold mb-1">5) Learn as you go</div>
							<p className="text-gray-300 text-sm">NIL education and safety guidance are built‑in—parents and coaches welcome.</p>
						</li>
					</ol>
				</section>

				<section className="text-center">
					{user ? (
						<Button onClick={() => navigate('/app')} className="red-glow">Go to Dashboard</Button>
					) : (
						<div className="flex items-center justify-center gap-3">
							<Button onClick={() => navigate('/auth/signup')} className="red-glow">Create Profile</Button>
							<Button variant="ghost" onClick={() => navigate('/auth/login')}>Log In</Button>
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


