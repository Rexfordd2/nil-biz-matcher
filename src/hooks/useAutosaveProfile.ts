import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { AthleteProfile } from '../types'
import { supabase, supabaseEnvConfigured } from '../lib/supabaseClient'
import Observability, { generateRequestId } from '../lib/obs'

type Status = 'idle' | 'saving' | 'saved' | 'error' | 'loading'

/**
 * Deep merge utility: merges patch into base recursively
 * - Primitive values in patch overwrite base
 * - Arrays in patch replace base arrays entirely
 * - Objects are merged recursively
 * - Undefined values in patch are ignored (base value preserved)
 */
function deepMerge<T>(base: T, patch: Partial<T>): T {
	if (!base || typeof base !== 'object' || Array.isArray(base)) {
		// Base is primitive or array - return patch if defined, else base
		return patch !== undefined ? (patch as T) : base
	}
	
	if (!patch || typeof patch !== 'object') {
		return base
	}
	
	const result = { ...base } as any
	
	for (const key in patch) {
		if (patch.hasOwnProperty(key)) {
			const patchValue = patch[key]
			const baseValue = (base as any)[key]
			
			// If patch value is undefined, keep base value
			if (patchValue === undefined) {
				continue
			}
			
			// If patch value is array, replace entirely
			if (Array.isArray(patchValue)) {
				result[key] = patchValue
			}
			// If both are objects, merge recursively
			else if (
				typeof patchValue === 'object' &&
				patchValue !== null &&
				typeof baseValue === 'object' &&
				baseValue !== null &&
				!Array.isArray(baseValue)
			) {
				result[key] = deepMerge(baseValue, patchValue)
			}
			// Otherwise, overwrite with patch value
			else {
				result[key] = patchValue
			}
		}
	}
	
	return result as T
}

/**
 * Count non-undefined keys in an object recursively
 */
function countSignificantKeys(obj: any): number {
	if (!obj || typeof obj !== 'object') return 0
	
	let count = 0
	for (const key in obj) {
		if (obj.hasOwnProperty(key)) {
			const value = obj[key]
			if (value !== undefined && value !== null) {
				count++
				// Also count nested keys for arrays of objects
				if (Array.isArray(value)) {
					value.forEach(item => {
						if (typeof item === 'object' && item !== null) {
							count += countSignificantKeys(item)
						}
					})
				}
			}
		}
	}
	return count
}

export type SupabaseErrorRaw = {
	status?: number | string
	code?: string
	message?: string
	details?: string
	hint?: string
	timestamp?: number
	userId?: string
	payloadKeys?: string[]
}

export function useAutosaveProfile(params: {
	user: User | null
	debounceMs?: number
}): {
	initialProfile: AthleteProfile | undefined
	status: Status
	statusText: string
	lastSavedAt: number | null
	error: string | null
	errorRaw: SupabaseErrorRaw | null
	lastSaveAttempt: number | null
	profileFetched: boolean
	onDraftChange: (draft: AthleteProfile) => void
	saveNow: () => Promise<void>
	refresh: () => void
} {
	const userId = params.user?.id || null
	const debounceMs = params.debounceMs ?? 800

	const [initialProfile, setInitialProfile] = useState<AthleteProfile | undefined>(undefined)
	const [status, setStatus] = useState<Status>('loading')
	const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
	const [lastSaveAttempt, setLastSaveAttempt] = useState<number | null>(null)
	const [profileFetched, setProfileFetched] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [errorRaw, setErrorRaw] = useState<SupabaseErrorRaw | null>(null)
	const [hadSupabaseError, setHadSupabaseError] = useState(false)

	const timerRef = useRef<number | null>(null)
	const latestDraftRef = useRef<string>('') // serialized
	const lastSentRef = useRef<string>('') // serialized
	const lastKnownServerProfile = useRef<AthleteProfile | null>(null) // Track server state for merge validation

	const lsKey = useMemo(() => (userId ? `athleteProfileDraft:${userId}` : null), [userId])

	const statusText = useMemo(() => {
		// Only show "Cloud sync unavailable" if env missing OR session missing OR Supabase returned an error
		if (!supabaseEnvConfigured || !userId || hadSupabaseError) return 'Cloud sync unavailable'
		if (status === 'saving') return 'Saving…'
		if (status === 'saved') return 'All changes saved'
		if (status === 'error') return "Couldn't save. Will retry."
		if (status === 'loading') return 'Loading…'
		return ''
	}, [status, userId, hadSupabaseError])

	function extractSupabaseErrorRaw(err: any, context?: { userId?: string; payloadKeys?: string[] }): SupabaseErrorRaw {
		// Capture all raw error fields for debugging
		return {
			status: err?.status,
			code: err?.code,
			message: err?.message || String(err),
			details: err?.details,
			hint: err?.hint,
			timestamp: Date.now(),
			userId: context?.userId,
			payloadKeys: context?.payloadKeys
		}
	}

	function formatSupabaseError(err: any): string {
		// Capture status codes and messages as-is; do not paraphrase
		const status = err?.status
		const code = err?.code
		const message = err?.message || String(err)
		const details = err?.details
		
		// Check for RLS/permission errors
		const isRlsError = code === '42501' || 
			code === 'PGRST301' || 
			(typeof message === 'string' && (
				message.toLowerCase().includes('permission') ||
				message.toLowerCase().includes('rls') ||
				message.toLowerCase().includes('not authorized') ||
				message.toLowerCase().includes('unauthorized')
			))
		
		if (isRlsError) {
			return 'Permission denied (RLS). Please ensure you are logged in.'
		}
		
		const parts = []
		if (typeof status !== 'undefined') parts.push(`status=${status}`)
		if (typeof code !== 'undefined') parts.push(`code=${code}`)
		if (typeof message !== 'undefined') parts.push(`message=${message}`)
		if (typeof details !== 'undefined') parts.push(`details=${details}`)
		return parts.join(' | ')
	}

	const loadFromServer = useCallback(async () => {
		// Get fresh user from Supabase auth
		if (!supabase) {
			setInitialProfile(undefined)
			setStatus('idle')
			setLastSavedAt(null)
			setHadSupabaseError(false)
			return
		}
		
		const requestId = generateRequestId()
		
		setStatus('loading')
		setError(null)
		setErrorRaw(null)
		try {
			// Always get fresh auth user to ensure user_id matches auth.uid()
			const { data: userData, error: authError } = await supabase.auth.getUser()
			if (authError || !userData?.user) {
				setInitialProfile(undefined)
				setStatus('idle')
				setLastSavedAt(null)
				setHadSupabaseError(false)
				return
			}
			
			const freshUserId = userData.user.id
			
			Observability.log({
				feature: 'profile',
				route: 'autosave.load',
				status: 'start',
				requestId,
				userId: freshUserId
			})
			
			let cloudProfile: AthleteProfile | null = null
			let cloudUpdatedAt: number = 0
			
			const { data, error } = await supabase
				.from('athlete_profiles')
				.select('profile, updated_at')
				.eq('user_id', freshUserId)
				.maybeSingle()
			if (error) throw error
			if (data) {
				const profileJson = (data as any)?.profile || {}
				cloudProfile = profileJson as AthleteProfile
				cloudUpdatedAt = (data as any).updated_at ? new Date((data as any).updated_at as string).getTime() : 0
			} else {
				// Ensure row exists for this user (with fresh user_id)
				const up = await supabase
					.from('athlete_profiles')
					.upsert({ user_id: freshUserId, profile: {} }, { onConflict: 'user_id' })
				if ((up as any)?.error) throw (up as any).error
			}
			
			let useProfile = cloudProfile || ({} as AthleteProfile)
			// Compare with localStorage draft if present (use fresh user id for key)
			const freshLsKey = `athleteProfileDraft:${freshUserId}`
			if (freshLsKey) {
				try {
					const raw = localStorage.getItem(freshLsKey)
					if (raw) {
						const parsed = JSON.parse(raw) as { data: AthleteProfile; updatedAt: number; dirty?: boolean }
						if ((parsed?.updatedAt || 0) > (cloudUpdatedAt || 0)) {
							if (window.confirm('We found unsaved changes from your last session. Restore them?')) {
								useProfile = parsed.data
							} else {
								localStorage.removeItem(freshLsKey)
							}
						}
					}
				} catch {}
			}
			const finalProfile = useProfile && Object.keys(useProfile).length ? (useProfile as AthleteProfile) : undefined
			setInitialProfile(finalProfile)
			setLastSavedAt(cloudUpdatedAt || null)
			setProfileFetched(true)
			setStatus('idle')
			latestDraftRef.current = JSON.stringify(useProfile || {})
			lastSentRef.current = JSON.stringify(cloudProfile || {})
			lastKnownServerProfile.current = cloudProfile // Track server state for validation
			
			// Verify rehydration completeness in dev mode
			if (import.meta.env.DEV && finalProfile) {
				const keyCount = countSignificantKeys(finalProfile)
				const criticalFields = {
					hasName: !!finalProfile.name,
					hasSchool: !!finalProfile.school,
					hasSports: !!(finalProfile.sports && finalProfile.sports.length > 0),
					hasLocation: !!finalProfile.location,
					hasSocialHandles: !!(finalProfile.socialHandles && finalProfile.socialHandles.length > 0),
					hasContentStyles: !!(finalProfile.contentStyles && finalProfile.contentStyles.length > 0),
					hasMediaKit: !!finalProfile.mediaKit,
					hasSupportTeam: !!(finalProfile.supportTeam && finalProfile.supportTeam.length > 0),
					hasTrustedCircle: !!(finalProfile.trustedCircle && finalProfile.trustedCircle.length > 0),
					totalKeys: keyCount
				}
				console.log('[Profile Load] Rehydration complete:', criticalFields)
			}
			
			Observability.log({
				feature: 'profile',
				route: 'autosave.load',
				status: 'ok',
				requestId,
				userId: freshUserId
			})
		} catch (err: any) {
			setHadSupabaseError(true)
			const { data: userData } = await supabase.auth.getUser().catch(() => ({ data: null }))
			const rawError = extractSupabaseErrorRaw(err, { userId: userData?.user?.id })
			setErrorRaw(rawError)
			setError(formatSupabaseError(err) || 'Failed to load')
			setStatus('error')
			
			// Log to console in dev mode for immediate visibility
			if (import.meta.env.DEV) {
				console.error('[Profile Load Error]', {
					timestamp: new Date().toISOString(),
					userId: userData?.user?.id,
					error: rawError
				})
			}
			
			Observability.log({
				feature: 'profile',
			route: 'autosave.load',
			status: 'error',
			requestId,
			errorName: (err as any)?.name,
			errorMessage: (err as any)?.message,
			meta: {
				errorCode: (err as any)?.code,
				errorRaw: rawError
			}
			})
		}
	}, [])

	useEffect(() => {
		// Load when user prop changes (indicates auth state change)
		loadFromServer()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [params.user?.id])

	const flushSave = useCallback(async () => {
		if (!supabase) return
		
		const serialized = latestDraftRef.current
		if (serialized === lastSentRef.current) return
		const body = JSON.parse(serialized) as AthleteProfile
		
		// Safety check: Don't save if body is empty or has no meaningful content
		if (!body || Object.keys(body).length === 0) {
			console.warn('[Profile Save] Skipping save - empty profile object')
			return
		}
		
		// GUARD: Detect partial object overwrites
		const currentKeyCount = countSignificantKeys(body)
		const serverProfile = lastKnownServerProfile.current
		const serverKeyCount = serverProfile ? countSignificantKeys(serverProfile) : 0
		
		// If current payload has significantly fewer keys than server, this might be a partial update bug
		const MINIMUM_PROFILE_KEYS = 5 // name, school, sports, etc.
		const SUSPICIOUS_RATIO = 0.5 // Less than 50% of previous keys is suspicious
		
		if (serverKeyCount > 10 && currentKeyCount < MINIMUM_PROFILE_KEYS) {
			const errorMsg = `[Profile Save] BLOCKED: Refusing to overwrite profile with ${serverKeyCount} keys with partial object containing only ${currentKeyCount} keys`
			console.error(errorMsg, {
				currentKeys: Object.keys(body),
				currentKeyCount,
				serverKeyCount,
				currentPreview: {
					name: body?.name,
					school: body?.school,
					sports: body?.sports?.length
				}
			})
			
			Observability.log({
				feature: 'profile',
				route: 'autosave.save.blocked',
				status: 'error',
				errorMessage: errorMsg,
				meta: {
					currentKeyCount,
					serverKeyCount,
					currentKeys: Object.keys(body)
				}
			})
			
			setStatus('error')
			setError('Partial profile detected - save blocked to prevent data loss')
			return
		}
		
		if (serverKeyCount > 10 && currentKeyCount < serverKeyCount * SUSPICIOUS_RATIO) {
			console.warn(`[Profile Save] ⚠️ WARNING: Current profile has ${currentKeyCount} keys, but server has ${serverKeyCount} keys. This may indicate a partial update.`, {
				currentKeys: Object.keys(body),
				lostFields: Object.keys(serverProfile || {}).filter(k => !(k in body))
			})
			
			Observability.log({
				feature: 'profile',
				route: 'autosave.save.warning',
				status: 'warning',
				meta: {
					currentKeyCount,
					serverKeyCount,
					ratio: currentKeyCount / serverKeyCount
				}
			})
		}
		
		const requestId = generateRequestId()
		
		setStatus('saving')
		setError(null)
		setErrorRaw(null)
		setHadSupabaseError(false)
		setLastSaveAttempt(Date.now())
		try {
			// Always get fresh auth user to ensure user_id matches auth.uid()
			const { data: userData, error: authError } = await supabase.auth.getUser()
			if (authError || !userData?.user) {
				setStatus('error')
				setError('Not authenticated')
				return
			}
			
			const freshUserId = userData.user.id
			
			Observability.log({
				feature: 'profile',
				route: 'autosave.save',
				status: 'start',
				requestId,
				userId: freshUserId
			})
			
		// Build payload with explicit user_id (uuid) as required by schema
		const payload = {
			user_id: freshUserId, // uuid type, references auth.users(id)
			profile: body // jsonb type
		}
		
		// Log payload structure in dev mode with DEEP inspection of critical fields
		if (import.meta.env.DEV) {
			const criticalFields = {
				name: body?.name,
				school: body?.school,
				schoolLevel: body?.schoolLevel,
				sports: body?.sports,
				location: body?.location,
				socialHandles: body?.socialHandles,
				social: body?.social,
				contentStyles: body?.contentStyles,
				personality: body?.personality,
				values: body?.values,
				professionalism: body?.professionalism,
				timePerWeekHours: body?.timePerWeekHours,
				supportTeam: body?.supportTeam ? `[${body.supportTeam.length} contacts]` : undefined,
				trustedCircle: body?.trustedCircle ? `[${body.trustedCircle.length} contacts]` : undefined,
				academicProfile: body?.academicProfile,
				availability: body?.availability ? `[${body.availability.length} windows]` : undefined,
				performanceStory: body?.performanceStory,
				trainingLog: body?.trainingLog ? `[${body.trainingLog.entries?.length || 0} entries]` : undefined,
				monetizationInterests: body?.monetizationInterests,
				mediaKit: body?.mediaKit ? {
					heroImages: body.mediaKit.heroImages?.length || 0,
					logos: body.mediaKit.logos?.length || 0,
					brandColors: body.mediaKit.brandColors?.length || 0,
					samplePosts: body.mediaKit.samplePosts?.length || 0,
					externalDeckUrl: body.mediaKit.externalDeckUrl ? 'set' : undefined
				} : undefined,
				physicalAttributes: body?.physicalAttributes,
				sportMetrics: body?.sportMetrics ? `[${body.sportMetrics.length} metrics]` : undefined,
				gameFilm: body?.gameFilm ? `[${body.gameFilm.length} films]` : undefined,
				nil: body?.nil
			}
			
			console.log('[Profile Save] Payload Details:', {
				user_id: freshUserId,
				profile_keys: Object.keys(body || {}),
				profile_size: JSON.stringify(body).length,
				critical_fields: criticalFields
			})
			
			// Store in window for debug panel access
			;(window as any).__lastProfileSavePayload = {
				timestamp: Date.now(),
				keys: Object.keys(body || {}),
				criticalFields,
				fullSize: JSON.stringify(body).length
			}
			
			// Validate critical fields are present (dev warning)
			const missingCritical = []
			if (!body?.name) missingCritical.push('name')
			if (!body?.school) missingCritical.push('school')
			if (!body?.sports || body.sports.length === 0) missingCritical.push('sports')
			
			if (missingCritical.length > 0) {
				console.warn('[Profile Save] ⚠️ Missing critical fields:', missingCritical)
				console.warn('[Profile Save] Full payload keys:', Object.keys(body || {}))
			}
		}
			
			// Upsert with explicit conflict target (user_id is primary key)
			const { error: upsertError } = await supabase
				.from('athlete_profiles')
				.upsert(payload, { onConflict: 'user_id' })
			
			if (upsertError) {
				// Extract payload keys for debugging (avoid logging full profile data)
				const payloadKeys = body ? Object.keys(body) : []
				throw { ...upsertError, _payloadKeys: payloadKeys, _userId: freshUserId }
			}
			
			// Immediately verify the row was saved by re-selecting it
			const { data: verifyData, error: verifyError } = await supabase
				.from('athlete_profiles')
				.select('user_id, updated_at')
				.eq('user_id', freshUserId)
				.maybeSingle()
			
			if (verifyError) {
				// Log verification failure but don't fail the save
				// (save may have succeeded even if verify fails due to RLS SELECT policy)
			Observability.log({
				feature: 'profile',
				route: 'autosave.save.verify',
				status: 'error',
				requestId,
				userId: freshUserId,
				errorMessage: verifyError.message,
				meta: {
					errorCode: verifyError.code
				}
			})
				console.warn('[Profile Save] Upsert succeeded but verify failed:', verifyError)
			} else if (!verifyData) {
				// Row not found after upsert - this is a problem
				Observability.log({
					feature: 'profile',
					route: 'autosave.save.verify',
					status: 'error',
					requestId,
					userId: freshUserId,
					errorMessage: 'Row not found after upsert'
				})
				console.error('[Profile Save] Row not found after upsert')
				throw new Error('Profile upsert succeeded but row not found on verify')
			} else {
				// Verification passed - row exists
			Observability.log({
				feature: 'profile',
				route: 'autosave.save.verify',
				status: 'ok',
				requestId,
				userId: freshUserId,
				meta: {
					rowUpdatedAt: verifyData.updated_at
				}
			})
				if (import.meta.env.DEV) {
					console.log('[Profile Save] Verified:', {
						user_id: verifyData.user_id,
						updated_at: verifyData.updated_at
					})
				}
			}
			
			setLastSavedAt(Date.now())
			setStatus('saved')
			lastSentRef.current = serialized
			lastKnownServerProfile.current = body // Update server state tracking after successful save
			
			// mark localStorage as synced (use fresh user id for key)
			const freshLsKey = `athleteProfileDraft:${freshUserId}`
			if (freshLsKey) {
				try {
					localStorage.setItem(freshLsKey, JSON.stringify({ data: body, updatedAt: Date.now(), dirty: false }))
				} catch {}
			}
			
			Observability.log({
				feature: 'profile',
				route: 'autosave.save',
				status: 'ok',
				requestId,
				userId: freshUserId
			})
		} catch (err: any) {
			setStatus('error')
			setHadSupabaseError(true)
			
			// Extract context from error
			const userId = err?._userId || params.user?.id
			const payloadKeys = err?._payloadKeys || []
			
			const rawError = extractSupabaseErrorRaw(err, { userId, payloadKeys })
			setErrorRaw(rawError)
			setError(formatSupabaseError(err) || 'Save error')
			
			// Log to console in dev mode for immediate visibility
			if (import.meta.env.DEV) {
				console.error('[Profile Save Error]', {
					timestamp: new Date().toISOString(),
					userId,
					payloadKeys,
					error: rawError
				})
			}
			
			Observability.log({
				feature: 'profile',
			route: 'autosave.save',
			status: 'error',
			requestId,
			errorName: (err as any)?.name,
			errorMessage: (err as any)?.message,
			userId,
			meta: {
				errorCode: (err as any)?.code,
				errorRaw: rawError,
				payloadKeys
			}
			})
		}
	}, [])

	const onDraftChange = useCallback(async (draft: AthleteProfile) => {
		// Deep merge incoming draft with last known state to handle partial updates
		let mergedDraft = draft
		
		// If we have a previous draft and the incoming draft looks partial, merge it
		const previousDraft = latestDraftRef.current ? (JSON.parse(latestDraftRef.current) as AthleteProfile) : null
		if (previousDraft && Object.keys(previousDraft).length > 0) {
			const incomingKeyCount = countSignificantKeys(draft)
			const previousKeyCount = countSignificantKeys(previousDraft)
			
			// If incoming has significantly fewer keys, treat as partial update
			if (previousKeyCount > 10 && incomingKeyCount < previousKeyCount * 0.7) {
				console.log('[Profile Save] Detected partial update, performing deep merge', {
					incomingKeys: incomingKeyCount,
					previousKeys: previousKeyCount
				})
				mergedDraft = deepMerge(previousDraft, draft)
			}
		}
		
		// Update the latest draft snapshot
		const serialized = JSON.stringify(mergedDraft || {})
		latestDraftRef.current = serialized
		
		// Mirror to localStorage immediately with dirty flag (use fresh user id)
		if (supabase && params.user?.id) {
			const freshLsKey = `athleteProfileDraft:${params.user.id}`
			try {
				localStorage.setItem(freshLsKey, JSON.stringify({ data: mergedDraft, updatedAt: Date.now(), dirty: true }))
			} catch {}
		}
		
		// Debounce save
		if (timerRef.current) {
			window.clearTimeout(timerRef.current)
		}
		timerRef.current = window.setTimeout(() => {
			flushSave()
		}, debounceMs) as unknown as number
	}, [debounceMs, flushSave, params.user?.id])

	useEffect(() => {
		return () => {
			if (timerRef.current) {
				window.clearTimeout(timerRef.current)
			}
		}
	}, [])

	const refresh = useCallback(() => {
		loadFromServer()
	}, [loadFromServer])

	const saveNow = useCallback(async () => {
		// Cancel any pending debounce, then flush immediately
		if (timerRef.current) {
			window.clearTimeout(timerRef.current)
			timerRef.current = null
		}
		await flushSave()
	}, [flushSave])

	return {
		initialProfile,
		status,
		statusText,
		lastSavedAt,
		lastSaveAttempt,
		profileFetched,
		error,
		errorRaw,
		onDraftChange,
		saveNow,
		refresh
	}
}


