import { useEffect, useRef } from 'react'

export function useDebouncedCallback<T extends (...args: any[]) => void>(fn: T, delayMs: number) {
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const fnRef = useRef(fn)

	// Always call the latest function passed in
	useEffect(() => {
		fnRef.current = fn
	}, [fn])

	// Clear any pending timeout on unmount
	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current)
		}
	}, [])

	return (...args: Parameters<T>) => {
		if (timerRef.current) clearTimeout(timerRef.current)
		timerRef.current = setTimeout(() => fnRef.current(...args), delayMs)
	}
}


