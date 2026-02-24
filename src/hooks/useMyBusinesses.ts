import { useCallback, useEffect, useRef, useState } from 'react'
import { useSupabaseSession } from '../context/SupabaseSessionContext'
import { listUserBusinesses } from '../services/userBusinesses'
import { migrateSavedBusinesses } from '../utils/migrateSavedBusinesses'
import type { BusinessProfile } from '../types'

export type UseMyBusinessesResult = {
	businesses: BusinessProfile[]
	loading: boolean
	error: string | null
	refetch: () => Promise<void>
}

export function useMyBusinesses(): UseMyBusinessesResult {
	const { user, loading: sessionLoading } = useSupabaseSession()
	const [businesses, setBusinesses] = useState<BusinessProfile[]>([])
	const [fetchLoading, setFetchLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const cancelledRef = useRef(false)
	const migrationDoneRef = useRef(false)

	const load = useCallback(async (userId: string, runMigration: boolean) => {
		cancelledRef.current = false
		setFetchLoading(true)
		setError(null)
		try {
			if (runMigration) {
				await migrateSavedBusinesses(userId)
				if (cancelledRef.current) return
			}
			const res = await listUserBusinesses(userId)
			if (cancelledRef.current) return
			if (res.error) {
				setError(res.error)
				setBusinesses([])
			} else {
				setBusinesses(res.rows)
			}
		} finally {
			if (!cancelledRef.current) setFetchLoading(false)
		}
	}, [])

	useEffect(() => {
		if (sessionLoading || !user) {
			setBusinesses([])
			setError(null)
			if (!user && !sessionLoading) {
				migrationDoneRef.current = false
			}
			return
		}
		const runMigration = !migrationDoneRef.current
		if (runMigration) migrationDoneRef.current = true
		load(user.id, runMigration)
		return () => {
			cancelledRef.current = true
		}
	}, [sessionLoading, user?.id, load])

	const refetch = useCallback(async () => {
		if (!user) return
		setFetchLoading(true)
		setError(null)
		cancelledRef.current = false
		try {
			const res = await listUserBusinesses(user.id)
			if (cancelledRef.current) return
			if (res.error) {
				setError(res.error)
			} else {
				setBusinesses(res.rows)
			}
		} finally {
			if (!cancelledRef.current) setFetchLoading(false)
		}
	}, [user?.id])

	const loading = sessionLoading || fetchLoading

	if (!user && !sessionLoading) {
		return { businesses: [], loading: false, error: null, refetch: async () => {} }
	}

	return { businesses, loading, error, refetch }
}
