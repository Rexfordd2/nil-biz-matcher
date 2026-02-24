import { useMemo, useState } from 'react'
import type { Business } from '../types'
import { filterBusinesses } from '../utils/filterBusinesses'

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

function toFilterOpts(filters: BusinessFilters): Parameters<typeof filterBusinesses>[1] {
	return {
		...(filters.status && { status: filters.status }),
		...(filters.tags.length > 0 && { tags: filters.tags }),
		...(filters.location.trim() && { text: filters.location.trim() }),
	}
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
		() => filterBusinesses(businesses, toFilterOpts(filters)),
		[businesses, filters]
	)

	return { filters, setFilters, filteredList, allTags: useMemo(() => getAllTags(businesses), [businesses]) }
}
