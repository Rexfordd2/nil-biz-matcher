import { useState, useEffect } from 'react'
import Card from './ui/Card'
import Button from './ui/Button'
import Input from './ui/Input'
import Select from './ui/Select'
import { SAMPLE_PROGRAMS } from '../recruiting/programData'
import type { CollegeProgram } from '../recruiting/programTypes'
import { assertDemoSafe } from '../lib/demoNetworkGuard'
import Observability from '../lib/obs'

type DemoRecruitingProps = {
	initialSport?: string
	initialLocation?: string
	onSearch: (sport: string, location: string) => void
}

export default function DemoRecruiting({ initialSport, initialLocation, onSearch }: DemoRecruitingProps) {
	const [sport, setSport] = useState(initialSport || '')
	const [location, setLocation] = useState(initialLocation || '')
	const [results, setResults] = useState<CollegeProgram[]>([])
	const [loading, setLoading] = useState(false)
	const [hasSearched, setHasSearched] = useState(false)
	const [selected, setSelected] = useState<CollegeProgram | null>(null)

	const SPORT_OPTIONS = ['', 'Football', 'Basketball', 'Baseball', 'Soccer', 'Volleyball', 'Track & Field']

	// Auto-search if initial params provided
	useEffect(() => {
		if (initialSport && initialLocation) {
			handleSearch()
		}
	}, []) // eslint-disable-line react-hooks/exhaustive-deps

	function handleSearch() {
		if (!sport.trim() || !location.trim()) return

		setLoading(true)
		setHasSearched(true)
		onSearch(sport.trim(), location.trim())

		try {
			// Production assertion: ensure we're only using local mock data
			assertDemoSafe('mock-program-search', 'GET')
			
			// Simulate search delay
			setTimeout(() => {
				const filtered = SAMPLE_PROGRAMS.filter((program) => {
					const sportMatch = !sport || program.sport.toLowerCase().includes(sport.toLowerCase())
					const locationMatch = !location || 
						program.location?.city?.toLowerCase().includes(location.toLowerCase()) ||
						program.location?.stateOrRegion?.toLowerCase().includes(location.toLowerCase())
					return sportMatch && locationMatch
				})
				setResults(filtered.slice(0, 10)) // Limit to 10 for demo
				setLoading(false)
			}, 500)
		} catch (err: any) {
			console.error('Demo search error:', err)
			Observability.log({
				feature: 'ui',
				route: 'demo.recruiting.error',
				status: 'error',
				errorMessage: err.message,
				meta: { error: 'Protected endpoint call detected' }
			})
			setResults([])
			setLoading(false)
			// Show friendly error in production
			if (!import.meta.env.DEV) {
				alert('Demo mode can only use local mock data. Please sign up for full access.')
			}
		}
	}

	return (
		<div className="space-y-6">
			<Card title="Recruiting Programs (Demo)">
				<div className="space-y-3">
					<Select
						value={sport}
						onChange={(e) => setSport(e.target.value)}
					>
						{SPORT_OPTIONS.map(s => (
							<option key={s} value={s}>{s || 'Any Sport'}</option>
						))}
					</Select>
					<Input
						value={location}
						onChange={(e) => setLocation(e.target.value)}
						placeholder="Location (City or State)"
						onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
					/>
					<Button onClick={handleSearch} className="w-full" disabled={loading || !sport || !location}>
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
						<div key={i} className="card animate-pulse bg-gray-800/40 h-32" />
					))}
				</div>
			)}

			{results.length > 0 && !loading && (
				<div className="space-y-3">
					<div className="text-sm text-gray-400 mb-2">
						Found {results.length} program{results.length !== 1 ? 's' : ''} (demo data)
					</div>
					{results.map((program) => (
						<div
							key={program.id}
							className={`card cursor-pointer ${selected?.id === program.id ? 'ring-2 ring-red-500' : ''}`}
							onClick={() => setSelected(program)}
						>
							<div className="space-y-1">
								<div className="text-white font-semibold">{program.name}</div>
								<div className="text-gray-400 text-sm">
									{program.sport} • {program.level} • {program.location?.city || 'N/A'}, {program.location?.stateOrRegion || 'N/A'}
								</div>
								{program.conference && (
									<div className="text-xs text-gray-500">Conference: {program.conference}</div>
								)}
								{program.recruiters && program.recruiters.length > 0 && (
									<div className="text-xs text-gray-400 mt-2">
										Contact: {program.recruiters[0].name} ({program.recruiters[0].role})
									</div>
								)}
							</div>
						</div>
					))}
				</div>
			)}

			{selected && (
				<Card title={selected.name}>
					<div className="space-y-3 text-sm">
						<div>
							<strong className="text-gray-300">Sport:</strong> <span className="text-gray-200">{selected.sport}</span>
						</div>
						<div>
							<strong className="text-gray-300">Level:</strong> <span className="text-gray-200">{selected.level}</span>
						</div>
						<div>
							<strong className="text-gray-300">Location:</strong>{' '}
							<span className="text-gray-200">
								{selected.location?.city || 'N/A'}, {selected.location?.stateOrRegion || 'N/A'}
							</span>
						</div>
						{selected.conference && (
							<div>
								<strong className="text-gray-300">Conference:</strong> <span className="text-gray-200">{selected.conference}</span>
							</div>
						)}
						{selected.academic && (
							<div>
								<strong className="text-gray-300">Academic:</strong>{' '}
								<span className="text-gray-200">
									{selected.academic.minGpaRange}
									{selected.academic.typicalMajors && ` • ${selected.academic.typicalMajors.join(', ')}`}
								</span>
							</div>
						)}
						{selected.recruiters && selected.recruiters.length > 0 && (
							<div>
								<strong className="text-gray-300">Recruiter:</strong>{' '}
								<span className="text-gray-200">
									{selected.recruiters[0].name} ({selected.recruiters[0].role})
									{selected.recruiters[0].email && ` • ${selected.recruiters[0].email}`}
								</span>
							</div>
						)}
						{selected.teamSiteUrl && (
							<div>
								<a href={selected.teamSiteUrl} target="_blank" rel="noreferrer" className="text-blue-300 hover:underline">
									Team Website
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
