import { useEffect, useRef, useState } from 'react'
import { useSupabaseSession } from '../context/SupabaseSessionContext'
import { checkCanonicalBusinessTables } from '../services/userBusinesses'

export type UseCanonicalBusinessPreflightResult = {
	tablesOk: boolean
	loading: boolean
}

/**
 * Runs a lightweight preflight check for canonical business tables (businesses, user_businesses)
 * once when the user is authenticated. Used to gate Save/Update and show admin banner when missing.
 */
export function useCanonicalBusinessPreflight(): UseCanonicalBusinessPreflightResult {
	const { user, loading: sessionLoading } = useSupabaseSession()
	const [tablesOk, setTablesOk] = useState(true)
	const [loading, setLoading] = useState(true)
	const didRunRef = useRef(false)

	useEffect(() => {
		if (sessionLoading) {
			setLoading(true)
			return
		}
		if (!user) {
			setTablesOk(true)
			setLoading(false)
			didRunRef.current = false
			return
		}
		if (didRunRef.current) return
		didRunRef.current = true
		setLoading(true)
		checkCanonicalBusinessTables()
			.then((res) => {
				setTablesOk(res.ok)
			})
			.catch(() => {
				setTablesOk(false)
			})
			.finally(() => {
				setLoading(false)
			})
	}, [sessionLoading, user?.id])

	return { tablesOk, loading }
}
