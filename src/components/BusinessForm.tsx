import { useMemo, useState } from 'react'
import Card from './ui/Card'
import Button from './ui/Button'
import { Business, SocialHandle } from '../types'
import { useToast } from './ui/Toast'
import { autoAnalyzeBusiness } from '../utils/analysis'
import { importBusinessFromUrl } from '../utils/importer'
import { searchBusinesses } from '../services/search'
import type { ExternalBusiness } from '../services/businessSearchProvider'
import { mapExternalToBusiness } from '../services/mappers'
import { isBusinessSearchEnabled } from '../config/env'

type Props = {
	onAdd: (b: Business) => void
}

export default function BusinessForm({ onAdd }: Props) {
	const { show } = useToast()
	const [importUrl, setImportUrl] = useState('')
	const [name, setName] = useState('')
	const [location, setLocation] = useState('')
	const [url, setUrl] = useState('')
	const [social, setSocial] = useState('')
	const [description, setDescription] = useState('')
	const [socialHandles, setSocialHandles] = useState<SocialHandle[]>([])
	const [term, setTerm] = useState('')
	const [searchLoc, setSearchLoc] = useState('')
	const [searching, setSearching] = useState(false)
	const [results, setResults] = useState<ExternalBusiness[]>([])
	const searchEnabled = isBusinessSearchEnabled()

	const socialLinks = useMemo(() => {
		return social.split(',').map(s => s.trim()).filter(Boolean)
	}, [social])

	async function handleImport() {
		if (!importUrl) return
		try {
			const partial = await importBusinessFromUrl(importUrl)
			if (partial.name) setName(partial.name)
			if (partial.location) setLocation(partial.location!)
			if (partial.url) setUrl(partial.url!)
			if (partial.description) setDescription(partial.description!)
			if (Array.isArray(partial.socialHandles)) setSocialHandles(partial.socialHandles!)
			if (Array.isArray(partial.socialLinks)) setSocial(partial.socialLinks!.join(', '))
			show('Imported business details')
		} catch {
			show('Couldn’t pull details automatically, please fill in manually')
		}
	}

	async function runSearch() {
		if (!term && !searchLoc) {
			show('Enter a search term or location')
			return
		}
		if (!searchEnabled) {
			show('Business search requires a server GOOGLE_MAPS_API_KEY.')
			return
		}
		try {
			setSearching(true)
			const r = await searchBusinesses({ term, location: searchLoc, limit: 10 })
			setResults(r)
		} catch {
			show('Search failed. Check your API config or try again.')
		} finally {
			setSearching(false)
		}
	}

	function importToForm(ext: ExternalBusiness) {
		const mapped = mapExternalToBusiness(ext)
		setName(mapped.name || '')
		setLocation(mapped.location || '')
		setUrl(mapped.url || '')
		setDescription(mapped.description || '')
		show('Imported to form — review and click Add Business')
	}

	function addFromExternal(ext: ExternalBusiness) {
		const partial = mapExternalToBusiness(ext)
		const biz: Business = {
			id: `biz-${Date.now()}`,
			name: partial.name || ext.name,
			location: partial.location || '—',
			url: partial.url,
			website: partial.url,
			logoUrl: partial.logoUrl,
			description: partial.description ?? 'Imported from search',
			externalProvider: partial.externalProvider,
			externalProviderId: partial.externalProviderId,
			phone: partial.phone,
			coordinates: partial.coordinates,
			createdAt: Date.now()
		}
		biz.analysis = autoAnalyzeBusiness(biz)
		biz.level = biz.analysis.levelGuess
		onAdd(biz)
		show('Business added from search')
	}

	function handleAdd() {
		if (!name || !location || !description) {
			show('Please fill name, location, and description')
			return
		}
		const biz: Business = {
			id: `biz-${Date.now()}`,
			name,
			location,
			url: url || undefined,
			website: url || undefined,
			socialHandles: socialHandles.length ? socialHandles : undefined,
			socialLinks,
			description,
			createdAt: Date.now()
		}
		biz.analysis = autoAnalyzeBusiness(biz)
		biz.level = biz.analysis.levelGuess
		onAdd(biz)
		setName(''); setLocation(''); setUrl(''); setSocial(''); setDescription(''); setSocialHandles([]); setImportUrl('')
		show('Business added and analyzed')
	}

	return (
		<Card title="Find and Add Businesses" actions={
			<Button onClick={handleAdd} className="red-glow">Add Business</Button>
		}>
			<div className="mb-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
				<label className="flex flex-col gap-2">
					<span className="subtle text-sm">Paste business website or profile link</span>
					<input type="url" value={importUrl} onChange={e => setImportUrl(e.target.value)} className="bg-mid border border-border rounded-md px-3 py-2 text-white" placeholder="https://example.com or social profile URL" />
				</label>
				<div className="flex items-end">
					<Button variant="ghost" onClick={handleImport}>Import from URL</Button>
				</div>
			</div>
			<div className="mb-4 card p-4">
				<div className="mb-2 headline text-lg">Search businesses</div>
				{!searchEnabled && (
					<p className="text-yellow-300 text-sm mb-2">
						Developers: Business search requires a server <code>GOOGLE_MAPS_API_KEY</code>.
					</p>
				)}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
					<input value={term} onChange={e => setTerm(e.target.value)} className="bg-mid border border-border rounded-md px-3 py-2 text-white" placeholder="Search term (pizza, gym, store...)" />
					<input value={searchLoc} onChange={e => setSearchLoc(e.target.value)} className="bg-mid border border-border rounded-md px-3 py-2 text-white" placeholder="Location (City, ST or zip)" />
					<div className="flex items-center">
						<Button onClick={runSearch} className="w-full" disabled={searching || !searchEnabled}>{searching ? 'Searching…' : 'Search'}</Button>
					</div>
				</div>
				{results.length > 0 && (
					<div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
						{results.map(r => (
							<div key={r.provider + r.providerId} className="bg-mid border border-border rounded-md p-3">
								<div className="flex items-center gap-3">
									{r.imageUrl ? <img src={r.imageUrl} alt="" className="w-16 h-16 rounded object-cover" /> : <div className="w-16 h-16 rounded bg-border" />}
									<div className="min-w-0">
										<div className="text-white font-semibold truncate">{r.name}</div>
										<div className="text-gray-400 text-sm truncate">{[r.location?.address1, r.location?.city, r.location?.state].filter(Boolean).join(', ')}</div>
										{typeof r.rating === 'number' && <div className="text-gray-400 text-xs">Rating: {r.rating} ({r.reviewCount ?? 0})</div>}
									</div>
								</div>
								<div className="mt-3 flex gap-2">
									<Button variant="ghost" onClick={() => importToForm(r)}>Fill form</Button>
									<Button onClick={() => addFromExternal(r)}>Add business</Button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<label className="flex flex-col gap-2">
					<span className="subtle text-sm">Business Name</span>
					<input value={name} onChange={e => setName(e.target.value)} className="bg-mid border border-border rounded-md px-3 py-2 text-white" placeholder="Business Inc." />
				</label>
				<label className="flex flex-col gap-2">
					<span className="subtle text-sm">Location</span>
					<input value={location} onChange={e => setLocation(e.target.value)} className="bg-mid border border-border rounded-md px-3 py-2 text-white" placeholder="City, ST" />
				</label>
				<label className="flex flex-col gap-2">
					<span className="subtle text-sm">Website</span>
					<input value={url} onChange={e => setUrl(e.target.value)} className="bg-mid border border-border rounded-md px-3 py-2 text-white" placeholder="https://example.com" />
				</label>
				<label className="flex flex-col gap-2">
					<span className="subtle text-sm">Social Links (comma-separated)</span>
					<input value={social} onChange={e => setSocial(e.target.value)} className="bg-mid border border-border rounded-md px-3 py-2 text-white" placeholder="https://tiktok.com/.., https://instagram.com/.." />
				</label>
				<div className="md:col-span-2">
					<div className="subtle text-sm mb-2">Social Handles (structured)</div>
					<div className="space-y-3">
						{(socialHandles || []).map((s, idx) => (
							<div key={idx} className="bg-mid border border-border rounded-md p-3">
								<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
									<select
										value={s.platform}
										onChange={e => setSocialHandles(list => list.map((x, i) => i === idx ? { ...x, platform: e.target.value } : x))}
										className="bg-background border border-border rounded-md px-3 py-2 text-white"
									>
										{['Instagram','TikTok','YouTube','Twitter/X','Twitch','Snapchat','Facebook','Other'].map(p => <option key={p} value={p}>{p}</option>)}
									</select>
									<input
										value={s.handle}
										onChange={e => setSocialHandles(list => list.map((x, i) => i === idx ? { ...x, handle: e.target.value } : x))}
										className="bg-background border border-border rounded-md px-3 py-2 text-white"
										placeholder="@brand"
									/>
									<input
										value={s.url || ''}
										onChange={e => setSocialHandles(list => list.map((x, i) => i === idx ? { ...x, url: e.target.value } : x))}
										className="bg-background border border-border rounded-md px-3 py-2 text-white"
										placeholder="Full URL"
									/>
								</div>
								<div className="mt-2 flex justify-end">
									<Button variant="ghost" onClick={() => setSocialHandles(list => list.filter((_, i) => i !== idx))}>Remove</Button>
								</div>
							</div>
						))}
					</div>
					<div className="mt-2">
						<Button variant="ghost" onClick={() => setSocialHandles(list => [...list, { platform: 'Instagram', handle: '' }])}>Add another account</Button>
					</div>
				</div>
				<label className="md:col-span-2 flex flex-col gap-2">
					<span className="subtle text-sm">Description</span>
					<textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className="bg-mid border border-border rounded-md px-3 py-2 text-white" placeholder="Tell us about the business, its story, goals, and audience." />
				</label>
			</div>
			<p className="mt-3 subtle text-sm">We’ll auto-extract history, mission, goals, marketing needs, and suggest a level badge.</p>
		</Card>
	)
}


