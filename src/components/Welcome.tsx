import Card from './ui/Card'
import Button from './ui/Button'
import { YOUTUBE_INTRO_VIDEO_ID } from '../config/content'

type Props = {
	onStartProfile: () => void
	onGoResources: () => void
	onGoGuidelines: () => void
}

export default function Welcome({ onStartProfile, onGoResources, onGoGuidelines }: Props) {
	return (
		<div className="space-y-8">
			<section className="text-center space-y-4">
				<h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
					Athlete Ledger: Turn Your Hustle into a Real NIL Game Plan
				</h2>
				<p className="text-gray-200 text-lg max-w-3xl mx-auto">
					Build a real athlete brand, find the right local businesses, and learn how to talk money without losing your eligibility—or your mind.
				</p>
				<ul className="text-gray-300 max-w-3xl mx-auto text-left list-disc pl-6 space-y-2">
					<li>You’re a middle or high school athlete who wants to take NIL seriously, not recklessly.</li>
					<li>Your parents/coaches want a safe, structured way to learn this stuff.</li>
					<li>You’re tired of random “get paid fast” posts and want a real system.</li>
				</ul>
				<div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
					<Button onClick={onStartProfile} className="red-glow">
						Start Building My Profile
					</Button>
					<button
						onClick={onGoResources}
						className="text-sm text-gray-300 underline hover:text-white"
						aria-label="Explore NIL resources and rules"
					>
						Just want to learn first? Explore NIL resources and rules
					</button>
				</div>
			</section>

			<Card className="space-y-4">
				<h3 className="headline text-xl">Before you start: Watch this and read the rules</h3>
				<p className="text-gray-300">
					Start smart. Keep your eligibility safe and bring a parent/guardian or coach along.
				</p>
				<div className="aspect-video w-full rounded-lg overflow-hidden border border-border bg-mid">
					<iframe
						className="w-full h-full"
						src={`https://www.youtube.com/embed/${YOUTUBE_INTRO_VIDEO_ID}`}
						title="Athlete Ledger NIL Intro"
						frameBorder="0"
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
						allowFullScreen
					/>
				</div>
				<div>
					<Button variant="ghost" onClick={onGoGuidelines}>
						Read the full NIL rules & guidelines
					</Button>
				</div>
			</Card>
		</div>
	)
}


