import { useMemo, useState } from 'react'
import Card from './ui/Card'
import Button from './ui/Button'
import { VENDORS, VENDOR_CATEGORIES, VendorCategory, VendorProfile } from '../data/vendors'

export default function VendorDirectory() {
	const [selectedCategory, setSelectedCategory] = useState<'all' | VendorCategory>('all')

	const filtered: VendorProfile[] = useMemo(() => {
		if (selectedCategory === 'all') return VENDORS
		return VENDORS.filter(v => v.category === selectedCategory)
	}, [selectedCategory])

	return (
		<div className="space-y-6">
			<header className="space-y-2">
				<h2 className="headline text-2xl">Trusted Partners / Vendor Directory</h2>
				<p className="text-gray-300">
					Informational only. You are responsible for vetting and hiring any providers.
				</p>
			</header>

			<Card className="space-y-4">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Filter by category</span>
						<select
							className="bg-mid border border-border rounded-md px-3 py-2 text-white"
							value={selectedCategory}
							onChange={e => setSelectedCategory(e.target.value as any)}
						>
							<option value="all">All</option>
							{VENDOR_CATEGORIES.map(c => (
								<option key={c.value} value={c.value}>{c.label}</option>
							))}
						</select>
					</label>
				</div>
				<p className="text-xs text-gray-400">
					Monster Collective does not endorse or guarantee results. Do your own diligence.
				</p>
			</Card>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{filtered.map(v => (
					<Card key={v.id} className="h-full flex flex-col">
						<div className="flex-1 space-y-1">
							<div className="text-white font-semibold">{v.name}</div>
							<div className="text-gray-300 text-sm">
								{labelForCategory(v.category)}
							</div>
							<div className="text-gray-400 text-sm">
								{v.location ? `Location: ${v.location}` : 'Location: —'} {v.remoteOk ? '• Remote OK' : ''}
							</div>
							{v.notes && <p className="text-gray-300 text-sm mt-2">{v.notes}</p>}
						</div>
						<div className="pt-3 flex gap-2 flex-wrap">
							{v.websiteUrl && (
								<a href={v.websiteUrl} target="_blank" rel="noreferrer">
									<Button>Website</Button>
								</a>
							)}
							{v.socialHandle && (
								<a
									href={urlForSocialHandle(v.socialHandle)}
									target="_blank"
									rel="noreferrer"
								>
									<Button variant="ghost">{v.socialHandle}</Button>
								</a>
							)}
							{v.contactEmail && (
								<a href={`mailto:${v.contactEmail}`}>
                                    <Button variant="ghost">Email</Button>
								</a>
							)}
						</div>
					</Card>
				))}
			</div>
		</div>
	)
}

function labelForCategory(cat: VendorCategory): string {
	const found = VENDOR_CATEGORIES.find(c => c.value === cat)
	return found ? found.label : cat
}

function urlForSocialHandle(handle?: string): string {
	if (!handle) return '#'
	// Very basic normalization: if it looks like a handle (starts with @), send to Instagram by default.
	if (handle.startsWith('@')) return `https://instagram.com/${handle.replace('@','')}`
	// If it's already a URL, just return it.
	if (handle.startsWith('http://') || handle.startsWith('https://')) return handle
	return handle
}


