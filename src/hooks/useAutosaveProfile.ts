import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AthleteProfile } from '../types'

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

	const timerRef = useRef<number | null>(null)
	const latestDraftRef = useRef<string>('') // serialized
	const lastSentRef = useRef<string>('') // serialized

	const lsKey = useMemo(() => (userId ? `athleteProfileDraft:${userId}` : null), [userId])

	const statusText = useMemo(() => {
		if (status === 'saving') return 'Saving…'
		if (status === 'saved') return 'All changes saved'
		if (status === 'error') return "Couldn't save. Will retry."
		if (status === 'loading') return 'Loading…'
		return ''
	}, [status])

	const loadFromServer = useCallback(async () => {
		if (!userId) {
			setInitialProfile(undefined)
			setStatus('idle')
			setLastSavedAt(null)
			return
		}
		setStatus('loading')
		setError(null)
		try {
			const res = await fetch('/api/athlete/profile', { method: 'GET' })
			if (!res.ok) throw new Error(`Load failed: ${res.status}`)
			const data = await res.json()
			const serverProfile = (data?.profile || {}) as AthleteProfile
			const serverUpdatedAt: number = data?.updatedAt || 0
			let useProfile = serverProfile
			// Compare with localStorage draft if present
			if (lsKey) {
				try {
					const raw = localStorage.getItem(lsKey)
					if (raw) {
						const parsed = JSON.parse(raw) as { data: AthleteProfile; updatedAt: number; dirty?: boolean }
						if ((parsed?.updatedAt || 0) > (serverUpdatedAt || 0)) {
							// simple prompt to restore
							if (window.confirm('We found unsaved changes from your last session. Restore them?')) {
								useProfile = parsed.data
							} else {
								// discard local
								localStorage.removeItem(lsKey)
							}
						}
					}
				} catch {}
			}
			setInitialProfile(useProfile && Object.keys(useProfile).length ? (useProfile as AthleteProfile) : undefined)
			setLastSavedAt(serverUpdatedAt || null)
			setStatus('idle')
			latestDraftRef.current = JSON.stringify(useProfile || {})
			lastSentRef.current = JSON.stringify(serverProfile || {})
		} catch (err: any) {
			setError(err?.message || 'Failed to load')
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
		try {
			const res = await fetch('/api/athlete/profile', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			})
			if (!res.ok) throw new Error(`Save failed: ${res.status}`)
			const data = await res.json()
			setLastSavedAt(data?.updatedAt || Date.now())
			setStatus('saved')
			lastSentRef.current = JSON.stringify(data?.profile || body)
			// mark localStorage as synced
			if (lsKey) {
				try {
					localStorage.setItem(lsKey, JSON.stringify({ data: body, updatedAt: Date.now(), dirty: false }))
				} catch {}
			}
		} catch (err: any) {
			setStatus('error')
			setError(err?.message || 'Save error')
			// Leave lastSentRef unchanged so next debounce will retry
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


