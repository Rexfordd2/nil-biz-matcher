import Button from './ui/Button'
import type { AthleteProfile } from '../types'

type Props = {
	athlete: AthleteProfile | null
	onEditPassport: () => void
	onViewPublicProfile: () => void
	onExploreOpportunities: () => void
}

function hasMediaKit(athlete: AthleteProfile | null): boolean {
	const mk = athlete?.mediaKit
	if (!mk) return false
	return (
		(mk.heroImages?.length ?? 0) > 0 ||
		(mk.logos?.length ?? 0) > 0 ||
		(mk.brandColors?.length ?? 0) > 0 ||
		(mk.samplePosts?.length ?? 0) > 0 ||
		Boolean(mk.externalDeckUrl)
	)
}

function hasPerformanceStory(athlete: AthleteProfile | null): boolean {
	const story = athlete?.performanceStory
	if (!story) return false
	return Boolean(
		story.currentFocus ||
			(story.keyMilestones && story.keyMilestones.length > 0) ||
			(story.futureGoals && story.futureGoals.length > 0)
	)
}

/**
 * Career Studio foundation screen (PR-2).
 * Summarizes safe in-memory passport signals only. No private contact details.
 */
export default function CareerStudioFoundation({
	athlete,
	onEditPassport,
	onViewPublicProfile,
	onExploreOpportunities,
}: Props) {
	const mediaKitExists = hasMediaKit(athlete)
	const contentStylesCount = athlete?.contentStyles?.length ?? 0
	const monetizationCount = athlete?.monetizationInterests?.length ?? 0
	const storyExists = hasPerformanceStory(athlete)

	return (
		<div className="space-y-6" data-testid="career-studio-foundation">
			<div className="card p-6 space-y-4">
				<h2 className="headline text-2xl">Career Studio</h2>
				<p className="text-gray-200">
					Turn your athletic identity, story, audience, skills, and relationships into the next
					stage of your career.
				</p>
				<p className="text-gray-300 text-sm" data-testid="career-studio-disclosure">
					Your media kit, content preferences, story, and opportunity interests already live in
					Athlete Passport. Career pathways, audience conversion, portfolio tools, and venture
					planning will be built in later phases.
				</p>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
					<div className="bg-mid border border-border rounded-md p-3">
						<div className="text-gray-400 text-xs">Media kit</div>
						<div className="text-white text-lg font-bold" data-testid="career-media-kit">
							{mediaKitExists ? 'Started' : 'Not started'}
						</div>
					</div>
					<div className="bg-mid border border-border rounded-md p-3">
						<div className="text-gray-400 text-xs">Content styles</div>
						<div className="text-white text-lg font-bold" data-testid="career-content-styles">
							{contentStylesCount}
						</div>
					</div>
					<div className="bg-mid border border-border rounded-md p-3">
						<div className="text-gray-400 text-xs">Monetization interests</div>
						<div className="text-white text-lg font-bold" data-testid="career-monetization">
							{monetizationCount}
						</div>
					</div>
					<div className="bg-mid border border-border rounded-md p-3">
						<div className="text-gray-400 text-xs">Performance story</div>
						<div className="text-white text-lg font-bold" data-testid="career-story">
							{storyExists ? 'Started' : 'Not started'}
						</div>
					</div>
				</div>
				<div className="flex flex-wrap gap-3 pt-2">
					<Button onClick={onEditPassport} className="red-glow" data-testid="career-edit-passport">
						Edit Athlete Passport
					</Button>
					<Button onClick={onViewPublicProfile} variant="secondary" data-testid="career-view-public">
						View Public Profile
					</Button>
					<Button onClick={onExploreOpportunities} variant="secondary" data-testid="career-explore-opps">
						Explore Opportunities
					</Button>
				</div>
			</div>
		</div>
	)
}
