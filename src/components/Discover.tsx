import { useEffect, useMemo, useRef, useState } from 'react'
import Card from './ui/Card'
import Button from './ui/Button'
import Input from './ui/Input'
import { loadGoogleMaps } from '../lib/googleMapsLoader'
import { usePlacesSearch, type NormalizedPlace } from '../hooks/usePlacesSearch'
import { usePlaceDetails } from '../hooks/usePlaceDetails'
import PlacesMap from './PlacesMap'
import { listSavedBusinesses, removeSavedBusiness, saveBusiness, type SavedBusinessRow } from '../services/savedBusinesses'
import { supabaseEnvConfigured } from '../lib/supabaseClient'

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
	const [searchParams, setSearchParams] = useState<{ query: string; locationText: string; locationPlaceId?: string }>({
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

	const { results, loading, error, selected, setSelected } = usePlacesSearch(searchParams)

	function onSearch() {
		if (!hasClientKey) return
		if (!whatText || !whereText) return
		setSearchParams({ query: whatText, locationText: whereText, locationPlaceId: wherePlaceId })
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

	async function refreshSaved() {
		if (!supabaseEnvConfigured) return
		setSavedLoading(true)
		try {
			const rows = await listSavedBusinesses()
			setSaved(rows)
		} finally {
			setSavedLoading(false)
		}
	}

	useEffect(() => {
		refreshSaved()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const isSelectedSaved = selected ? saved.some(s => s.place_id === selected.placeId) : false

	async function onSaveSelected() {
		if (!selected) return
		setSaving(true)
		try {
			const res = await saveBusiness(selected, details.details || null)
			if (res.ok) {
				await refreshSaved()
			}
		} finally {
			setSaving(false)
		}
	}

	async function onRemoveSaved(placeId: string) {
		await removeSavedBusiness(placeId)
		await refreshSaved()
	}

	return (
		<div className="space-y-5">
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
						value={whatText}
						onChange={e => setWhatText(e.target.value)}
						placeholder="What (pizza, gym, store...)"
					/>
					<Input
						ref={whereInputRef}
						value={whereText}
						onChange={e => { setWhereText(e.target.value); setWherePlaceId(undefined) }}
						placeholder="Where (City, ST or zip)"
					/>
					<div className="flex items-center">
						<Button onClick={onSearch} className="w-full" disabled={!hasClientKey || loading || !whatText || !whereText}>
							{loading ? 'Searching…' : 'Search'}
						</Button>
					</div>
				</div>
				{error && (
					<div className="mt-3 text-sm text-red-300">{error}</div>
				)}
			</Card>

			{list.length === 0 && !loading && (
				<div className="text-gray-400 text-sm">Search to see results.</div>
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
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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

