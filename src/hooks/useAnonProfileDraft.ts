/**
 * Hook for saving profile drafts for anonymous users
 * Saves to user_data table (INSERT only, RLS blocks SELECT) and localStorage as fallback
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AthleteProfile } from '../types'
import { saveUserData } from '../lib/userData'
import { getAnonId } from '../lib/anonIdentity'
import { supabase, supabaseEnvConfigured } from '../lib/supabaseClient'

const LS_KEY_PROFILE_DRAFT = 'anon_profile_draft'

type Status = 'idle' | 'saving' | 'saved' | 'error'

export function useAnonProfileDraft(params?: {
	debounceMs?: number
}): {
	initialProfile: AthleteProfile | undefined
	status: Status
	statusText: string
	lastSavedAt: number | null
	onDraftChange: (draft: AthleteProfile) => void
	saveNow: () => Promise<void>
} {
	const debounceMs = params?.debounceMs ?? 800

	const [initialProfile, setInitialProfile] = useState<AthleteProfile | undefined>(undefined)
	const [status, setStatus] = useState<Status>('idle')
	const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)

	const timerRef = useRef<number | null>(null)
	const latestDraftRef = useRef<string>('') // serialized
	const lastSentRef = useRef<string>('') // serialized

	// Load from localStorage on mount (RLS blocks SELECT from user_data)
	const loadFromLocalStorage = useCallback(() => {
		try {
			const raw = localStorage.getItem(LS_KEY_PROFILE_DRAFT)
			if (raw) {
				const parsed = JSON.parse(raw) as { data: AthleteProfile; updatedAt: number }
				if (parsed?.data && Object.keys(parsed.data).length > 0) {
					setInitialProfile(parsed.data)
					setLastSavedAt(parsed.updatedAt || null)
					const serialized = JSON.stringify(parsed.data)
					latestDraftRef.current = serialized
					lastSentRef.current = serialized
				}
			}
		} catch (err) {
			// Silently handle localStorage parse errors
			// eslint-disable-next-line no-console
			console.warn('[useAnonProfileDraft] Failed to load from localStorage:', err)
		}
	}, [])

	// Try to fetch from DB (will likely fail due to RLS, but try anyway)
	const tryLoadFromDB = useCallback(async () => {
		if (!supabaseEnvConfigured || !supabase) {
			loadFromLocalStorage()
			return
		}

		const anonId = getAnonId()
		if (anonId === 'ssr-temp-id' || anonId === 'localStorage-unavailable') {
			loadFromLocalStorage()
			return
		}

		try {
			// Try to fetch latest profile_draft - will likely fail due to RLS
			const { data, error } = await supabase
				.from('user_data')
				.select('payload, created_at')
				.eq('anon_id', anonId)
				.eq('data_type', 'profile_draft')
				.order('created_at', { ascending: false })
				.limit(1)
				.maybeSingle()

			if (!error && data) {
				// Successfully loaded from DB
				const profile = data.payload as AthleteProfile
				if (profile && Object.keys(profile).length > 0) {
					const updatedAt = data.created_at ? new Date(data.created_at).getTime() : Date.now()
					setInitialProfile(profile)
					setLastSavedAt(updatedAt)
					const serialized = JSON.stringify(profile)
					latestDraftRef.current = serialized
					lastSentRef.current = serialized
					// Also update localStorage
					try {
						localStorage.setItem(LS_KEY_PROFILE_DRAFT, JSON.stringify({ data: profile, updatedAt }))
					} catch {}
					return
				}
			}

			// If DB fetch failed (RLS) or no data, fall back to localStorage
			loadFromLocalStorage()
		} catch (err) {
			// DB fetch failed (likely RLS), fall back to localStorage
			loadFromLocalStorage()
		}
	}, [loadFromLocalStorage])

	useEffect(() => {
		// Try DB first, fall back to localStorage
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		tryLoadFromDB()
	}, [tryLoadFromDB])

	const flushSave = useCallback(async () => {
		const serialized = latestDraftRef.current
		if (!serialized || serialized === lastSentRef.current) return

		const draft = JSON.parse(serialized) as AthleteProfile
		setStatus('saving')

		// Always save to localStorage first (immediate)
		try {
			localStorage.setItem(LS_KEY_PROFILE_DRAFT, JSON.stringify({ data: draft, updatedAt: Date.now() }))
		} catch (err) {
			// eslint-disable-next-line no-console
			console.warn('[useAnonProfileDraft] Failed to save to localStorage:', err)
		}

		// Try to INSERT to DB (non-blocking)
		// This will work even if SELECT is blocked by RLS
		try {
			await saveUserData('profile_draft', draft)
			setLastSavedAt(Date.now())
			setStatus('saved')
			lastSentRef.current = serialized
		} catch (err) {
			// DB insert failed, but localStorage save succeeded
			// Still mark as saved since localStorage is the fallback
			setLastSavedAt(Date.now())
			setStatus('saved')
			lastSentRef.current = serialized
		}
	}, [])

	const onDraftChange = useCallback((draft: AthleteProfile) => {
		// Update the latest draft snapshot
		const serialized = JSON.stringify(draft || {})
		latestDraftRef.current = serialized

		// Save to localStorage immediately (no debounce for localStorage)
		try {
			localStorage.setItem(LS_KEY_PROFILE_DRAFT, JSON.stringify({ data: draft, updatedAt: Date.now() }))
		} catch (err) {
			// Silently handle localStorage errors
		}

		// Debounce DB save
		if (timerRef.current) {
			window.clearTimeout(timerRef.current)
		}
		timerRef.current = window.setTimeout(() => {
			flushSave()
		}, debounceMs) as unknown as number
	}, [debounceMs, flushSave])

	useEffect(() => {
		return () => {
			if (timerRef.current) {
				window.clearTimeout(timerRef.current)
			}
		}
	}, [])

	const saveNow = useCallback(async () => {
		// Cancel any pending debounce, then flush immediately
		if (timerRef.current) {
			window.clearTimeout(timerRef.current)
			timerRef.current = null
		}
		await flushSave()
	}, [flushSave])

	const statusText = useMemo(() => {
		if (status === 'saving') return 'Saving draft…'
		if (status === 'saved') return 'Draft saved'
		if (status === 'error') return 'Save failed'
		return ''
	}, [status])

	return {
		initialProfile,
		status,
		statusText,
		lastSavedAt,
		onDraftChange,
		saveNow
	}
}
