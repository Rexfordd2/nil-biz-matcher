import { supabase, supabaseEnvConfigured } from '../lib/supabaseClient'
import type { NormalizedPlace } from '../hooks/usePlacesSearch'

export type SavedBusinessRow = {
	id: string
	user_id: string
	place_id: string
	name: string
	address: string | null
	lat: number | null
	lng: number | null
	phone: string | null
	website: string | null
	rating: number | null
	raw: unknown
	created_at: string
}

export async function saveBusiness(business: NormalizedPlace, details: {
	phone?: string
	website?: string
	openingHours?: string[]
	googleMapsUrl?: string
} | null): Promise<{ ok: true } | { ok: false; reason: string }> {
	if (!supabaseEnvConfigured || !supabase) return { ok: false, reason: 'Supabase not configured' }
	const { data: userData } = await supabase.auth.getUser()
	if (!userData.user) return { ok: false, reason: 'Not authenticated' }
	const uid = userData.user.id

	const record = {
		user_id: uid,
		place_id: business.placeId,
		name: business.name,
		address: business.formattedAddress ?? null,
		lat: business.location?.lat ?? null,
		lng: business.location?.lng ?? null,
		phone: details?.phone ?? null,
		website: details?.website ?? null,
		rating: typeof business.rating === 'number' ? business.rating : null,
		raw: { business, details }
	}

	const { error } = await supabase
		.from('saved_businesses')
		.upsert(record, { onConflict: 'user_id,place_id', ignoreDuplicates: true })

	if (error) {
		// Unique violation or other errors should be reported gracefully
		if (String(error.code) === '23505') {
			return { ok: true }
		}
		return { ok: false, reason: error.message || 'Save failed' }
	}
	return { ok: true }
}

export async function listSavedBusinesses(): Promise<SavedBusinessRow[]> {
	if (!supabaseEnvConfigured || !supabase) return []
	const { data, error } = await supabase
		.from('saved_businesses')
		.select('*')
		.order('created_at', { ascending: false })
	if (error) {
		return []
	}
	return (data as SavedBusinessRow[]) || []
}

export async function removeSavedBusiness(placeId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
	if (!supabaseEnvConfigured || !supabase) return { ok: false, reason: 'Supabase not configured' }
	const { error } = await supabase
		.from('saved_businesses')
		.delete()
		.eq('place_id', placeId)
	if (error) return { ok: false, reason: error.message || 'Delete failed' }
	return { ok: true }
}


