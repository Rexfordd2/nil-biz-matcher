import { supabase, supabaseEnvConfigured } from '../lib/supabaseClient'
import type { NormalizedPlace } from '../hooks/usePlacesSearch'
import type { Business, BusinessProfile } from '../types'

const DEFAULT_STATUS: Business['status'] = 'Not Contacted'

/** Shown when businesses/user_businesses tables are missing (42P01). Used by useMyBusinesses to show migration banner. */
export const MIGRATION_REQUIRED_MESSAGE =
	'Businesses tables are not set up. Run the canonical businesses migration in Supabase SQL Editor. See supabase/migrations/20260223_canonical_businesses_user_businesses.sql'

function isSchemaMissingError(code: string | undefined, message: string): boolean {
	if (code === '42P01') return true
	const lower = message.toLowerCase()
	return lower.includes('does not exist') && lower.includes('relation')
}

/**
 * Lightweight preflight: check that businesses and user_businesses tables exist.
 * Uses select limit 1 on each; if either errors with 42P01 / relation does not exist, returns ok: false.
 */
export async function checkCanonicalBusinessTables(): Promise<{ ok: boolean }> {
	if (!supabaseEnvConfigured || !supabase) return { ok: false }
	const { error: bizErr } = await supabase.from('businesses').select('place_id').limit(1)
	if (bizErr && isSchemaMissingError((bizErr as { code?: string }).code, (bizErr as { message?: string }).message ?? '')) return { ok: false }
	const { error: ubErr } = await supabase.from('user_businesses').select('place_id').limit(1)
	if (ubErr && isSchemaMissingError((ubErr as { code?: string }).code, (ubErr as { message?: string }).message ?? '')) return { ok: false }
	return { ok: true }
}

type PlaceDetails = {
	phone?: string
	website?: string
	openingHours?: string[]
	googleMapsUrl?: string
} | null

export type UserBusinessProfilePatch = {
	status?: Business['status']
	tags?: string[]
}

function parseSupabaseError(err: unknown): { code?: string; message: string; isPermission: boolean } {
	const e = err as { code?: string; message?: string }
	const code = e?.code != null ? String(e.code) : undefined
	const message = typeof e?.message === 'string' ? e.message : 'Unknown error'
	const lower = message.toLowerCase()
	const isPermission =
		code === '42501' ||
		code === 'PGRST301' ||
		code === 'PGRST302' ||
		lower.includes('permission') ||
		lower.includes('rls') ||
		lower.includes('not authorized') ||
		lower.includes('unauthorized')
	return { code, message, isPermission }
}

function rowToBusinessProfile(
	b: { place_id: string; name: string; address: string | null; lat: number | null; lng: number | null; phone: string | null; website: string | null; rating: number | null; types: string[] | null; raw: unknown; created_at: string },
	ub: { status: string | null; tags: string[] | null; created_at: string }
): BusinessProfile {
	const createdAt = new Date(ub?.created_at || b.created_at).getTime()
	return {
		id: b.place_id,
		name: b.name,
		location: b.address ?? '',
		rating: typeof b.rating === 'number' ? b.rating : undefined,
		website: b.website ?? undefined,
		phone: b.phone ?? undefined,
		coordinates: b.lat != null && b.lng != null ? { latitude: b.lat, longitude: b.lng } : undefined,
		externalProviderId: b.place_id.startsWith('local-') ? undefined : b.place_id,
		externalProvider: b.place_id.startsWith('local-') ? undefined : 'google',
		description: '',
		status: (ub?.status as Business['status']) ?? DEFAULT_STATUS,
		tags: Array.isArray(ub?.tags) ? ub.tags : [],
		types: Array.isArray(b.types) ? b.types : [],
		createdAt,
	}
}

/**
 * Upsert canonical businesses row and user_businesses row from Discover place result.
 * Single pipeline for Discover "Save".
 */
export async function upsertBusinessFromDiscover(
	placeResult: NormalizedPlace,
	details: PlaceDetails
): Promise<{ ok: true } | { ok: false; reason: string; code?: string; permission?: boolean }> {
	if (!supabaseEnvConfigured || !supabase) return { ok: false, reason: 'Supabase not configured' }
	const { data: userData } = await supabase.auth.getUser()
	if (!userData.user) return { ok: false, reason: 'Not authenticated', permission: true }
	const uid = userData.user.id

	const placeId = placeResult.placeId
	const businessRow = {
		place_id: placeId,
		name: placeResult.name,
		address: placeResult.formattedAddress ?? null,
		lat: placeResult.location?.lat ?? null,
		lng: placeResult.location?.lng ?? null,
		phone: details?.phone ?? null,
		website: details?.website ?? null,
		rating: typeof placeResult.rating === 'number' ? placeResult.rating : null,
		types: placeResult.types ?? [],
		raw: { placeResult, details },
		updated_at: new Date().toISOString(),
	}

	const { error: errBusiness } = await supabase
		.from('businesses')
		.upsert(businessRow, { onConflict: 'place_id', ignoreDuplicates: false })

	if (errBusiness) {
		const info = parseSupabaseError(errBusiness)
		return { ok: false, reason: info.message || 'Failed to save business', code: info.code, permission: info.isPermission }
	}

	const userBusinessRow = {
		user_id: uid,
		place_id: placeId,
		status: DEFAULT_STATUS,
		tags: [],
		updated_at: new Date().toISOString(),
	}

	const { error: errUser } = await supabase
		.from('user_businesses')
		.upsert(userBusinessRow, { onConflict: 'user_id,place_id', ignoreDuplicates: false })

	if (errUser) {
		const info = parseSupabaseError(errUser)
		if (String((errUser as { code?: string }).code) === '23505') return { ok: true }
		return { ok: false, reason: info.message || 'Failed to save user business', code: info.code, permission: info.isPermission }
	}
	return { ok: true }
}

/**
 * Upsert a canonical businesses row only (e.g. for synthetic place_id from form or migration).
 * Use before saveUserBusiness when the business is not from Discover.
 */
export async function upsertBusinessCanonical(placeId: string, minimal: {
	name: string
	address?: string | null
	lat?: number | null
	lng?: number | null
	phone?: string | null
	website?: string | null
	rating?: number | null
}): Promise<{ ok: true } | { ok: false; reason: string; code?: string; permission?: boolean }> {
	if (!supabaseEnvConfigured || !supabase) return { ok: false, reason: 'Supabase not configured' }

	const row = {
		place_id: placeId,
		name: minimal.name,
		address: minimal.address ?? null,
		lat: minimal.lat ?? null,
		lng: minimal.lng ?? null,
		phone: minimal.phone ?? null,
		website: minimal.website ?? null,
		rating: minimal.rating ?? null,
		types: [],
		raw: {},
		updated_at: new Date().toISOString(),
	}

	const { error } = await supabase
		.from('businesses')
		.upsert(row, { onConflict: 'place_id', ignoreDuplicates: false })

	if (error) {
		const info = parseSupabaseError(error)
		return { ok: false, reason: info.message || 'Failed to upsert business', code: info.code, permission: info.isPermission }
	}
	return { ok: true }
}

/**
 * Ensure user_businesses row exists for (userId, placeId). Caller must have already upserted businesses row for placeId.
 */
export async function saveUserBusiness(
	userId: string,
	placeId: string,
	initialStatus?: Business['status'],
	tags?: string[]
): Promise<{ ok: true } | { ok: false; reason: string; code?: string; permission?: boolean }> {
	if (!supabaseEnvConfigured || !supabase) return { ok: false, reason: 'Supabase not configured' }

	const row = {
		user_id: userId,
		place_id: placeId,
		status: initialStatus ?? DEFAULT_STATUS,
		tags: tags ?? [],
		updated_at: new Date().toISOString(),
	}

	const { error } = await supabase
		.from('user_businesses')
		.upsert(row, { onConflict: 'user_id,place_id', ignoreDuplicates: false })

	if (error) {
		const info = parseSupabaseError(error)
		return { ok: false, reason: info.message || 'Save failed', code: info.code, permission: info.isPermission }
	}
	return { ok: true }
}

/**
 * Update only user_businesses overlay for (userId, placeId).
 */
export async function updateUserBusinessProfile(
	userId: string,
	placeId: string,
	patch: UserBusinessProfilePatch
): Promise<{ ok: true } | { ok: false; reason: string; code?: string; permission?: boolean }> {
	if (!supabaseEnvConfigured || !supabase) return { ok: false, reason: 'Supabase not configured' }

	const updates: { status?: string; tags?: string[]; updated_at: string } = {
		updated_at: new Date().toISOString(),
	}
	if (patch.status !== undefined) updates.status = patch.status
	if (patch.tags !== undefined) updates.tags = patch.tags

	const { error } = await supabase
		.from('user_businesses')
		.update(updates)
		.eq('user_id', userId)
		.eq('place_id', placeId)

	if (error) {
		const info = parseSupabaseError(error)
		return { ok: false, reason: info.message || 'Update failed', code: info.code, permission: info.isPermission }
	}
	return { ok: true }
}

/**
 * List merged BusinessProfile[] for the user (user_businesses joined with businesses).
 */
export async function listUserBusinesses(userId: string): Promise<{
	rows: BusinessProfile[]
	error?: string
	code?: string
	permission?: boolean
}> {
	if (!supabaseEnvConfigured || !supabase) return { rows: [], error: 'Supabase not configured' }

	const { data: ubData, error: ubError } = await supabase
		.from('user_businesses')
		.select('place_id, status, tags, created_at')
		.eq('user_id', userId)
		.order('created_at', { ascending: false })

	if (ubError) {
		const info = parseSupabaseError(ubError)
		if (isSchemaMissingError(info.code, info.message)) {
			return { rows: [], error: MIGRATION_REQUIRED_MESSAGE, code: info.code ?? '42P01', permission: info.isPermission }
		}
		return { rows: [], error: info.message, code: info.code, permission: info.isPermission }
	}

	if (!ubData?.length) return { rows: [] }

	const placeIds = ubData.map((r: { place_id: string }) => r.place_id)
	const { data: bizData, error: bizError } = await supabase
		.from('businesses')
		.select('place_id, name, address, lat, lng, phone, website, rating, types, raw, created_at')
		.in('place_id', placeIds)

	if (bizError) {
		const info = parseSupabaseError(bizError)
		if (isSchemaMissingError(info.code, info.message)) {
			return { rows: [], error: MIGRATION_REQUIRED_MESSAGE, code: info.code ?? '42P01', permission: info.isPermission }
		}
		return { rows: [], error: info.message, code: info.code, permission: info.isPermission }
	}

	const bizByPlace = new Map((bizData || []).map((b: { place_id: string }) => [b.place_id, b]))
	const rows: BusinessProfile[] = []
	for (const ub of ubData as { place_id: string; status: string | null; tags: string[] | null; created_at: string }[]) {
		const b = bizByPlace.get(ub.place_id)
		if (!b) continue
		rows.push(rowToBusinessProfile(b as Parameters<typeof rowToBusinessProfile>[0], ub))
	}
	return { rows }
}

/**
 * Remove user's link to a business (delete from user_businesses). Canonical row remains.
 */
export async function removeUserBusiness(placeId: string): Promise<{ ok: true } | { ok: false; reason: string; code?: string; permission?: boolean }> {
	if (!supabaseEnvConfigured || !supabase) return { ok: false, reason: 'Supabase not configured' }
	const { data: userData } = await supabase.auth.getUser()
	if (!userData.user) return { ok: false, reason: 'Not authenticated', permission: true }
	const uid = userData.user.id

	const { error } = await supabase
		.from('user_businesses')
		.delete()
		.eq('user_id', uid)
		.eq('place_id', placeId)

	if (error) {
		const info = parseSupabaseError(error)
		return { ok: false, reason: info.message || 'Delete failed', code: info.code, permission: info.isPermission }
	}
	return { ok: true }
}
