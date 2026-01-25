import { useState, useEffect } from 'react'
import Card from './ui/Card'
import Button from './ui/Button'
import Input from './ui/Input'
import { createMockProvider } from '../services/providers/mockProvider'
import type { ExternalBusiness } from '../services/businessSearchProvider'
import { assertDemoSafe } from '../lib/demoNetworkGuard'
import Observability from '../lib/obs'

type DemoDiscoverProps = {
	initialWhat?: string
	initialWhere?: string
	onSearch: (what: string, where: string) => void
}

export default function DemoDiscover({ initialWhat, initialWhere, onSearch }: DemoDiscoverProps) {
	const [whatText, setWhatText] = useState(initialWhat || '')
	const [whereText, setWhereText] = useState(initialWhere || '')
	const [results, setResults] = useState<ExternalBusiness[]>([])
	const [loading, setLoading] = useState(false)
	const [hasSearched, setHasSearched] = useState(false)
	const [selected, setSelected] = useState<ExternalBusiness | null>(null)

	// Auto-search if initial params provided
	useEffect(() => {
		if (initialWhat && initialWhere) {
			handleSearch()
		}
	}, []) // eslint-disable-line react-hooks/exhaustive-deps

	async function handleSearch() {
		if (!whatText.trim() || !whereText.trim()) return

		setLoading(true)
		setHasSearched(true)
		onSearch(whatText.trim(), whereText.trim())

		try {
			// Production assertion: ensure we're only using mock data
			assertDemoSafe('mock-provider-search', 'GET')
			
			const mockProvider = createMockProvider()
			const businesses = await mockProvider.searchBusinesses({
				term: whatText.trim(),
				location: whereText.trim(),
				limit: 10
			})
			setResults(businesses)
		} catch (err: any) {
			console.error('Demo search error:', err)
			Observability.log({
				feature: 'ui',
				route: 'demo.discover.error',
				status: 'error',
				errorMessage: err.message,
				meta: { error: 'Protected endpoint call detected' }
			})
			setResults([])
			// Show friendly error in production
			if (!import.meta.env.DEV) {
				alert('Demo mode can only use local mock data. Please sign up for full access.')
			}
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="space-y-6">
			<Card title="Discover Businesses (Demo)">
				<div className="space-y-3">
					<Input
						value={whatText}
						onChange={(e) => setWhatText(e.target.value)}
						placeholder="What (e.g., gym, restaurant)"
						onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
					/>
					<Input
						value={whereText}
						onChange={(e) => setWhereText(e.target.value)}
						placeholder="Where (City, ST or zip)"
						onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
					/>
					<Button onClick={handleSearch} className="w-full" disabled={loading || !whatText || !whereText}>
						{loading ? 'Searching…' : 'Search'}
					</Button>
				</div>
			</Card>

			{results.length === 0 && !loading && hasSearched && (
				<div className="text-gray-400 text-sm text-center py-8">
					No matches found. Try different search terms.
				</div>
			)}

			{loading && (
				<div className="space-y-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<div key={i} className="card animate-pulse bg-gray-800/40 h-24" />
					))}
				</div>
			)}

			{results.length > 0 && !loading && (
				<div className="space-y-3">
					<div className="text-sm text-gray-400 mb-2">
						Found {results.length} result{results.length !== 1 ? 's' : ''} (demo data)
					</div>
					{results.map((business) => (
						<div
							key={business.providerId}
							className={`card cursor-pointer ${selected?.providerId === business.providerId ? 'ring-2 ring-red-500' : ''}`}
							onClick={() => setSelected(business)}
						>
							<div className="flex gap-3">
								{business.imageUrl && (
									<img
										src={business.imageUrl}
										alt={business.name}
										className="h-16 w-16 rounded object-cover border border-border"
									/>
								)}
								<div className="min-w-0 flex-1">
									<div className="text-white font-semibold truncate">{business.name}</div>
									{business.location && (
										<div className="text-gray-400 text-sm">
											{business.location.address1}, {business.location.city}, {business.location.state}
										</div>
									)}
									<div className="flex items-center gap-2 mt-1">
										{typeof business.rating === 'number' && (
											<div className="text-xs text-gray-300">
												⭐ {business.rating}
												{typeof business.reviewCount === 'number' && ` (${business.reviewCount} reviews)`}
											</div>
										)}
										{business.categories && business.categories.length > 0 && (
											<div className="text-xs text-gray-400">
												• {business.categories.join(', ')}
											</div>
										)}
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			)}

			{selected && (
				<Card title={selected.name}>
					<div className="space-y-2 text-sm">
						{selected.location && (
							<div>
								<strong className="text-gray-300">Address:</strong>{' '}
								<span className="text-gray-200">
									{selected.location.address1}, {selected.location.city}, {selected.location.state} {selected.location.zipCode}
								</span>
							</div>
						)}
						{typeof selected.rating === 'number' && (
							<div>
								<strong className="text-gray-300">Rating:</strong>{' '}
								<span className="text-gray-200">
									{selected.rating} {typeof selected.reviewCount === 'number' && `(${selected.reviewCount} reviews)`}
								</span>
							</div>
						)}
						{selected.categories && selected.categories.length > 0 && (
							<div>
								<strong className="text-gray-300">Categories:</strong>{' '}
								<span className="text-gray-200">{selected.categories.join(', ')}</span>
							</div>
						)}
						{selected.url && (
							<div>
								<a href={selected.url} target="_blank" rel="noreferrer" className="text-blue-300 hover:underline">
									Visit Website
								</a>
							</div>
						)}
					</div>
					<div className="mt-4">
						<Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
					</div>
				</Card>
			)}
		</div>
	)
}
