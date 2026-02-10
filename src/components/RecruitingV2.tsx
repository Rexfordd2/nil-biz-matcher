/**
 * RecruitingV2 - Streamlined recruiting workflow
 * Search → Results → Shortlist → Contact/Track
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { NormalizedPlace } from '../hooks/usePlacesSearch'
import type { SearchFilters, RecruitingV2Contact, RecruitingV2Status } from '../recruiting/v2/types'
import { 
  loadRecruitingV2Store, 
  upsertContactFromPlace, 
  toggleStar as toggleStarInStore,
  setStatus as setStatusInStore,
  setNotes as setNotesInStore,
  setLastContacted as setLastContactedInStore
} from '../recruiting/v2/storage'
import { placesProxySearch } from '../lib/google/placesProxy'
import { normalizeGoogleProxyError, isRetryable as isRetryableError } from '../lib/google/errors'
import { generateRequestId } from '../lib/obs'
import { navigate } from '../routes/RootRouter'
import RecruitingFilters from './RecruitingFilters'
import RecruitingResults from './RecruitingResults'
import RecruitingContactPanel from './RecruitingContactPanel'
import Button from './ui/Button'
import { hasGoogleMapsKey } from '../lib/google/maps'
import GoogleMapsDisabledNotice from './GoogleMapsDisabledNotice'

export default function RecruitingV2() {
  // Search filters
  const [filters, setFilters] = useState<SearchFilters>({
    sport: '',
    sportOther: '',
    level: '',
    orgType: '',
    locationText: '',
    radiusMiles: 25
  })

  // Search state
  const [results, setResults] = useState<NormalizedPlace[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isStale, setIsStale] = useState(false)
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)

  // Contact tracking state
  const [contacts, setContacts] = useState<Record<string, RecruitingV2Contact>>({})

  // Search management refs
  const searchTokenRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const lastGoodPlacesRef = useRef<NormalizedPlace[]>([])
  const lastSearchParamsRef = useRef<{ q: string; location?: string; radius?: number } | null>(null)

  // Load contacts from localStorage on mount
  useEffect(() => {
    const store = loadRecruitingV2Store()
    setContacts(store.contactsByPlaceId)
  }, [])

  // Build search query from filters
  function buildSearchQuery(): string {
    const parts: string[] = []
    
    const sportMap: Record<string, string> = {
      soccer: 'soccer',
      basketball: 'basketball',
      football: 'football',
      baseball: 'baseball',
      volleyball: 'volleyball',
      softball: 'softball',
      hockey: 'hockey',
      'ice hockey': 'ice hockey',
      lacrosse: 'lacrosse',
      rugby: 'rugby',
      tennis: 'tennis',
      wrestling: 'wrestling',
      'track & field': 'track and field',
      'cross country': 'cross country',
      swimming: 'swimming',
      mma: 'mma',
      equestrian: 'equestrian',
      shooting: 'shooting',
      weightlifting: 'weightlifting',
      gymnastics: 'gymnastics',
      rowing: 'rowing',
      fencing: 'fencing',
      cricket: 'cricket',
      badminton: 'badminton',
      handball: 'handball',
      waterpolo: 'water polo'
    }

    const levelMap: Record<string, string> = {
      youth: 'youth',
      hs: 'high school',
      college: 'college',
      'semi-pro': 'semi-pro',
      pro: 'professional',
      club: 'club'
    }

    const orgTypeMap: Record<string, string> = {
      school: 'school athletics',
      club: 'club',
      league: 'league',
      association: 'association'
    }

    if (filters.sport === 'other' && filters.sportOther.trim()) {
      parts.push(filters.sportOther.trim())
    } else if (filters.sport && sportMap[filters.sport]) {
      parts.push(sportMap[filters.sport])
    }

    if (filters.level && levelMap[filters.level]) {
      parts.push(levelMap[filters.level])
    }

    if (filters.orgType && orgTypeMap[filters.orgType]) {
      parts.push(orgTypeMap[filters.orgType])
    }

    if (parts.length === 0) {
      parts.push('sports club OR athletics')
    }

    return parts.join(' ').trim()
  }

  const runSearch = useCallback(async () => {
    if (!hasGoogleMapsKey) {
      setError('Google Maps API key not configured')
      setResults([])
      setSelectedPlaceId(null)
      return
    }

    const query = buildSearchQuery()
    if (!query || query.length < 2) {
      setError('Select sport, level, or org type to search')
      setResults([])
      setSelectedPlaceId(null)
      return
    }

    // Cancel any in-flight request
    try {
      abortControllerRef.current?.abort()
    } catch {}

    const ac = new AbortController()
    abortControllerRef.current = ac
    const token = ++searchTokenRef.current
    const requestId = generateRequestId()

    setLoading(true)
    setError(null)
    setIsStale(false)

    // Build search params - location is optional
    const searchParams: { q: string; location?: string; radius?: number } = {
      q: query
    }

    if (filters.locationText && filters.locationText.trim()) {
      searchParams.location = filters.locationText.trim()
      searchParams.radius = Math.round(filters.radiusMiles * 1609.34) // miles to meters
    }

    // Store params for retry
    lastSearchParamsRef.current = { ...searchParams }

    try {
      const proxyResult = await placesProxySearch(
        searchParams,
        {
          signal: ac.signal,
          requestId,
          feature: 'recruiting',
          userAction: 'v2_search'
        }
      )

      if (ac.signal.aborted || token !== searchTokenRef.current) return

      const normalized: NormalizedPlace[] = proxyResult.results.map(p => ({
        placeId: p.placeId,
        name: p.name,
        formattedAddress: p.formattedAddress,
        location: p.location,
        rating: p.rating,
        userRatingsTotal: p.userRatingsTotal,
        types: p.types,
        photoUrl: undefined
      }))

      if (token !== searchTokenRef.current) return

      setResults(normalized)
      lastGoodPlacesRef.current = normalized
      setIsStale(false)

      if (normalized.length > 0) {
        setSelectedPlaceId(normalized[0].placeId)
      } else {
        setSelectedPlaceId(null)
      }
    } catch (e: any) {
      if (ac.signal.aborted || e?.message === 'Aborted' || e?.name === 'AbortError') return
      if (token !== searchTokenRef.current) return

      const normalized = e?.normalized ? e.normalized : normalizeGoogleProxyError({
        code: e?.code,
        userMessage: e?.message,
        devDetails: e?.stack || e?.message || String(e)
      })

      const hasLastGood = lastGoodPlacesRef.current && lastGoodPlacesRef.current.length > 0

      if (hasLastGood && isRetryableError(normalized.code)) {
        setResults(lastGoodPlacesRef.current)
        setIsStale(true)
        setError(normalized.userMessage)
      } else {
        setError(normalized.userMessage)
        setResults([])
        setSelectedPlaceId(null)
        setIsStale(false)
      }
    } finally {
      if (token === searchTokenRef.current) {
        setLoading(false)
      }
    }
  }, [filters])

  const retry = useCallback(() => {
    runSearch()
  }, [runSearch])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        abortControllerRef.current?.abort()
      } catch {}
    }
  }, [])

  // Contact tracking actions
  function handleToggleStar(place: NormalizedPlace) {
    const contact = contacts[place.placeId]
    
    if (contact) {
      // Toggle existing
      toggleStarInStore(place.placeId)
      const store = loadRecruitingV2Store()
      setContacts(store.contactsByPlaceId)
    } else {
      // Create new contact
      upsertContactFromPlace(place)
      const store = loadRecruitingV2Store()
      setContacts(store.contactsByPlaceId)
    }
  }

  function handleUpdateStatus(placeId: string, status: RecruitingV2Status) {
    setStatusInStore(placeId, status)
    const store = loadRecruitingV2Store()
    setContacts(store.contactsByPlaceId)
  }

  function handleUpdateNotes(placeId: string, notes: string) {
    setNotesInStore(placeId, notes)
    const store = loadRecruitingV2Store()
    setContacts(store.contactsByPlaceId)
  }

  function handleUpdateLastContacted(placeId: string, date: string | null) {
    setLastContactedInStore(placeId, date)
    const store = loadRecruitingV2Store()
    setContacts(store.contactsByPlaceId)
  }

  const selectedPlace = results.find(p => p.placeId === selectedPlaceId) || null
  const selectedContact = selectedPlaceId ? contacts[selectedPlaceId] || null : null
  const allContacts = Object.values(contacts)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-green-600 mb-1">RECRUITING UI V2 ACTIVE</div>
          <h2 className="text-2xl font-bold">Recruiting</h2>
        </div>
        <Button
          variant="secondary"
          onClick={() => navigate('/recruiting/legacy')}
          className="text-xs"
        >
          Open Legacy UI
        </Button>
      </div>

      {!hasGoogleMapsKey && <GoogleMapsDisabledNotice className="mb-4" />}

      <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr,400px] gap-6">
        {/* Left: Filters */}
        <div>
          <div className="sticky top-4">
            <RecruitingFilters
              filters={filters}
              onChange={setFilters}
              onSearch={runSearch}
              loading={loading}
              disabled={!hasGoogleMapsKey}
            />
          </div>
        </div>

        {/* Middle: Results */}
        <div>
          <RecruitingResults
            results={results}
            loading={loading}
            error={error}
            isStale={isStale}
            selectedPlaceId={selectedPlaceId}
            contacts={contacts}
            onSelectPlace={setSelectedPlaceId}
            onToggleStar={handleToggleStar}
            onRetry={retry}
          />
        </div>

        {/* Right: Contact Panel */}
        <div>
          <div className="sticky top-4">
            <RecruitingContactPanel
              selectedPlace={selectedPlace}
              contact={selectedContact}
              allContacts={allContacts}
              onUpdateStatus={handleUpdateStatus}
              onUpdateNotes={handleUpdateNotes}
              onUpdateLastContacted={handleUpdateLastContacted}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
