import Card from './ui/Card'
import Button from './ui/Button'

type ResourceItem = {
	title: string
	description: string
	url: string
}

type ResourceCategory = {
	name: string
	items: ResourceItem[]
}

const CATEGORIES: ResourceCategory[] = [
	{
		name: 'NIL Education & Compliance',
		items: [
			{ title: 'Opendorse', description: 'Education and marketplaces', url: 'https://opendorse.com' },
			{ title: 'NIL Network', description: 'News and guides', url: 'https://www.nilnetwork.com' }
		]
	},
	{
		name: 'Athlete Brand Building & NIL Marketing',
		items: [
			{ title: 'NIL.store', description: 'Athlete merch and storefronts', url: 'https://www.nil.store' },
			{ title: 'Canva', description: 'Design simple posts and graphics', url: 'https://www.canva.com' }
		]
	},
	{
		name: 'Creator & Influencer Guides',
		items: [
			{ title: 'YouTube Creator Academy', description: 'Content basics from YouTube', url: 'https://www.youtube.com/creators' },
			{ title: 'TikTok for Business', description: 'Tips for short-form content', url: 'https://www.tiktok.com/business/' }
		]
	},
	{
		name: 'Free Tools & Platforms',
		items: [
			{ title: 'Linktree', description: 'Simple link-in-bio', url: 'https://linktr.ee' },
			{ title: 'Bitly', description: 'Trackable links', url: 'https://bitly.com' }
		]
	}
]

export default function Resources({ onGoVendors }: { onGoVendors?: () => void }) {
	return (
		<div className="space-y-6">
			<header className="space-y-2">
				<h2 className="headline text-2xl">NIL Resource Hub</h2>
				<p className="text-black/70">Curated links to help you learn fast, stay compliant, and build your brand.</p>
			</header>

			{onGoVendors && (
				<Card>
					<div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
						<div>
							<div className="text-black font-semibold">Need help executing your plan?</div>
							<p className="text-black/70 text-sm">Browse our informational directory of trusted partners and service providers.</p>
							<p className="text-xs text-black/70 mt-1">Informational only — you must vet and hire your own providers.</p>
						</div>
						<div className="shrink-0">
							<Button onClick={onGoVendors} className="red-glow">Open Vendor Directory</Button>
						</div>
					</div>
				</Card>
			)}
			{CATEGORIES.map((cat) => (
				<section key={cat.name} className="space-y-3">
					<h3 className="text-black font-semibold text-lg">{cat.name}</h3>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{cat.items.map((item) => (
							<Card key={item.title} className="h-full flex flex-col">
								<div className="flex-1">
									<div className="text-black font-semibold mb-1">{item.title}</div>
									<p className="text-black/70 text-sm">{item.description}</p>
								</div>
								<div className="pt-3">
									<a href={item.url} target="_blank" rel="noreferrer">
										<Button>Open</Button>
									</a>
								</div>
							</Card>
						))}
					</div>
				</section>
			))}
		</div>
	)
}


