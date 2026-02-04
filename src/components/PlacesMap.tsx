import { useEffect, useMemo, useRef } from 'react'
import { loadGoogleMaps } from '../lib/google/maps'
import type { NormalizedPlace } from '../hooks/usePlacesSearch'

type Props = {
	places: NormalizedPlace[]
	selectedPlaceId?: string | null
	onSelect?: (placeId: string) => void
	onIdle?: (state: { center: { lat: number, lng: number }, zoom: number, bounds?: google.maps.LatLngBounds | google.maps.LatLngBoundsLiteral }) => void
	className?: string
	height?: number
	initialZoom?: number
}

export default function PlacesMap({ places, selectedPlaceId, onSelect, onIdle, className, height = 420, initialZoom = 12 }: Props) {
	const containerRef = useRef<HTMLDivElement | null>(null)
	const mapRef = useRef<google.maps.Map | null>(null)
	const markersRef = useRef<Record<string, google.maps.Marker>>({})
	const idleListenerRef = useRef<google.maps.MapsEventListener | null>(null)

	const center = useMemo(() => {
		if (!Array.isArray(places) || places.length === 0) return { lat: 39.5, lng: -98.35 } // USA approximate center
		const selected = selectedPlaceId ? places.find(p => p.placeId === selectedPlaceId) : null
		if (selected) return selected.location
		const avgLat = places.reduce((s, p) => s + p.location.lat, 0) / places.length
		const avgLng = places.reduce((s, p) => s + p.location.lng, 0) / places.length
		return { lat: avgLat, lng: avgLng }
	}, [places, selectedPlaceId])

	// Initialize map
	useEffect(() => {
		let cancelled = false
		async function init() {
			const google = await loadGoogleMaps()
			if (cancelled) return
			if (!containerRef.current) return
			if (!mapRef.current) {
				mapRef.current = new google.maps.Map(containerRef.current, {
					center,
					zoom: initialZoom,
					mapTypeControl: false,
					streetViewControl: false,
					fullscreenControl: false
				})
				// Attach idle listener
				if (idleListenerRef.current) {
					idleListenerRef.current.remove()
					idleListenerRef.current = null
				}
				if (onIdle) {
					idleListenerRef.current = mapRef.current.addListener('idle', () => {
						if (!mapRef.current) return
						const c = mapRef.current.getCenter()
						const z = mapRef.current.getZoom() || initialZoom
						const b = mapRef.current.getBounds()
						onIdle({
							center: { lat: c?.lat() ?? center.lat, lng: c?.lng() ?? center.lng },
							zoom: z,
							bounds: b ? {
								north: b.getNorthEast().lat(),
								east: b.getNorthEast().lng(),
								south: b.getSouthWest().lat(),
								west: b.getSouthWest().lng()
							} : undefined
						})
					})
				}
			} else {
				mapRef.current.setCenter(center)
			}
		}
		init()
		return () => { cancelled = true }
	}, [center, onIdle, initialZoom])

	// Render markers
	useEffect(() => {
		let cancelled = false
		async function renderMarkers() {
			const google = await loadGoogleMaps()
			if (cancelled) return
			if (!mapRef.current) return

			// Remove markers not in current set
			for (const id of Object.keys(markersRef.current)) {
				if (!places.some(p => p.placeId === id)) {
					markersRef.current[id].setMap(null)
					delete markersRef.current[id]
				}
			}

			// Add/update markers
			for (const p of places) {
				let marker = markersRef.current[p.placeId]
				if (!marker) {
					marker = new google.maps.Marker({
						position: p.location,
						map: mapRef.current!,
						title: p.name
					})
					marker.addListener('click', () => {
						onSelect?.(p.placeId)
					})
					markersRef.current[p.placeId] = marker
				} else {
					marker.setPosition(p.location)
				}

				// Highlight selected marker via icon color
				if (p.placeId === selectedPlaceId) {
					marker.setIcon({
						path: google.maps.SymbolPath.CIRCLE,
						scale: 8,
						fillColor: '#ef4444',
						fillOpacity: 1,
						strokeColor: '#ffffff',
						strokeWeight: 2
					})
					mapRef.current!.panTo(p.location)
				} else {
					marker.setIcon(null as unknown as google.maps.Icon)
				}
			}
		}
		renderMarkers()
		return () => { cancelled = true }
	}, [places, onSelect, selectedPlaceId])

	return (
		<div className={className}>
			<div ref={containerRef} style={{ height, width: '100%' }} className="rounded-lg overflow-hidden border border-border" />
		</div>
	)
}


