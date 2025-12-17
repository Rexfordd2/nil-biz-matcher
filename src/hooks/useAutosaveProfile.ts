import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AthleteProfile } from '../types'
import { supabase, supabaseEnvConfigured } from '../lib/supabaseClient'

type Status = 'idle' | 'saving' | 'saved' | 'error' | 'loading'

export function useAutosaveProfile(params: {
	userId?: string | null
	debounceMs?: number
}): {
	initialProfile: AthleteProfile | undefined
	status: Status
	statusText: string
	lastSavedAt: number | null
	error: string | null
	onDraftChange: (draft: AthleteProfile) => void
	refresh: () => void
} {
	const userId = params.userId || null
	const debounceMs = params.debounceMs ?? 800

	const [initialProfile, setInitialProfile] = useState<AthleteProfile | undefined>(undefined)
	const [status, setStatus] = useState<Status>('loading')
	const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [hadSupabaseError, setHadSupabaseError] = useState(false)

	const timerRef = useRef<number | null>(null)
	const latestDraftRef = useRef<string>('') // serialized
	const lastSentRef = useRef<string>('') // serialized

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

	function formatSupabaseError(err: any): string {
		// Capture status codes and messages as-is; do not paraphrase
		const status = err?.status
		const code = err?.code
		const message = err?.message || String(err)
		const details = err?.details
		const parts = []
		if (typeof status !== 'undefined') parts.push(`status=${status}`)
		if (typeof code !== 'undefined') parts.push(`code=${code}`)
		if (typeof message !== 'undefined') parts.push(`message=${message}`)
		if (typeof details !== 'undefined') parts.push(`details=${details}`)
		return parts.join(' | ')
	}

	const loadFromServer = useCallback(async () => {
		if (!userId) {
			setInitialProfile(undefined)
			setStatus('idle')
			setLastSavedAt(null)
			setHadSupabaseError(false)
			return
		}
		setStatus('loading')
		setError(null)
		try {
			let cloudProfile: AthleteProfile | null = null
			let cloudUpdatedAt: number = 0
			if (supabase) {
				const { data, error } = await supabase
					.from('athlete_profiles')
					.select('profile, updated_at')
					.eq('user_id', userId)
					.maybeSingle()
				if (error) throw error
				if (data) {
					const profileJson = (data as any)?.profile || {}
					cloudProfile = profileJson as AthleteProfile
					cloudUpdatedAt = (data as any).updated_at ? new Date((data as any).updated_at as string).getTime() : 0
				} else {
					// Ensure row exists for this user
					const up = await supabase
						.from('athlete_profiles')
						.upsert({ user_id: userId, profile: {} }, { onConflict: 'user_id' })
					if ((up as any)?.error) throw (up as any).error
				}
			}
			let useProfile = cloudProfile || ({} as AthleteProfile)
			// Compare with localStorage draft if present
			if (lsKey) {
				try {
					const raw = localStorage.getItem(lsKey)
					if (raw) {
						const parsed = JSON.parse(raw) as { data: AthleteProfile; updatedAt: number; dirty?: boolean }
						if ((parsed?.updatedAt || 0) > (cloudUpdatedAt || 0)) {
							if (window.confirm('We found unsaved changes from your last session. Restore them?')) {
								useProfile = parsed.data
							} else {
								localStorage.removeItem(lsKey)
							}
						}
					}
				} catch {}
			}
			setInitialProfile(useProfile && Object.keys(useProfile).length ? (useProfile as AthleteProfile) : undefined)
			setLastSavedAt(cloudUpdatedAt || null)
			setStatus('idle')
			latestDraftRef.current = JSON.stringify(useProfile || {})
			lastSentRef.current = JSON.stringify(cloudProfile || {})
		} catch (err: any) {
			setHadSupabaseError(true)
			setError(formatSupabaseError(err) || 'Failed to load')
			setStatus('error')
		}
	}, [userId, lsKey])

	useEffect(() => {
		loadFromServer()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [userId])

	const flushSave = useCallback(async () => {
		if (!userId) return
		const serialized = latestDraftRef.current
		if (serialized === lastSentRef.current) return
		const body = JSON.parse(serialized) as AthleteProfile
		setStatus('saving')
		setError(null)
		setHadSupabaseError(false)
		try {
			if (supabase) {
				const { error } = await supabase
					.from('athlete_profiles')
					.upsert(
						{
							user_id: userId,
							profile: body
						},
						{ onConflict: 'user_id' }
					)
				if (error) throw error
				setLastSavedAt(Date.now())
				setStatus('saved')
				lastSentRef.current = serialized
			} else {
				// No cloud; treat local mirror as saved
				setLastSavedAt(Date.now())
				setStatus('saved')
				lastSentRef.current = serialized
			}
			// mark localStorage as synced
			if (lsKey) {
				try {
					localStorage.setItem(lsKey, JSON.stringify({ data: body, updatedAt: Date.now(), dirty: false }))
				} catch {}
			}
		} catch (err: any) {
			setStatus('error')
			setHadSupabaseError(true)
			setError(formatSupabaseError(err) || 'Save error')
		}
	}, [userId, lsKey])

	const onDraftChange = useCallback((draft: AthleteProfile) => {
		// Update the latest draft snapshot
		const serialized = JSON.stringify(draft || {})
		latestDraftRef.current = serialized
		// Mirror to localStorage immediately with dirty flag
		if (lsKey) {
			try {
				localStorage.setItem(lsKey, JSON.stringify({ data: draft, updatedAt: Date.now(), dirty: true }))
			} catch {}
		}
		// Debounce save
		if (timerRef.current) {
			window.clearTimeout(timerRef.current)
		}
		timerRef.current = window.setTimeout(() => {
			flushSave()
		}, debounceMs) as unknown as number
	}, [debounceMs, flushSave, lsKey])

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

	return {
		initialProfile,
		status,
		statusText,
		lastSavedAt,
		error,
		onDraftChange,
		refresh
	}
}


