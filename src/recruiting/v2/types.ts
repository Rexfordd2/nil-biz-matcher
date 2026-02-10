/**
 * RecruitingV2 types - localStorage-first contact tracking
 */

import type { NormalizedPlace } from '../../hooks/usePlacesSearch'

export type RecruitingV2Status = 'New' | 'Shortlisted' | 'Contacted' | 'FollowUp' | 'Responded' | 'Closed'

export type RecruitingV2Contact = {
  placeId: string
  starred: boolean
  status: RecruitingV2Status
  notes: string
  lastContactedAt: string | null // ISO string
  createdAt: string // ISO string
  updatedAt: string // ISO string
  place: {
    name: string
    formattedAddress?: string
    location?: { lat: number; lng: number }
  }
}

export type RecruitingV2Store = {
  version: 1
  contactsByPlaceId: Record<string, RecruitingV2Contact>
}

export type SearchFilters = {
  sport: string
  sportOther: string
  level: string
  orgType: string
  locationText: string
  radiusMiles: number
}
