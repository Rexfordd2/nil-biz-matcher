import { useEffect, useMemo, useRef, useState } from 'react'
import Card from './ui/Card'
import Button from './ui/Button'
import Input from './ui/Input'
import { loadGoogleMaps } from '../lib/googleMapsLoader'
import { usePlacesSearch, type NormalizedPlace } from '../hooks/usePlacesSearch'
import { usePlaceDetails } from '../hooks/usePlaceDetails'
import PlacesMap from './PlacesMap'
import { listSavedBusinesses, removeSavedBusiness, saveBusiness, type SavedBusinessRow } from '../services/savedBusinesses'
import Observability, { generateRequestId } from '../lib/obs'
import { supabaseEnvConfigured } from '../lib/supabaseClient'
import { useSupabaseSession } from '../context/SupabaseSessionContext'
import { saveUserData } from '../lib/userData'
import { normalizeError } from '../lib/errorHandling'

export default function Discover() {
	const hasClientKey = useMemo(() => {
		const k = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
		return !!(k && k.trim() !== '')
	}, [])

	// Editable inputs
	const [whatText, setWhatText] = useState('')
	const [whereText, setWhereText] = useState('')
	const [wherePlaceId, setWherePlaceId] = useState<string | undefined>(undefined)

	// Committed search params (trigger searches)
	const [searchParams, setSearchParams] = useState<{ query: string; locationText: string; locationPlaceId?: string; requestId?: string }>({
		query: '',
		locationText: ''
	})

	// Attach Places Autocomplete to the "Where" input
	const whereInputRef = useRef<HTMLInputElement | null>(null)
	useEffect(() => {
		let cleanup: (() => void) | undefined
		loadGoogleMaps().then((google) => {
			if (!whereInputRef.current) return
			const autocomplete = new google.maps.places.Autocomplete(whereInputRef.current, {
				// General location search; keep it broad
				types: ['geocode']
			})
			autocomplete.setFields(['place_id', 'name', 'formatted_address', 'geometry'])
			const listener = autocomplete.addListener('place_changed', () => {
				const place = autocomplete.getPlace()
				if (place) {
					setWhereText(place.formatted_address || place.name || whereInputRef.current?.value || '')
					if (place.place_id) {
						setWherePlaceId(place.place_id)
					}
				}
			})
			cleanup = () => {
				listener.remove()
			}
		}).catch(() => {
			// Autocomplete will simply not be enabled if script fails
		})
		return () => {
			try { cleanup?.() } catch {}
		}
	}, [])

	const { results, loading, error, isStale, selected, setSelected, retry } = usePlacesSearch(searchParams)
	const [hasSearched, setHasSearched] = useState(false)

	// Errors are handled and displayed to user, but no redirects

	function onSearch() {
		if (!hasClientKey) return
		if (!whatText || !whereText) return
		setHasSearched(true)
		const reqId = generateRequestId()
		Observability.log({
			feature: 'discover',
			route: 'ui.discover.search',
			status: 'ui_action',
			requestId: reqId,
			meta: { query: whatText, where: whereText }
		})
		
		// Save user data (non-blocking)
		saveUserData('discover_search', {
			what: whatText,
			where: whereText,
			ts: new Date().toISOString()
		}).catch(() => {
			// Errors are already logged in saveUserData
		})
		
		setSearchParams({ query: whatText, locationText: whereText, locationPlaceId: wherePlaceId, requestId: reqId })
	}

	function onSelect(placeId: string) {
		const found = results.find(r => r.placeId === placeId) || null
		setSelected(found)
	}

	const details = usePlaceDetails(selected?.placeId)

	const list = results

	// Saved businesses
	const [saved, setSaved] = useState<SavedBusinessRow[]>([])
	const [saving, setSaving] = useState(false)
	const [savedLoading, setSavedLoading] = useState(false)
	const [savedError, setSavedError] = useState<string | null>(null)
	const { user, loading: sessionLoading } = useSupabaseSession()

	async function refreshSaved() {
		if (!supabaseEnvConfigured) return
		// Gate on session ready and user present to avoid RLS/anon inconsistencies
		if (sessionLoading || !user) {
			setSaved([])
			setSavedError(null)
			return
		}
		setSavedLoading(true)
		try {
			const res = await listSavedBusinesses()
			if (res.error) {
				if (res.permission) {
					setSavedError(`Permission error loading saved (RLS). Please log in. ${res.code ? `Code: ${res.code}` : ''}`)
				} else {
					setSavedError(res.error)
				}
				setSaved([])
			} else {
				setSavedError(null)
				setSaved(res.rows)
			}
		} finally {
			setSavedLoading(false)
		}
	}

	useEffect(() => {
		// Refresh whenever session readiness or user changes
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		refreshSaved()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sessionLoading, user?.id])

	const isSelectedSaved = selected ? saved.some(s => s.place_id === selected.placeId) : false

	async function onSaveSelected() {
		if (!selected) return
		setSaving(true)
		try {
			const res = await saveBusiness(selected, details.details || null)
			if (res.ok) {
				await refreshSaved()
			} else {
				const msg = res.permission
					? `Permission error saving (RLS). Please log in. ${res.code ? `Code: ${res.code}` : ''}`
					: (res.reason || 'Save failed')
				// eslint-disable-next-line no-console
				console.warn('Save business failed:', msg)
				setSavedError(msg)
			}
		} finally {
			setSaving(false)
		}
	}

	async function onRemoveSaved(placeId: string) {
		const res = await removeSavedBusiness(placeId)
		if (!res.ok) {
			const msg = res.permission
				? `Permission error removing (RLS). Please log in. ${res.code ? `Code: ${res.code}` : ''}`
				: (res.reason || 'Delete failed')
			// eslint-disable-next-line no-console
			console.warn('Remove business failed:', msg)
			setSavedError(msg)
			return
		}
		await refreshSaved()
	}

	return (
		<div className="space-y-5">
			<div className="rounded-md border border-amber-400 bg-amber-900/30 px-3 py-2 text-amber-200 font-semibold uppercase tracking-wide">
				NEW DISCOVER UI ACTIVE
			</div>
			<Card title="Discover Businesses" actions={
				<Button onClick={onSearch} disabled={!hasClientKey || loading} className="red-glow">
					{loading ? 'Searching…' : 'Search'}
				</Button>
			}>
				{!hasClientKey && (
					<p className="text-yellow-300 text-sm mb-2">
						Missing <code>VITE_GOOGLE_MAPS_API_KEY</code>. Add it to your <code>.env</code> to enable search.
					</p>
				)}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
					<Input
						data-testid="discover-what-input"
						value={whatText}
						onChange={e => setWhatText(e.target.value)}
						placeholder="What (pizza, gym, store...)"
					/>
					<Input
						data-testid="discover-where-input"
						ref={whereInputRef}
						value={whereText}
						onChange={e => { setWhereText(e.target.value); setWherePlaceId(undefined) }}
						placeholder="Where (City, ST or zip)"
					/>
					<div className="flex items-center">
						<Button data-testid="discover-search-button" onClick={onSearch} className="w-full" disabled={!hasClientKey || loading || !whatText || !whereText}>
							{loading ? 'Searching…' : 'Search'}
						</Button>
					</div>
				</div>
				{error && (
					<div data-testid="discover-error-banner" className="mt-3 text-sm text-red-300 flex items-center justify-between">
						<span>{isStale ? 'Showing cached results — ' : ''}{error}</span>
						<Button variant="secondary" onClick={() => retry()} disabled={loading}>Retry</Button>
					</div>
				)}
			</Card>

			{list.length === 0 && !loading && (
				<div data-testid="discover-results-container" className="text-gray-400 text-sm">
					{hasSearched ? 'No matches found.' : 'Search to see results.'}
				</div>
			)}

			{loading && (
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
					<div className="space-y-3">
						<div className="card h-[420px] animate-pulse bg-gray-800/40" />
					</div>
					<div className="space-y-3">
						{Array.from({ length: 5 }).map((_, i) => (
							<div key={i} className="card animate-pulse bg-gray-800/40 h-20" />
						))}
					</div>
				</div>
			)}

			{list.length > 0 && !loading && (
				<div data-testid="discover-results-container" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
					{isStale && (
						<div className="md:col-span-2 rounded-md border border-amber-400 bg-amber-900/30 px-3 py-2 text-amber-200 text-sm">
							Showing cached results — retrying…
						</div>
					)}
					<div className="space-y-3">
						<PlacesMap
							places={list}
							selectedPlaceId={selected?.placeId}
							onSelect={onSelect}
						/>
						{/* Details panel on desktop */}
						{selected && (
							<div className="hidden md:block card">
								<DetailsPanel
									place={selected}
									loading={details.loading}
									error={details.error}
									info={details.details || null}
									onSave={onSaveSelected}
									saving={saving}
									isSaved={isSelectedSaved}
								/>
							</div>
						)}
					</div>
					<div className="space-y-3">
						{list.map((p) => (
							<button
								key={p.placeId}
								className={`card text-left w-full ${selected?.placeId === p.placeId ? 'ring-2 ring-red-500' : ''}`}
								onClick={() => onSelect(p.placeId)}
							>
								<div className="flex gap-3">
									{p.photoUrl && (
										<img src={p.photoUrl} alt={p.name} className="h-16 w-16 rounded object-cover border border-border" />
									)}
									<div className="min-w-0">
										<div className="text-white font-semibold truncate">{p.name}</div>
										{p.formattedAddress && (
											<div className="text-gray-400 text-sm truncate">{p.formattedAddress}</div>
										)}
										{typeof p.rating === 'number' && (
											<div className="text-xs text-gray-400 mt-1">
												Rating {p.rating}{typeof p.userRatingsTotal === 'number' ? ` (${p.userRatingsTotal})` : ''}
											</div>
										)}
									</div>
								</div>
							</button>
						))}
					</div>
				</div>
			)}

			{/* Mobile details modal */}
			{selected && (
				<div className="md:hidden">
					<div className="fixed inset-0 bg-black/50 z-20" onClick={() => setSelected(null)} />
					<div className="fixed bottom-0 left-0 right-0 z-30 p-4">
						<div className="card">
							<DetailsPanel
								place={selected}
								loading={details.loading}
								error={details.error}
								info={details.details || null}
								onSave={onSaveSelected}
								saving={saving}
								isSaved={isSelectedSaved}
							/>
							<div className="mt-3 flex justify-end">
								<Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Saved Businesses */}
			<Card title="Saved Businesses">
				{!supabaseEnvConfigured && (
					<div className="text-sm text-yellow-300 mb-3">
						Supabase is not configured; saving is disabled.
					</div>
				)}
				{sessionLoading && (
					<div className="text-sm text-gray-400 mb-2">Checking session…</div>
				)}
				{!sessionLoading && !user && (
					<div className="text-sm text-gray-400 mb-2">Log in to view and save businesses.</div>
				)}
				{savedError && (
					<div className="text-sm text-red-400 mb-2">{savedError}</div>
				)}
				{savedLoading && <div className="text-sm text-gray-400">Loading saved…</div>}
				{!savedLoading && saved.length === 0 && (
					<div className="text-sm text-gray-400">No saved businesses yet.</div>
				)}
				{saved.length > 0 && (
					<ul className="space-y-2">
						{saved.map(sb => (
							<li key={sb.id} className="card flex items-center justify-between">
								<div className="min-w-0">
									<div className="text-white font-medium truncate">{sb.name}</div>
									{sb.address && <div className="text-gray-400 text-sm truncate">{sb.address}</div>}
								</div>
								<div className="flex items-center gap-2 ml-3">
									{sb.website && (
										<a className="text-blue-300 hover:underline text-sm" href={sb.website} target="_blank" rel="noreferrer">Website</a>
									)}
									<Button variant="ghost" onClick={() => onRemoveSaved(sb.place_id)}>Remove</Button>
								</div>
							</li>
						))}
					</ul>
				)}
			</Card>
		</div>
	)
}

function DetailsPanel({ place, loading, error, info, onSave, saving, isSaved }: {
	place: NormalizedPlace
	loading: boolean
	error: string | null
	info: any
	onSave?: () => void
	saving?: boolean
	isSaved?: boolean
}) {
	return (
		<div>
			<div className="flex items-center justify-between mb-1">
				<div className="text-white font-semibold truncate">{place.name}</div>
				{typeof place.rating === 'number' && (
					<div className="text-xs text-gray-300">Rating {place.rating}{typeof place.userRatingsTotal === 'number' ? ` (${place.userRatingsTotal})` : ''}</div>
				)}
			</div>
			{place.formattedAddress && <div className="text-gray-400 text-sm">{place.formattedAddress}</div>}
			{loading && <div className="text-sm text-gray-400 mt-2">Loading details…</div>}
			{error && <div className="text-sm text-red-300 mt-2">{error}</div>}
			{!loading && !error && info && (
				<div className="mt-3 space-y-1 text-sm">
					{info.phone && <div className="text-gray-300">Phone: <span className="text-gray-200">{info.phone}</span></div>}
					{info.website && (
						<div className="truncate">
							<a href={info.website} target="_blank" rel="noreferrer" className="text-blue-300 hover:underline">{info.website}</a>
						</div>
					)}
					{info.googleMapsUrl && (
						<div className="truncate">
							<a href={info.googleMapsUrl} target="_blank" rel="noreferrer" className="text-blue-300 hover:underline">Open in Google Maps</a>
						</div>
					)}
					{Array.isArray(info.openingHours) && info.openingHours.length > 0 && (
						<div className="pt-2">
							<div className="text-gray-400">Opening hours:</div>
							<ul className="list-disc list-inside text-gray-300">
								{info.openingHours.map((h: string, i: number) => <li key={i}>{h}</li>)}
							</ul>
						</div>
					)}
				</div>
			)}

			<div className="mt-3">
				{isSaved ? (
					<Button disabled className="bg-green-700/60 cursor-default">Saved</Button>
				) : (
					<Button onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
				)}
			</div>
		</div>
	)
}

