import type { Business, BusinessProfile } from '../types'

export type FilterBusinessesOptions = {
	status?: Business['status']
	tags?: string[]
	types?: string[]
	text?: string
	radiusMiles?: number
	centerLatLng?: { lat: number; lng: number }
}

/** Approximate distance in miles between two points (haversine). */
function distanceMiles(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number
): number {
	const R = 3959 // Earth radius in miles
	const dLat = ((lat2 - lat1) * Math.PI) / 180
	const dLng = ((lng2 - lng1) * Math.PI) / 180
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLng / 2) *
			Math.sin(dLng / 2)
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
	return R * c
}

/**
 * Pure filter: returns businesses matching all provided options.
 * Missing coordinates: included when radius filter is used (so local/synthetic businesses are not dropped).
 */
export function filterBusinesses(
	businesses: BusinessProfile[],
	opts: FilterBusinessesOptions
): BusinessProfile[] {
	return businesses.filter(b => {
		if (opts.status !== undefined) {
			const s = b.status || 'Not Contacted'
			if (s !== opts.status) return false
		}
		if (opts.tags && opts.tags.length > 0) {
			const bizTags = b.tags ?? []
			const hasMatch = opts.tags.some(t => bizTags.includes(t))
			if (!hasMatch) return false
		}
		if (opts.types && opts.types.length > 0) {
			const bizTypes = b.types ?? []
			const hasMatch = opts.types.some(t => bizTypes.includes(t))
			if (!hasMatch) return false
		}
		if (opts.text && opts.text.trim()) {
			const q = opts.text.trim().toLowerCase()
			const match =
				(b.location?.toLowerCase().includes(q)) ||
				(b.name?.toLowerCase().includes(q))
			if (!match) return false
		}
		if (
			opts.radiusMiles != null &&
			opts.radiusMiles > 0 &&
			opts.centerLatLng
		) {
			const lat = b.coordinates?.latitude
			const lng = b.coordinates?.longitude
			if (lat == null || lng == null) return true // include businesses without coords
			const dist = distanceMiles(
				opts.centerLatLng.lat,
				opts.centerLatLng.lng,
				lat,
				lng
			)
			if (dist > opts.radiusMiles) return false
		}
		return true
	})
}
