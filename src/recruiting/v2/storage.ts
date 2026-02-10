/**
 * RecruitingV2 localStorage persistence helpers
 * Local-first with optional Supabase sync
 */

import { load, save } from '../../utils/storage'
import type { NormalizedPlace } from '../../hooks/usePlacesSearch'
import type { RecruitingV2Contact, RecruitingV2Status, RecruitingV2Store } from './types'
import Papa from 'papaparse'

const STORAGE_KEY = 'recruiting_v2.store.v1'
const LAST_SEARCH_KEY = 'recruiting_v2.last_search'

export type LastSearchParams = {
  q: string
  locationText: string
  radiusMiles: number
  sport: string
  sportOther: string
  level: string
  orgType: string
  timestamp: string
  successful: boolean
}

function getEmptyStore(): RecruitingV2Store {
  return {
    version: 1,
    contactsByPlaceId: {}
  }
}

export function loadRecruitingV2Store(): RecruitingV2Store {
  return load<RecruitingV2Store>(STORAGE_KEY, getEmptyStore())
}

export function saveRecruitingV2Store(store: RecruitingV2Store): void {
  save(STORAGE_KEY, store)
}

export function upsertContactFromPlace(place: NormalizedPlace): RecruitingV2Contact {
  const store = loadRecruitingV2Store()
  const now = new Date().toISOString()
  
  const existing = store.contactsByPlaceId[place.placeId]
  
  const contact: RecruitingV2Contact = existing
    ? { ...existing, updatedAt: now }
    : {
        placeId: place.placeId,
        starred: true,
        status: 'Shortlisted',
        notes: '',
        lastContactedAt: null,
        createdAt: now,
        updatedAt: now,
        place: {
          name: place.name,
          formattedAddress: place.formattedAddress,
          location: place.location
        }
      }
  
  store.contactsByPlaceId[place.placeId] = contact
  saveRecruitingV2Store(store)
  
  return contact
}

export function toggleStar(placeId: string): boolean {
  const store = loadRecruitingV2Store()
  const contact = store.contactsByPlaceId[placeId]
  
  if (!contact) return false
  
  contact.starred = !contact.starred
  contact.updatedAt = new Date().toISOString()
  
  saveRecruitingV2Store(store)
  
  return contact.starred
}

export function setStatus(placeId: string, status: RecruitingV2Status): void {
  const store = loadRecruitingV2Store()
  const contact = store.contactsByPlaceId[placeId]
  
  if (!contact) return
  
  contact.status = status
  contact.updatedAt = new Date().toISOString()
  
  saveRecruitingV2Store(store)
}

export function setNotes(placeId: string, notes: string): void {
  const store = loadRecruitingV2Store()
  const contact = store.contactsByPlaceId[placeId]
  
  if (!contact) return
  
  contact.notes = notes
  contact.updatedAt = new Date().toISOString()
  
  saveRecruitingV2Store(store)
}

export function setLastContacted(placeId: string, isoStringOrNull: string | null): void {
  const store = loadRecruitingV2Store()
  const contact = store.contactsByPlaceId[placeId]
  
  if (!contact) return
  
  contact.lastContactedAt = isoStringOrNull
  contact.updatedAt = new Date().toISOString()
  
  saveRecruitingV2Store(store)
}

export function deleteContact(placeId: string): void {
  const store = loadRecruitingV2Store()
  delete store.contactsByPlaceId[placeId]
  saveRecruitingV2Store(store)
}

export function getAllContacts(): RecruitingV2Contact[] {
  const store = loadRecruitingV2Store()
  return Object.values(store.contactsByPlaceId).sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

export function getStarredContacts(): RecruitingV2Contact[] {
  return getAllContacts().filter(c => c.starred)
}

export function exportShortlistCsv(contacts: RecruitingV2Contact[]): void {
  const rows = contacts.map(c => ({
    name: c.place.name,
    address: c.place.formattedAddress || '',
    status: c.status,
    notes: c.notes,
    last_contacted: c.lastContactedAt ? new Date(c.lastContactedAt).toLocaleDateString() : '',
    created_at: new Date(c.createdAt).toLocaleDateString(),
    location: c.place.location ? `${c.place.location.lat},${c.place.location.lng}` : ''
  }))
  
  let csv = ''
  try {
    csv = Papa.unparse(rows, { header: true })
  } catch {
    // Fallback manual CSV
    if (rows.length > 0) {
      const headers = Object.keys(rows[0])
      const escape = (v: unknown) => String(v ?? '').replace(/"/g, '""')
      const lines = [
        headers.join(','),
        ...rows.map(r => headers.map(h => `"${escape((r as any)[h])}"`).join(','))
      ]
      csv = lines.join('\r\n')
    }
  }
  
  if (!csv) return
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `recruiting-shortlist-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function saveLastSearchParams(params: Omit<LastSearchParams, 'timestamp' | 'successful'>, successful: boolean): void {
  const lastSearch: LastSearchParams = {
    ...params,
    timestamp: new Date().toISOString(),
    successful
  }
  save(LAST_SEARCH_KEY, lastSearch)
}

export function loadLastSearchParams(): LastSearchParams | null {
  return load<LastSearchParams | null>(LAST_SEARCH_KEY, null)
}

export function clearLastSearchParams(): void {
  try {
    localStorage.removeItem(LAST_SEARCH_KEY)
  } catch {
    // ignore
  }
}
