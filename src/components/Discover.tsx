import { useEffect, useMemo, useState } from 'react'
import Card from './ui/Card'
import Button from './ui/Button'
import BusinessMap from './BusinessMap'
import BusinessSwipeDeck from './BusinessSwipeDeck'
import { Business } from '../types'
import { isBusinessSearchEnabled } from '../config/env'
import { searchBusinesses } from '../services/search'
import type { ExternalBusiness } from '../services/businessSearchProvider'
import { mapExternalToBusiness } from '../services/mappers'
import { load, save } from '../utils/storage'

type DecisionMap = Record<string, 'approve' | 'skip'>

export default function Discover() {
	const searchEnabled = isBusinessSearchEnabled()
	const [term, setTerm] = useState('')
	const [loc, setLoc] = useState('')
	const [searching, setSearching] = useState(false)
	const [results, setResults] = useState<ExternalBusiness[]>([])

	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [currentIndex, setCurrentIndex] = useState(0)
	const [decisions, setDecisions] = useState<DecisionMap>(() => load('discover.decisions', {} as DecisionMap))

	useEffect(() => {
		save('discover.decisions', decisions)
	}, [decisions])

	async function runSearch() {
		if (!term && !loc) return
		if (!searchEnabled) return
		try {
			setSearching(true)
			const r = await searchBusinesses({ term, location: loc, limit: 20 })
			setResults(r)
			setSelectedId(null)
			setCurrentIndex(0)
		} finally {
			setSearching(false)
		}
	}

	const businesses: Business[] = useMemo(() => {
		return results.map(ext => {
			const partial = mapExternalToBusiness(ext)
			const id = `${ext.provider}:${ext.providerId}`
			return {
				id,
				name: partial.name || ext.name,
				location: partial.location || [ext.location?.city, ext.location?.state].filter(Boolean).join(', '),
				url: partial.url,
				website: partial.url,
				logoUrl: partial.logoUrl,
				description: partial.description ?? '',
				externalProvider: partial.externalProvider,
				externalProviderId: partial.externalProviderId,
				phone: partial.phone,
				coordinates: partial.coordinates,
				rating: partial.rating,
				reviewCount: partial.reviewCount,
				createdAt: Date.now()
			}
		})
	}, [results])

	useEffect(() => {
		// Keep map & deck in sync
		const active = businesses[currentIndex]
		if (active) {
			setSelectedId(active.id)
		}
	}, [currentIndex, businesses])

	function onSelectFromMap(id: string) {
		setSelectedId(id)
		const idx = businesses.findIndex(b => b.id === id)
		if (idx !== -1) setCurrentIndex(idx)
	}

	function onSwipeDecision(id: string, decision: 'approve' | 'skip') {
		setDecisions(prev => ({ ...prev, [id]: decision }))
	}

	const reviewedCount = useMemo(() => Object.keys(decisions).filter(id => businesses.some(b => b.id === id)).length, [decisions, businesses])
	const approvedCount = useMemo(() => Object.values(decisions).filter(d => d === 'approve').length, [decisions])

	const hasAnyCoords = useMemo(() => businesses.some(b => b.coordinates && typeof b.coordinates.latitude === 'number' && typeof b.coordinates.longitude === 'number'), [businesses])
	const active = businesses[currentIndex]

	return (
		<div className="space-y-5">
			<Card title="Discover Businesses" actions={
				<Button onClick={runSearch} disabled={!searchEnabled || searching} className="red-glow">
					{searching ? 'Searching…' : 'Search'}
				</Button>
			}>
				{!searchEnabled && (
					<p className="text-yellow-300 text-sm mb-2">
						Developers: server-side business search requires <code>GOOGLE_MAPS_API_KEY</code>.
					</p>
				)}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
					<input
						value={term}
						onChange={e => setTerm(e.target.value)}
						className="bg-mid border border-border rounded-md px-3 py-2 text-white"
						placeholder="Search term (pizza, gym, store...)"
					/>
					<input
						value={loc}
						onChange={e => setLoc(e.target.value)}
						className="bg-mid border border-border rounded-md px-3 py-2 text-white"
						placeholder="Location (City, ST or zip)"
					/>
					<div className="flex items-center">
						<Button onClick={runSearch} className="w-full" disabled={!searchEnabled || searching}>
							{searching ? 'Searching…' : 'Search'}
						</Button>
					</div>
				</div>
				<div className="mt-3 text-sm text-gray-300">
					You've reviewed {reviewedCount} businesses in this search. Approved {approvedCount}.
				</div>
			</Card>

			{businesses.length === 0 ? (
				<div className="text-gray-400 text-sm">Search to see results.</div>
			) : (
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
					<div className="space-y-3">
						<BusinessMap
							businesses={businesses}
							selectedId={selectedId}
							onSelectBusiness={onSelectFromMap}
						/>
						{!hasAnyCoords && (
							<div className="text-xs text-gray-400">
								Map not available for these results (no coordinates).
							</div>
						)}
					</div>
					<div className="space-y-3">
						<BusinessSwipeDeck
							businesses={businesses}
							currentIndex={currentIndex}
							onIndexChange={setCurrentIndex}
							onSwipeDecision={onSwipeDecision}
						/>
						{active && (
							<div className="card p-4">
								<div className="flex items-center justify-between mb-2">
									<div className="text-white font-semibold truncate">{active.name}</div>
									{typeof active.rating === 'number' && (
										<div className="text-xs text-gray-300">Rating {active.rating}{typeof active.reviewCount === 'number' ? ` (${active.reviewCount})` : ''}</div>
									)}
								</div>
								<div className="text-gray-400 text-sm truncate">{active.location}</div>
								{active.url && (
									<div className="truncate mt-1">
										<a href={active.url} className="text-blue-300 hover:underline" target="_blank" rel="noreferrer">{active.url}</a>
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	)
}


