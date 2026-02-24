import { useMemo, useState } from 'react'
import type { Business } from '../types'

export type BusinessFilters = {
	status: Business['status'] | ''
	/** Selected tag values: show businesses that have at least one of these. */
	tags: string[]
	/** Substring search on location and name (case-insensitive). */
	location: string
}

const defaultFilters: BusinessFilters = {
	status: '',
	tags: [],
	location: '',
}

function applyFilters(list: Business[], filters: BusinessFilters): Business[] {
	return list.filter(b => {
		if (filters.status && (b.status || 'Not Contacted') !== filters.status) return false
		if (filters.tags.length > 0) {
			const bizTags = b.tags ?? []
			const hasMatch = filters.tags.some(t => bizTags.includes(t))
			if (!hasMatch) return false
		}
		if (filters.location.trim()) {
			const q = filters.location.trim().toLowerCase()
			const match = (b.location?.toLowerCase().includes(q)) || (b.name?.toLowerCase().includes(q))
			if (!match) return false
		}
		return true
	})
}

/** Collect all unique tag values from the list (for filter dropdown/chips). */
export function getAllTags(businesses: Business[]): string[] {
	const set = new Set<string>()
	for (const b of businesses) {
		for (const t of b.tags ?? []) {
			if (typeof t === 'string' && t.trim()) set.add(t.trim())
		}
	}
	return Array.from(set).sort()
}

export function useBusinessFilters(
	businesses: Business[],
	initialFilters: Partial<BusinessFilters> = {}
) {
	const [filters, setFilters] = useState<BusinessFilters>({ ...defaultFilters, ...initialFilters })

	const filteredList = useMemo(
		() => applyFilters(businesses, filters),
		[businesses, filters]
	)

	return { filters, setFilters, filteredList, allTags: useMemo(() => getAllTags(businesses), [businesses]) }
}
