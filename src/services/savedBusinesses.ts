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

function parseSupabaseError(err: any): { code?: string; message: string; isPermission: boolean } {
	const code = err?.code ? String(err.code) : undefined
	const message = typeof err?.message === 'string' ? err.message : 'Unknown error'
	const lower = message.toLowerCase()
	const isPermission =
		code === '42501' || // insufficient_privilege
		code === 'PGRST301' || // anon not allowed (example)
		code === 'PGRST302' || // RLS denied (example)
		lower.includes('permission') ||
		lower.includes('rls') ||
		lower.includes('not authorized') ||
		lower.includes('unauthorized')
	return { code, message, isPermission }
}

export async function saveBusiness(business: NormalizedPlace, details: {
	phone?: string
	website?: string
	openingHours?: string[]
	googleMapsUrl?: string
} | null): Promise<{ ok: true } | { ok: false; reason: string; code?: string; permission?: boolean }> {
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
		const info = parseSupabaseError(error)
		if (String(error.code) === '23505') {
			return { ok: true }
		}
		return { ok: false, reason: info.message || 'Save failed', code: info.code, permission: info.isPermission }
	}
	return { ok: true }
}

export async function listSavedBusinesses(): Promise<{ rows: SavedBusinessRow[]; error?: string; code?: string; permission?: boolean }> {
	if (!supabaseEnvConfigured || !supabase) return { rows: [], error: 'Supabase not configured' }
	const { data, error } = await supabase
		.from('saved_businesses')
		.select('*')
		.order('created_at', { ascending: false })
	if (error) {
		const info = parseSupabaseError(error)
		return { rows: [], error: info.message, code: info.code, permission: info.isPermission }
	}
	return { rows: (data as SavedBusinessRow[]) || [] }
}

export async function removeSavedBusiness(placeId: string): Promise<{ ok: true } | { ok: false; reason: string; code?: string; permission?: boolean }> {
	if (!supabaseEnvConfigured || !supabase) return { ok: false, reason: 'Supabase not configured' }
	const { error, status } = await supabase
		.from('saved_businesses')
		.delete()
		.eq('place_id', placeId)
	if (error) {
		const info = parseSupabaseError(error)
		return { ok: false, reason: info.message || 'Delete failed', code: info.code, permission: info.isPermission }
	}
	return { ok: true }
}


