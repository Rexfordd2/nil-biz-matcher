import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L, { LatLngExpression } from 'leaflet'
import { CollegeProgram } from '../recruiting/programTypes'

type Props = {
	programs: CollegeProgram[]
	selectedId?: string | null
	onSelectProgram?: (id: string) => void
}

const defaultCenter: LatLngExpression = [39.8283, -98.5795] // USA centroid fallback

function getMarkerIcon(selected: boolean) {
	return L.divIcon({
		className: selected ? 'biz-marker-selected' : 'biz-marker',
		html: `<div style="width:14px;height:14px;border-radius:9999px;${selected ? 'background:#ef4444;border:2px solid white;box-shadow:0 0 0 2px #ef4444;' : 'background:#60a5fa;border:2px solid white;box-shadow:0 0 0 2px #60a5fa;'}"></div>`,
		iconSize: [14, 14],
		iconAnchor: [7, 7]
	})
}

function MapAutoCenter({ center }: { center: LatLngExpression }) {
	const map = useMap()
	useEffect(() => {
		map.setView(center, map.getZoom() || 6)
	}, [center, map])
	return null
}

export default function ProgramMap({ programs, selectedId, onSelectProgram }: Props) {
	const points = useMemo(
		() =>
			programs
				.map(p => ({
					id: p.id,
					name: p.name,
					lat: p.location?.latitude,
					lng: p.location?.longitude
				}))
				.filter(p => typeof p.lat === 'number' && typeof p.lng === 'number') as {
				id: string
				name: string
				lat: number
				lng: number
			}[],
		[programs]
	)

	const hasCoords = points.length > 0

	const center: LatLngExpression = useMemo(() => {
		if (!hasCoords) return defaultCenter
		const selected = selectedId ? points.find(p => p.id === selectedId) : null
		if (selected) return [selected.lat, selected.lng]
		const avgLat = points.reduce((s, p) => s + p.lat, 0) / points.length
		const avgLng = points.reduce((s, p) => s + p.lng, 0) / points.length
		return [avgLat, avgLng]
	}, [hasCoords, points, selectedId])

	if (!hasCoords) {
		return (
			<div className="card text-sm text-gray-300">
				Map not available for these results (no coordinates).
			</div>
		)
	}

	return (
		<div className="rounded-lg overflow-hidden border border-border">
			<MapContainer center={center} zoom={6} style={{ height: 420, width: '100%' }}>
				<MapAutoCenter center={center} />
				<TileLayer
					url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
					attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
				/>
				{points.map(p => (
					<Marker
						key={p.id}
						position={[p.lat, p.lng]}
						icon={getMarkerIcon(p.id === selectedId)}
						eventHandlers={{
							click() {
								onSelectProgram?.(p.id)
							}
						}}
					/>
				))}
			</MapContainer>
		</div>
	)
}


