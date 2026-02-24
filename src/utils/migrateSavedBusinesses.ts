import { load, save } from './storage'
import { listSavedBusinesses } from '../services/savedBusinesses'
import { upsertBusinessFromDiscover, upsertBusinessCanonical, saveUserBusiness } from '../services/userBusinesses'
import type { NormalizedPlace } from '../hooks/usePlacesSearch'
import type { Business } from '../types'
import type { SavedBusinessRow } from '../services/savedBusinesses'

const MIGRATION_FLAG_PREFIX = 'businesses_migrated_v1_'

/**
 * One-time migration: copy saved_businesses and localStorage businesses into
 * canonical businesses + user_businesses. Call when user is authenticated.
 * Uses localStorage flag per userId to avoid re-running.
 *
 * NOTE: The only consumer of the 'businesses' localStorage key is this migration
 * (read then clear). No other feature should load or save that key.
 */
export async function migrateSavedBusinesses(userId: string): Promise<{ migrated: boolean; error?: string }> {
	try {
		const flagKey = `${MIGRATION_FLAG_PREFIX}${userId}`
		if (load(flagKey, null) === 'true') {
			return { migrated: false }
		}

		// 1) Migrate Supabase saved_businesses -> businesses + user_businesses
		const { rows: savedRows } = await listSavedBusinesses()
		for (const row of savedRows as SavedBusinessRow[]) {
			const place: NormalizedPlace = {
				placeId: row.place_id,
				name: row.name,
				formattedAddress: row.address ?? undefined,
				location: row.lat != null && row.lng != null ? { lat: row.lat, lng: row.lng } : { lat: 0, lng: 0 },
				rating: row.rating ?? undefined,
			}
			const details = {
				phone: row.phone ?? undefined,
				website: row.website ?? undefined,
			}
			await upsertBusinessFromDiscover(place, details)
		}

		// 2) Migrate localStorage businesses -> businesses + user_businesses
		const localBusinesses = load<Business[]>('businesses', [])
		for (const b of localBusinesses) {
			const placeId = b.externalProviderId ?? `local-${b.id}`
			const canon = await upsertBusinessCanonical(placeId, {
				name: b.name,
				address: b.location || undefined,
				lat: b.coordinates?.latitude ?? undefined,
				lng: b.coordinates?.longitude ?? undefined,
				phone: b.phone ?? undefined,
				website: b.website ?? undefined,
				rating: b.rating ?? undefined,
			})
			if (!canon.ok) continue
			await saveUserBusiness(userId, placeId, b.status, b.tags)
		}
		if (localBusinesses.length > 0) {
			save('businesses', [])
		}

		save(flagKey, 'true')
		return { migrated: true }
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err)
		return { migrated: false, error: message }
	}
}
