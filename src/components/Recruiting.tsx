import { useEffect, useMemo, useRef, useState } from 'react'
import Card from './ui/Card'
import Input from './ui/Input'
import Select from './ui/Select'
import Textarea from './ui/Textarea'
import Button from './ui/Button'
import { supabase, supabaseEnvConfigured } from '../lib/supabaseClient'
import { useSupabaseSession } from '../context/SupabaseSessionContext'
import { parseCsvFile } from '../utils/csv'
import { CsvOrgRow, normalizeColumns, parseContacts, validateRow } from '../utils/recruitingImport'
import Papa from 'papaparse'
import { isGoogleCseConfigured, searchContacts, type CseResult } from '../services/googleCse'
import { buildSearchLinks } from '../utils/searchLinks'
import PlacesMap from './PlacesMap'
import type { NormalizedPlace } from '../hooks/usePlacesSearch'
import { usePlaceDetails } from '../hooks/usePlaceDetails'
import Observability, { generateRequestId } from '../lib/obs'
import { hasGoogleMapsKey, textSearch, loadGoogleMaps } from '../lib/google/maps'
import GoogleMapsDisabledNotice from './GoogleMapsDisabledNotice'
import RecruitingSearchFilters, { type LocationFilter } from './RecruitingSearchFilters'

type Org = {
  id: string
  name: string
  place_id?: string | null
  address?: string | null
  sport: string | null
  level: string | null
  org_type: string | null
  country: string | null
  region: string | null
  city: string | null
  website_url: string | null
  general_email: string | null
  general_phone: string | null
  notes: string | null
  source_url: string | null
  source?: string | null
}

type OrgContact = {
  id: string
  org_id: string
  user_id?: string | null
  role: string | null
  name: string | null
  email: string | null
  phone: string | null
  contact_url: string | null
  notes?: string | null
  source_url?: string | null
}

type TargetRow = {
  id: string
  user_id: string
  org_id: string
  status: string
  tags: string[]
  notes: string | null
  next_followup_at: string | null
  created_at: string
  updated_at: string
  orgs?: Org
}

const LEVEL_OPTIONS = ['', 'club', 'college', 'semi-pro', 'pro', 'other']
const ORG_TYPE_OPTIONS = ['', 'school', 'club', 'league', 'association', 'other']

function useIsMobile(): boolean {
  const [isMobile, set] = useState<boolean>(false)
  useEffect(() => {
    const onResize = () => set(window.innerWidth < 768)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return isMobile
}

export default function Recruiting() {
  const { user } = useSupabaseSession()
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<'Explore' | 'My Targets'>('Explore')
  const cloudAvailable = supabaseEnvConfigured && Boolean(supabase)

  return (
    <div className="space-y-6">
      <div className="text-xs uppercase tracking-wide text-black">RECRUITING UI v1 ACTIVE</div>

      <div className="flex items-center gap-2">
        <Button variant={tab === 'Explore' ? 'primary' : 'secondary'} onClick={() => setTab('Explore')}>Explore (Map)</Button>
        <Button variant={tab === 'My Targets' ? 'primary' : 'secondary'} onClick={() => setTab('My Targets')}>My Targets</Button>
      </div>

      {!cloudAvailable ? (
        <Card title="Recruiting">
          <p className="text-foreground/80">
            Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.
          </p>
        </Card>
      ) : (
        <>
          {tab === 'Explore' && <ExplorePanel userId={user?.id ?? null} isMobile={isMobile} />}
          {tab === 'My Targets' && <TargetsPanel userId={user?.id ?? null} />}
        </>
      )}
    </div>
  )
}

// Explore Panel (Map-based discovery via Google Places)
function ExplorePanel({ userId, isMobile }: { userId: string | null, isMobile: boolean }) {
	const [sport, setSport] = useState<string>('')
	const [sportOther, setSportOther] = useState<string>('')
	const [level, setLevel] = useState<string>('')
	const [orgType, setOrgType] = useState<string>('')
	const [searchThisArea, setSearchThisArea] = useState<boolean>(true)
	const [refreshToken, setRefreshToken] = useState<number>(0)

	// Location-based filtering
	const [locationFilter, setLocationFilter] = useState<LocationFilter>({
		locationText: '',
		lat: null,
		lng: null,
		radiusMiles: 25
	})

	const [places, setPlaces] = useState<NormalizedPlace[]>([])
	const [unfilteredPlaces, setUnfilteredPlaces] = useState<NormalizedPlace[]>([])
	const [loading, setLoading] = useState<boolean>(false)
	const [error, setError] = useState<string | null>(null)
	const [isStale, setIsStale] = useState<boolean>(false)
	const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
	const [lastGoodPlaces, setLastGoodPlaces] = useState<NormalizedPlace[]>([])

	const latestCenterRef = useRef<{ lat: number, lng: number }>({ lat: 39.5, lng: -98.35 })
	const latestZoomRef = useRef<number>(5)
	const searchTokenRef = useRef<number>(0)
	const abortControllerRef = useRef<AbortController | null>(null)

	const { details, loading: loadingDetails } = usePlaceDetails(selectedPlaceId || undefined)

  function computeRadiusMeters(zoom: number): number {
    // Approx mapping; smaller zoom => larger radius
    if (zoom >= 15) return 2000
    if (zoom >= 13) return 5000
    if (zoom >= 11) return 10000
    if (zoom >= 9) return 20000
    if (zoom >= 7) return 40000
    return 60000
  }

  // Calculate distance between two coordinates in miles using Haversine formula
  function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 3959 // Earth's radius in miles
    const dLat = (lat2 - lat1) * (Math.PI / 180)
    const dLng = (lng2 - lng1) * (Math.PI / 180)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Filter places by location and radius
  function filterPlacesByLocation(allPlaces: NormalizedPlace[]): NormalizedPlace[] {
    if (locationFilter.lat === null || locationFilter.lng === null) {
      return allPlaces
    }

    return allPlaces.filter((place) => {
      const distance = calculateDistance(
        locationFilter.lat!,
        locationFilter.lng!,
        place.location.lat,
        place.location.lng
      )
      return distance <= locationFilter.radiusMiles
    })
  }

  function buildKeyword(): string {
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
    if (sport === 'other' && sportOther.trim()) {
      parts.push(sportOther.trim())
    } else if (sport && sportMap[sport]) {
      parts.push(sportMap[sport])
    }
    if (level && levelMap[level]) parts.push(levelMap[level])
    if (orgType && orgTypeMap[orgType]) parts.push(orgTypeMap[orgType])
    // Sensible fallbacks
    if (parts.length === 0) {
      parts.push('sports club OR athletics')
    }
    return parts.join(' ').trim()
  }

  async function runPlacesSearch(center: { lat: number, lng: number }, zoom: number) {
    // Early return if Google Maps API key is not configured
    if (!hasGoogleMapsKey) {
      setError('Google Maps API key not configured')
      setPlaces([])
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
    
    Observability.log({
      feature: 'recruitment',
      route: 'ui.explore_map.search',
      status: 'start',
      requestId,
      userId: userId ?? undefined,
      meta: { center, zoom, sport, level, orgType }
    })
    
    try {
      // Ensure Google Maps is loaded (validates API key)
      const google = await loadGoogleMaps()
      if (ac.signal.aborted) return
      if (token !== searchTokenRef.current) return
      
      // Perform text search using shared utility (includes retry logic)
      const request: google.maps.places.TextSearchRequest = {
        query: buildKeyword(),
        location: new google.maps.LatLng(center.lat, center.lng),
        radius: computeRadiusMeters(zoom)
      }

      const firstPage = await textSearch(request, ac.signal)

      if (ac.signal.aborted || token !== searchTokenRef.current) return

      const normalized: NormalizedPlace[] = (firstPage || []).map((p) => {
        const lat = typeof p.geometry?.location?.lat === 'function' ? p.geometry.location.lat() : undefined
        const lng = typeof p.geometry?.location?.lng === 'function' ? p.geometry.location.lng() : undefined
        const photoUrl = p.photos && p.photos[0] ? p.photos[0].getUrl({ maxWidth: 400, maxHeight: 400 }) : undefined
        return {
          placeId: p.place_id!,
          name: p.name || '',
          formattedAddress: p.formatted_address,
          location: { lat: lat ?? 0, lng: lng ?? 0 },
          rating: p.rating,
          userRatingsTotal: p.user_ratings_total as number | undefined,
          types: p.types,
          photoUrl
        }
      }).filter(p => !!p.placeId && typeof p.location.lat === 'number' && typeof p.location.lng === 'number')

      // Only update state if this is still the latest request
      if (token !== searchTokenRef.current) return
      
      // Store unfiltered results
      setUnfilteredPlaces(normalized)
      
      // Apply location-based filtering
      const filtered = filterPlacesByLocation(normalized)
      
      setPlaces(filtered)
      setLastGoodPlaces(filtered)
      setIsStale(false)
      if (filtered.length > 0) {
        setSelectedPlaceId(filtered[0].placeId)
      } else {
        setSelectedPlaceId(null)
      }
      
      Observability.log({
        feature: 'recruitment',
        route: 'ui.explore_map.search',
        status: normalized.length === 0 ? 'empty' : 'ok',
        requestId,
        meta: { count: normalized.length }
      })
    } catch (e: any) {
      // Ignore abortion as error
      if (ac.signal.aborted) return
      if (token !== searchTokenRef.current) return
      
      // On failure, show last known good if present
      if (lastGoodPlaces && lastGoodPlaces.length > 0) {
        setPlaces(lastGoodPlaces)
        setIsStale(true)
        setError(() => {
          if (navigator && navigator.onLine === false) return "You're offline"
          const msg: string = e?.message || 'Search failed'
          if (msg.includes('OVER_QUERY_LIMIT')) return 'Server is rate limiting (429)'
          return msg
        })
      } else {
        setError(typeof e?.message === 'string' ? e.message : String(e || 'Search failed'))
        setPlaces([])
        setSelectedPlaceId(null)
        setIsStale(false)
      }
      
      Observability.log({
        feature: 'recruitment',
        route: 'ui.explore_map.search',
        status: 'error',
        requestId,
        errorName: e?.name,
        errorMessage: e?.message,
        errorStack: e?.stack
      })
    } finally {
      // Only clear loading if this is the latest request
      if (token === searchTokenRef.current) {
        setLoading(false)
      }
    }
  }

  function handleMapIdle(state: { center: { lat: number, lng: number }, zoom: number }) {
    latestCenterRef.current = state.center
    latestZoomRef.current = state.zoom
    if (searchThisArea) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      runPlacesSearch(state.center, state.zoom)
    }
  }

  function refresh() {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    runPlacesSearch(latestCenterRef.current, latestZoomRef.current)
    setRefreshToken(v => v + 1) // force re-render for any dependent UI
  }

  // Trigger search when filters change
  useEffect(() => {
    if (searchThisArea) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      runPlacesSearch(latestCenterRef.current, latestZoomRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport, sportOther, level, orgType, searchThisArea])

  // Re-filter existing results when location filter changes
  useEffect(() => {
    if (unfilteredPlaces.length > 0) {
      const filtered = filterPlacesByLocation(unfilteredPlaces)
      setPlaces(filtered)
      if (filtered.length > 0 && !filtered.find(p => p.placeId === selectedPlaceId)) {
        setSelectedPlaceId(filtered[0].placeId)
      } else if (filtered.length === 0) {
        setSelectedPlaceId(null)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationFilter.lat, locationFilter.lng, locationFilter.radiusMiles])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        abortControllerRef.current?.abort()
      } catch {}
    }
  }, [])

  // Save to My Targets
  const [saving, setSaving] = useState(false)
  const [savedOrgId, setSavedOrgId] = useState<string | null>(null)
  const [contacts, setContacts] = useState<OrgContact[]>([])

  async function ensureOrgForSelected(): Promise<string | null> {
    if (!userId || !selectedPlaceId) return null
    // 1) Check existing
    const { data: existing, error: exErr } = await supabase!
      .from('orgs')
      .select('id')
      .eq('user_id', userId)
      .eq('place_id', selectedPlaceId)
      .limit(1)
      .maybeSingle()
    if (!exErr && existing?.id) return existing.id as string

    const name = details?.name || (places.find(p => p.placeId === selectedPlaceId)?.name ?? '')
    const formatted = details?.formattedAddress || (places.find(p => p.placeId === selectedPlaceId)?.formattedAddress ?? null)
    const website = details?.website || null
    const phone = details?.phone || null
    const gmapsUrl = details?.googleMapsUrl || `https://www.google.com/maps/place/?q=place_id:${selectedPlaceId}`

    const payload = {
      name,
      place_id: selectedPlaceId,
      address: formatted,
      website_url: website,
      general_phone: phone,
      source_url: gmapsUrl,
      source: 'places',
      owner_id: userId
    } as any

    const { data: ins, error: insErr } = await supabase!.from('orgs').insert([payload]).select('id').single()
    if (insErr) {
      // Try to recover if unique conflict (another tab saved)
      const { data: again } = await supabase!
        .from('orgs')
        .select('id')
        .eq('user_id', userId)
        .eq('place_id', selectedPlaceId)
        .limit(1)
        .maybeSingle()
      return (again?.id as string) || null
    }
    return (ins?.id as string) || null
  }

  async function saveToTargets() {
    if (!userId || !selectedPlaceId) return
    setSaving(true)
    try {
      const orgId = (await ensureOrgForSelected()) as string | null
      if (!orgId) return
      setSavedOrgId(orgId)
      await supabase!.from('user_targets').upsert({ user_id: userId, org_id: orgId }, { onConflict: 'user_id,org_id' })
      // load contacts
      const { data: c } = await supabase!.from('org_contacts').select('*').eq('org_id', orgId).eq('user_id', userId).order('created_at', { ascending: true })
      setContacts(Array.isArray(c) ? (c as OrgContact[]) : [])
    } finally {
      setSaving(false)
    }
  }

  // Manual add contact (only when org saved)
  const [contactRole, setContactRole] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactUrl, setContactUrl] = useState('')
  const [contactNotes, setContactNotes] = useState('')
  const [savingContact, setSavingContact] = useState(false)

  async function saveManualContactExplore() {
    if (!userId || !savedOrgId) return
    setSavingContact(true)
    try {
      const payload = {
        org_id: savedOrgId,
        user_id: userId,
        role: contactRole || null,
        name: contactName || null,
        email: contactEmail || null,
        phone: contactPhone || null,
        contact_url: contactUrl || null,
        notes: contactNotes || null
      } as any
      const { error } = await supabase!.from('org_contacts').insert([payload])
      if (!error) {
        const { data: c } = await supabase!.from('org_contacts').select('*').eq('org_id', savedOrgId).eq('user_id', userId).order('created_at', { ascending: true })
        setContacts(Array.isArray(c) ? (c as OrgContact[]) : [])
        setContactRole(''); setContactName(''); setContactEmail(''); setContactPhone(''); setContactUrl(''); setContactNotes('')
      }
    } finally {
      setSavingContact(false)
    }
  }

  const sportsOptions = ['', 'soccer', 'basketball', 'football', 'baseball', 'volleyball', 'softball', 'hockey', 'ice hockey', 'lacrosse', 'rugby', 'tennis', 'wrestling', 'track & field', 'cross country', 'swimming', 'mma', 'equestrian', 'shooting', 'weightlifting', 'gymnastics', 'rowing', 'fencing', 'cricket', 'badminton', 'handball', 'waterpolo', 'other']
  const levelOptions = ['', 'youth', 'hs', 'college', 'semi-pro', 'pro', 'club']
  const orgTypeOptions = ['', 'school', 'club', 'league', 'association', 'other']

  const selected = places.find(p => p.placeId === (selectedPlaceId || '')) || null

	return (
		<Card title="Explore Map">
			{!hasGoogleMapsKey && <GoogleMapsDisabledNotice className="mb-4" />}
			<div className="grid grid-cols-1 md:grid-cols-[360px,1fr] gap-6">
				{/* Filters Panel */}
				<div className="space-y-3">
					<div className="grid grid-cols-1 gap-3">
            {/* Location-based filtering */}
            <div className="border border-border rounded-lg p-3 bg-mid/20">
              <div className="font-medium mb-3 text-sm">Location Filter</div>
              <RecruitingSearchFilters
                value={locationFilter}
                onChange={setLocationFilter}
                disabled={loading}
              />
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-foreground/60 mb-1">Sport</div>
              <Select value={sport} onChange={e => { setSport(e.target.value); if (e.target.value !== 'other') setSportOther('') }}>
                {sportsOptions.map(v => <option key={v} value={v}>{v ? v : 'All sports'}</option>)}
              </Select>
              {sport === 'other' && (
                <div className="mt-2">
                  <Input placeholder="Specify sport…" value={sportOther} onChange={e => setSportOther(e.target.value)} />
                </div>
              )}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-foreground/60 mb-1">Level</div>
              <Select value={level} onChange={e => setLevel(e.target.value)}>
                {levelOptions.map(v => <option key={v} value={v}>{v ? v : 'All levels'}</option>)}
              </Select>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-foreground/60 mb-1">Org Type</div>
              <Select value={orgType} onChange={e => setOrgType(e.target.value)}>
                {orgTypeOptions.map(v => <option key={v} value={v}>{v ? v : 'All org types'}</option>)}
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm mt-1">
              <input type="checkbox" checked={searchThisArea} onChange={e => setSearchThisArea(e.target.checked)} />
              <span>Search this map area</span>
            </label>
							<div className="flex gap-2">
								<Button onClick={refresh} disabled={loading || !userId || !hasGoogleMapsKey}>{loading ? 'Searching…' : 'Refresh results'}</Button>
								<Button variant="secondary" onClick={() => { setSport(''); setSportOther(''); setLevel(''); setOrgType(''); setRefreshToken(v => v + 1) }}>Clear</Button>
							</div>
							{!hasGoogleMapsKey && (
								<div className="text-xs text-amber-300">Search disabled: Google Maps API key not configured</div>
							)}
            <div className="text-xs text-foreground/60">Results powered by Google</div>
            {error && (
              <div className={`text-sm ${isStale ? 'text-amber-600' : 'text-red-600'}`}>
                {error}
                {isStale && <span className="ml-2 font-semibold">(Showing last known good results)</span>}
              </div>
            )}
            {isStale && !error && (
              <div className="text-sm text-amber-600 font-semibold">
                ⚠️ Showing last known good results
              </div>
            )}
          </div>

          {/* Results List (optional) */}
          <div className="border border-border rounded-md divide-y divide-border overflow-hidden">
            {places.length === 0 && unfilteredPlaces.length > 0 && locationFilter.lat !== null && (
              <div className="p-3 text-amber-600">
                No results within {locationFilter.radiusMiles} miles of {locationFilter.locationText}. Try increasing the radius or adjusting your location.
              </div>
            )}
            {places.length === 0 && unfilteredPlaces.length === 0 && (
              <div className="p-3 text-foreground/70">{loading ? 'Loading…' : 'No results yet. Pan/zoom the map and refresh.'}</div>
            )}
            {places.map(p => {
              const distance = locationFilter.lat !== null && locationFilter.lng !== null
                ? calculateDistance(locationFilter.lat, locationFilter.lng, p.location.lat, p.location.lng)
                : null
              return (
                <button key={p.placeId} type="button" onClick={() => setSelectedPlaceId(p.placeId)} className={`w-full text-left p-3 hover:bg-mid/60 ${selectedPlaceId === p.placeId ? 'bg-mid/60' : ''}`}>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm text-foreground/70">
                    {p.formattedAddress}
                    {distance !== null && (
                      <span className="ml-2 text-xs text-blue-500">
                        ({distance.toFixed(1)} mi)
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Map + Drawer */}
        <div className="space-y-3">
          <PlacesMap
            places={places}
            selectedPlaceId={selectedPlaceId}
            onSelect={(pid) => setSelectedPlaceId(pid)}
            onIdle={handleMapIdle}
            height={isMobile ? 280 : 460}
          />

          {/* Details drawer */}
          {!!selected && (
            <div className={isMobile ? 'border border-border rounded-lg p-3' : 'border border-border rounded-lg p-4'}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="headline text-lg">{details?.name || selected.name}</div>
                  <div className="text-sm text-foreground/70">{details?.formattedAddress || selected.formattedAddress}</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setSelectedPlaceId(null)}>Close</Button>
                  <Button onClick={saveToTargets} disabled={!userId || saving}>{saving ? 'Saving…' : 'Save to My Targets'}</Button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {details?.website && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-foreground/60">Website</div>
                    <a href={details.website} target="_blank" rel="noreferrer" className="text-blue-500 underline break-all">{details.website}</a>
                  </div>
                )}
                {details?.phone && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-foreground/60">Phone</div>
                    <div className="break-all">{details.phone}</div>
                  </div>
                )}
                {(details?.googleMapsUrl || selected.placeId) && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-foreground/60">Google Maps</div>
                    <a
                      href={details?.googleMapsUrl || `https://www.google.com/maps/place/?q=place_id:${selected.placeId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-500 underline break-all"
                    >
                      Open in Google Maps
                    </a>
                  </div>
                )}
              </div>

              {/* Find Contacts (external links only) */}
              <div className="mt-4">
                <div className="font-medium mb-2">Find Contacts</div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(`${details?.name || selected.name} coach recruiting coordinator email phone`)}`, '_blank')}
                  >
                    Google Search
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => window.open(`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${details?.name || selected.name} coach recruiting`)}`, '_blank')}
                  >
                    LinkedIn People
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => window.open(`https://x.com/search?q=${encodeURIComponent(`${details?.name || selected.name} coach email`)}&src=typed_query`, '_blank')}
                  >
                    X Search
                  </Button>
                  {details?.website && (
                    <Button variant="secondary" onClick={() => window.open(details.website!, '_blank')}>Open Website</Button>
                  )}
                </div>
              </div>

              {/* Add Contact (requires saved org) */}
              <div className="mt-4 border border-border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Add Contact</div>
                  {!savedOrgId && <div className="text-xs text-foreground/60">Save to My Targets to enable</div>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                  <Input placeholder="Role (e.g., Head Coach)" value={contactRole} onChange={e => setContactRole(e.target.value)} disabled={!savedOrgId} />
                  <Input placeholder="Name" value={contactName} onChange={e => setContactName(e.target.value)} disabled={!savedOrgId} />
                  <Input placeholder="Email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} disabled={!savedOrgId} />
                  <Input placeholder="Phone" value={contactPhone} onChange={e => setContactPhone(e.target.value)} disabled={!savedOrgId} />
                  <Input placeholder="Contact URL" value={contactUrl} onChange={e => setContactUrl(e.target.value)} disabled={!savedOrgId} />
                </div>
                <div className="mt-2">
                  <div className="text-xs uppercase tracking-wide text-foreground/60 mb-1">Notes</div>
                  <Textarea rows={3} placeholder="Optional notes…" value={contactNotes} onChange={e => setContactNotes(e.target.value)} disabled={!savedOrgId} />
                </div>
                <div className="mt-2 flex justify-end">
                  <Button onClick={saveManualContactExplore} disabled={!savedOrgId || savingContact}>{savingContact ? 'Saving…' : 'Save'}</Button>
                </div>

                {/* Existing contacts */}
                {savedOrgId && (
                  <div className="mt-3">
                    <div className="font-medium mb-2">Contacts</div>
                    <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
                      {contacts.length === 0 && <div className="p-3 text-foreground/70">No contacts yet.</div>}
                      {contacts.map(c => (
                        <div key={c.id} className="p-3">
                          <div className="font-medium">{c.role || 'Contact'}</div>
                          <div className="text-sm">{c.name}</div>
                          <div className="text-sm text-foreground/70 flex flex-wrap gap-2">
                            {c.email && <span>{c.email}</span>}
                            {c.phone && <span>{c.phone}</span>}
                            {c.contact_url && <a href={c.contact_url} target="_blank" rel="noreferrer" className="text-blue-500 underline">Profile</a>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 text-xs text-foreground/60">Powered by Google</div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

function DirectoryPanel({ userId, isMobile }: { userId: string | null, isMobile: boolean }) {
  const [q, setQ] = useState('')
  const [sport, setSport] = useState('')
  const [level, setLevel] = useState('')
  const [orgType, setOrgType] = useState('')
  const [country, setCountry] = useState('')
  const [region, setRegion] = useState('')

  const [loading, setLoading] = useState(false)
	const [orgs, setOrgs] = useState<Org[]>([])
  const [selected, setSelected] = useState<Org | null>(null)
	const [contacts, setContacts] = useState<OrgContact[]>([])
  const [savingTarget, setSavingTarget] = useState(false)
  const [devBusy, setDevBusy] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importParsing, setImportParsing] = useState(false)
  const [importRows, setImportRows] = useState<CsvOrgRow[]>([])
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [importPhase, setImportPhase] = useState<'idle' | 'parsed' | 'importing' | 'done'>('idle')
  const [importSummary, setImportSummary] = useState<{ orgs: number; contacts: number; failures: number } | null>(null)

  const canQuery = useMemo(() => Boolean(userId), [userId])
  const cseReady = isGoogleCseConfigured()

  // Contact search + manual add state
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [results, setResults] = useState<CseResult[]>([])
  const [queryText, setQueryText] = useState('')
  const [contactRole, setContactRole] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactUrl, setContactUrl] = useState('')
  const [contactNotes, setContactNotes] = useState('')
  const [savingContact, setSavingContact] = useState(false)
  const [quickLinkUrl, setQuickLinkUrl] = useState('')
  const [savingQuickLink, setSavingQuickLink] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [saveContactSuccess, setSaveContactSuccess] = useState<string>('')
  const [saveLinkSuccess, setSaveLinkSuccess] = useState<string>('')

  const [orgLoadError, setOrgLoadError] = useState<string | null>(null)

  async function loadOrgs() {
    if (!canQuery) return
    setLoading(true)
    setOrgLoadError(null)
    try {
      let query = supabase!.from('orgs').select('*').eq('user_id', userId as string).order('created_at', { ascending: false })
      if (q) {
        query = query.ilike('name', `%${q}%`)
      }
      if (sport) query = query.eq('sport', sport)
      if (level) query = query.eq('level', level)
      if (orgType) query = query.eq('org_type', orgType)
      if (country) query = query.eq('country', country)
      if (region) query = query.eq('region', region)
      const { data, error } = await query
      if (error) {
        const code = (error as any)?.code ? String((error as any).code) : undefined
        const msg = typeof (error as any)?.message === 'string' ? (error as any).message : 'Query failed'
        const lower = msg.toLowerCase()
        const permission = code === '42501' || lower.includes('permission') || lower.includes('rls') || lower.includes('not authorized') || lower.includes('unauthorized')
        setOrgLoadError(permission ? `Permission error (RLS). ${code ? `Code: ${code}` : ''}` : msg)
        setOrgs([])
        return
      }
			setOrgs(Array.isArray(data) ? (data as Org[]) : [])
      // Reset details when list changes
      setSelected(null)
      setContacts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // initial load
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    loadOrgs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // when session becomes ready (userId transitions from null to string), auto-load once
    if (userId) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      loadOrgs()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function loadContacts(orgId: string) {
    const { data, error } = await supabase!.from('org_contacts').select('*').eq('org_id', orgId).eq('user_id', userId as string).order('created_at', { ascending: true })
    if (error) throw error
		setContacts(Array.isArray(data) ? (data as OrgContact[]) : [])
  }

  async function onSelectOrg(o: Org) {
    setSelected(o)
    await loadContacts(o.id)
    // reset transient UI state
    setResults([])
    setSearchError(null)
    setContactRole('')
    setContactName('')
    setContactEmail('')
    setContactPhone('')
    setContactUrl('')
    setContactNotes('')
    setPasteText('')
    // Seed default query
    const { defaultQuery } = buildSearchLinks({
      name: o.name,
      city: o.city,
      region: o.region,
      country: o.country,
      sport: o.sport
    })
    setQueryText(defaultQuery)
  }

  async function saveToTargets() {
    if (!userId || !selected) return
    setSavingTarget(true)
    try {
      const { error } = await supabase!.from('user_targets')
        .upsert({ user_id: userId, org_id: selected.id }, { onConflict: 'user_id,org_id' })
      if (error) throw error
    } finally {
      setSavingTarget(false)
    }
  }

  async function saveLinkAsContact() {
    if (!userId || !selected) return
    const url = quickLinkUrl.trim()
    if (!url) return
    setSavingQuickLink(true)
    try {
      const payload = {
        org_id: selected.id,
        user_id: userId,
        contact_url: url
      }
      const { error } = await supabase!.from('org_contacts').insert([payload as any])
      if (error) throw error
      await loadContacts(selected.id)
      setQuickLinkUrl('')
      setSaveLinkSuccess('Saved link')
      setTimeout(() => setSaveLinkSuccess(''), 1500)
    } finally {
      setSavingQuickLink(false)
    }
  }

  async function seedSample() {
    if (!userId) return
    setDevBusy(true)
    try {
      // Insert 3 sample orgs for this user
      const sampleOrgs: Omit<Org, 'id'>[] = [
        { name: 'Metro United FC', sport: 'soccer', level: 'club', org_type: 'team', country: 'USA', region: 'CA', city: 'Los Angeles', website_url: 'https://example.com/metro', general_email: 'info@metrofc.com', general_phone: '+1 310-555-0180', notes: 'Well-known development club.', source_url: 'https://topdrawersoccer.com' },
        { name: 'Pacific State University', sport: 'basketball', level: 'college', org_type: 'school', country: 'USA', region: 'WA', city: 'Seattle', website_url: 'https://psu.example.edu', general_email: 'athletics@psu.edu', general_phone: '+1 206-555-0144', notes: 'D1 mid-major.', source_url: 'https://ncaa.com' },
        { name: 'North City Wolves', sport: 'ice hockey', level: 'semi-pro', org_type: 'team', country: 'Canada', region: 'BC', city: 'Vancouver', website_url: 'https://wolves.example.ca', general_email: 'contact@wolves.ca', general_phone: '+1 604-555-0101', notes: 'Solid coaching staff.', source_url: 'https://eliteprospects.com' }
      ]
      const { data: inserted, error } = await supabase!.from('orgs')
        .insert(sampleOrgs.map(o => ({ ...o, owner_id: userId })))
        .select('*')
      if (error) throw error
      const orgIds = (inserted as Org[]).map(o => o.id)
      // Add simple contacts
      const contactsToInsert: Omit<OrgContact, 'id'>[] = [
        { org_id: orgIds[0], user_id: userId, role: 'Director', name: 'Alex Morgan', email: 'alex@metrofc.com', phone: '+1 310-555-0199', contact_url: 'https://linkedin.com/in/alexm' },
        { org_id: orgIds[1], user_id: userId, role: 'Head Coach', name: 'Jamie Lee', email: 'coach.lee@psu.edu', phone: '+1 206-555-0177', contact_url: 'https://psu.example.edu/athletics/staff/lee' },
        { org_id: orgIds[2], user_id: userId, role: 'GM', name: 'Jordan Smith', email: 'jsmith@wolves.ca', phone: '+1 604-555-0120', contact_url: null }
      ]
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { error: cErr } = await supabase!.from('org_contacts').insert(contactsToInsert)
      if (cErr) throw cErr
      await loadOrgs()
    } finally {
      setDevBusy(false)
    }
  }

  async function searchInApp() {
    if (!selected) return
    setSearching(true)
    setSearchError(null)
    try {
      const fallback = buildSearchLinks({
        name: selected.name,
        city: selected.city,
        region: selected.region,
        country: selected.country,
        sport: selected.sport
      }).defaultQuery
      const q = (queryText && queryText.trim()) ? queryText.trim() : fallback
      const res = await searchContacts(q)
      setResults(res)
    } catch (e: any) {
      setSearchError('Search failed. Try the external links below.')
    } finally {
      setSearching(false)
    }
  }

  async function saveManualContact() {
    if (!userId || !selected) return
    setSavingContact(true)
    try {
      const payload = {
        org_id: selected.id,
        user_id: userId,
        role: contactRole || null,
        name: contactName || null,
        email: contactEmail || null,
        phone: contactPhone || null,
        contact_url: contactUrl || null,
        notes: contactNotes || null
      } as any
      const { error } = await supabase!.from('org_contacts').insert([payload])
      if (error) throw error
      await loadContacts(selected.id)
      setContactRole('')
      setContactName('')
      setContactEmail('')
      setContactPhone('')
      setContactUrl('')
      setContactNotes('')
      setSaveContactSuccess('Contact saved')
      setTimeout(() => setSaveContactSuccess(''), 1500)
    } finally {
      setSavingContact(false)
    }
  }

  function parsePastedContact() {
    const text = pasteText || ''
    // First email
    const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
    if (emailMatch) setContactEmail(emailMatch[0])
    // First phone (very permissive; captures international and various formats)
    const phoneMatch = text.match(/(\+?\d[\d\s().-]{7,}\d)/)
    if (phoneMatch) setContactPhone(phoneMatch[0].trim())
    // First URL if present
    const urlMatch = text.match(/https?:\/\/[^\s)]+/i)
    if (urlMatch && !contactUrl) setContactUrl(urlMatch[0])
  }

  return (
    <Card
      title="Directory"
      actions={(
        <div className="flex items-center gap-2">
          <Button onClick={() => setImportOpen(true)} disabled={!userId}>Import CSV</Button>
          {import.meta.env.DEV && (
            <Button onClick={seedSample} disabled={!userId || devBusy}>
              {devBusy ? 'Seeding…' : 'Seed sample (dev)'}
            </Button>
          )}
        </div>
      )}
    >
      <div className="text-xs uppercase tracking-wide text-black">Directory Search Active</div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr,360px] gap-6">
        <div className="space-y-3">
              {orgLoadError && (
                <div className="text-sm text-red-500">{orgLoadError}</div>
              )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input placeholder="Search by name…" value={q} onChange={e => setQ(e.target.value)} />
            <Input placeholder="Sport" value={sport} onChange={e => setSport(e.target.value)} />
            <Select value={level} onChange={e => setLevel(e.target.value)}>
              {LEVEL_OPTIONS.map(v => <option key={v} value={v}>{v ? v : 'Any level'}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Select value={orgType} onChange={e => setOrgType(e.target.value)}>
              {ORG_TYPE_OPTIONS.map(v => <option key={v} value={v}>{v ? v : 'Any org type'}</option>)}
            </Select>
            <Input placeholder="Country" value={country} onChange={e => setCountry(e.target.value)} />
            <Input placeholder="State/Region" value={region} onChange={e => setRegion(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={loadOrgs} disabled={loading || !userId}>{loading ? 'Loading…' : 'Search'}</Button>
            <Button variant="secondary" onClick={() => { setQ(''); setSport(''); setLevel(''); setOrgType(''); setCountry(''); setRegion('') }}>Clear</Button>
          </div>

          <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
            {orgs.length === 0 && (
              <div className="p-4 text-foreground/70">{loading ? 'Loading…' : 'No results found.'}</div>
            )}
            {orgs.map(o => (
              <button key={o.id} type="button" onClick={() => onSelectOrg(o)} className="w-full text-left p-4 hover:bg-mid/60">
                <div className="font-medium">{o.name}</div>
                <div className="text-sm text-foreground/70">
                  {[o.level, o.sport, o.org_type].filter(Boolean).join(' • ')}
                  {((o.city || o.region || o.country) ? ` — ${[o.city, o.region, o.country].filter(Boolean).join(', ')}` : '')}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Details drawer / modal */}
        {!!selected && (
          <div className={isMobile ? 'fixed inset-0 z-50 bg-black/40 flex items-end' : ''}>
            <div className={isMobile ? 'bg-background rounded-t-xl w-full p-4' : 'border border-border rounded-lg p-4 h-full overflow-auto'}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="headline text-lg">{selected.name}</div>
                  <div className="text-sm text-foreground/70">
                    {[selected.level, selected.sport, selected.org_type].filter(Boolean).join(' • ')}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
                  <Button onClick={saveToTargets} disabled={!userId || savingTarget}>{savingTarget ? 'Saving…' : 'Save to My Targets'}</Button>
                </div>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Website" value={selected.website_url} kind="link" />
                  <Field label="General Email" value={selected.general_email} />
                  <Field label="General Phone" value={selected.general_phone} />
                  <Field label="Source URL" value={selected.source_url} kind="link" />
                </div>
                <Field label="Notes" value={selected.notes} />

                {/* Find Contacts */}
                <div className="border border-border rounded-lg p-3">
                  <div className="font-medium mb-2">Find Contacts</div>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-2">
                    <Input placeholder="Edit search query…" value={queryText} onChange={e => setQueryText(e.target.value)} />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={searchInApp}
                        disabled={!cseReady || searching || !queryText.trim()}
                      >
                        {searching ? 'Searching…' : 'Search Google (in app)'}
                      </Button>
                      <Button variant="secondary" onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(queryText)}`, '_blank')}>
                        Open Google
                      </Button>
                      <Button variant="secondary" onClick={() => window.open(`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(queryText)}`, '_blank')}>
                        Open LinkedIn
                      </Button>
                      <Button variant="secondary" onClick={() => window.open(`https://x.com/search?q=${encodeURIComponent(queryText)}&src=typed_query`, '_blank')}>
                        Open X
                      </Button>
                      {selected.website_url && (
                        <Button variant="secondary" onClick={() => window.open(selected.website_url!, '_blank')}>
                          Open Website
                        </Button>
                      )}
                    </div>
                  </div>
                  {!cseReady && (
                    <div className="mt-1 text-xs text-foreground/60">
                      In-app search unavailable (missing API key).
                    </div>
                  )}

                  {/* In-app results */}
                  {searchError && (
                    <div className="mt-2 border border-red-500/40 bg-red-500/10 rounded-md p-2 text-sm">
                      {searchError}
                    </div>
                  )}
                  {results.length > 0 && (
                    <div className="mt-3 border border-border rounded-md divide-y divide-border overflow-hidden">
                      {results.map((r, idx) => (
                        <div key={`r-${idx}`} className="p-3">
                          <div className="font-medium break-all">
                            <a href={r.link} target="_blank" rel="noreferrer" className="text-blue-600 underline">{r.title}</a>
                          </div>
                          <div className="text-sm text-foreground/70 mt-1 break-words">{r.snippet}</div>
                          <div className="mt-2">
                            <Button
                              variant="secondary"
                              onClick={() => {
                                setContactUrl(r.link || '')
                                setContactNotes(r.snippet || '')
                                setContactRole(v => v || 'Lead')
                                setContactName('')
                              }}
                            >
                              Save as Lead
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Save link as contact (quick) */}
                  <div className="mt-3 flex gap-2">
                    <Input
                      placeholder="Paste a profile or staff page URL"
                      value={quickLinkUrl}
                      onChange={e => setQuickLinkUrl(e.target.value)}
                    />
                    <Button onClick={saveLinkAsContact} disabled={!userId || savingQuickLink || !quickLinkUrl.trim()}>
                      {savingQuickLink ? 'Saving…' : 'Save link as contact'}
                    </Button>
                  </div>
                  {saveLinkSuccess && (
                    <div className="mt-1 text-green-600 text-sm" aria-live="polite">{saveLinkSuccess}</div>
                  )}

                  {/* Paste Contact Info */}
                  <div className="mt-3">
                    <div className="text-xs uppercase tracking-wide text-foreground/60 mb-1">Paste Contact Info</div>
                    <Textarea
                      rows={3}
                      placeholder="Paste any text from a web page…"
                      value={pasteText}
                      onChange={e => setPasteText(e.target.value)}
                    />
                    <div className="mt-2">
                      <Button variant="secondary" onClick={parsePastedContact}>Parse</Button>
                    </div>
                  </div>
                </div>

                {/* Manual Add Contact */}
                <div className="border border-border rounded-lg p-3">
                  <div className="font-medium mb-2">Manual Add Contact</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input placeholder="Role (e.g., Head Coach)" value={contactRole} onChange={e => setContactRole(e.target.value)} />
                    <Input placeholder="Name" value={contactName} onChange={e => setContactName(e.target.value)} />
                    <Input placeholder="Email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
                    <Input placeholder="Phone" value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
                    <Input placeholder="Contact URL" value={contactUrl} onChange={e => setContactUrl(e.target.value)} />
                  </div>
                  <div className="mt-3">
                    <div className="text-xs uppercase tracking-wide text-foreground/60 mb-1">Notes</div>
                    <Textarea rows={3} placeholder="Optional notes…" value={contactNotes} onChange={e => setContactNotes(e.target.value)} />
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button onClick={saveManualContact} disabled={!userId || savingContact}>{savingContact ? 'Saving…' : 'Save'}</Button>
                  </div>
                  {saveContactSuccess && (
                    <div className="mt-1 text-green-600 text-sm" aria-live="polite">{saveContactSuccess}</div>
                  )}
                </div>

                <div>
                  <div className="font-medium mb-2">Contacts</div>
                  <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
                    {contacts.length === 0 && <div className="p-3 text-foreground/70">No contacts yet.</div>}
                    {contacts.map(c => (
                      <div key={c.id} className="p-3">
                        <div className="font-medium">{c.role || 'Contact'}</div>
                        <div className="text-sm">{c.name}</div>
                        <div className="text-sm text-foreground/70 flex flex-wrap gap-2">
                          {c.email && <span>{c.email}</span>}
                          {c.phone && <span>{c.phone}</span>}
                          {c.contact_url && <a href={c.contact_url} target="_blank" rel="noreferrer" className="text-blue-500 underline">Profile</a>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Import modal */}
        {importOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center md:justify-center">
            <div className="bg-background rounded-t-xl md:rounded-xl w-full md:max-w-4xl p-4 border border-border">
              <div className="flex items-start justify-between mb-2">
                <div className="headline text-lg">Import CSV</div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => { setImportOpen(false); setImportRows([]); setImportErrors([]); setImportPhase('idle'); setImportSummary(null) }}>Close</Button>
                </div>
              </div>

              {importPhase === 'idle' && (
                <div className="space-y-3">
                  <div className="text-sm text-foreground/80">
                    Expected columns (case-insensitive): org_name, sport, level, org_type, country, region, city, website_url, general_email, general_phone, source_url, contacts_json (optional).
                  </div>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setImportParsing(true)
                      try {
                        const { rows, errors } = await parseCsvFile(file)
                        const normalized = rows.map(r => normalizeColumns(r))
                        const validationErrors = normalized.flatMap((r, idx) => validateRow(r, idx))
                        setImportRows(normalized)
                        setImportErrors([...errors, ...validationErrors])
                        setImportPhase('parsed')
                      } finally {
                        setImportParsing(false)
                      }
                    }}
                  />
                  {importParsing && <div className="text-sm">Parsing…</div>}
                </div>
              )}

              {importPhase === 'parsed' && (
                <div className="space-y-3">
                  <div className="text-sm">
                    Rows parsed: <span className="font-semibold">{importRows.length}</span>
                  </div>
                  {importErrors.length > 0 && (
                    <div className="border border-amber-500/40 bg-amber-500/10 rounded-md p-3 text-sm">
                      <div className="font-semibold mb-1">Errors</div>
                      <ul className="list-disc pl-5 space-y-1 max-h-44 overflow-auto">
                        {importErrors.map((e, i) => <li key={`err-${i}`}>{e}</li>)}
                      </ul>
                    </div>
                  )}
                  <div className="overflow-x-auto border border-black/10 rounded-md">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr>
                          {['org_name','sport','level','org_type','country','region','city','website_url','general_email','general_phone','source_url','contacts_json'].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-black/70 border-b border-black/10">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.slice(0, 10).map((r, i) => (
                          <tr key={`row-${i}`} className="border-b border-black/10">
                            <td className="px-3 py-2 text-sm text-black">{r.org_name}</td>
                            <td className="px-3 py-2 text-sm text-black">{r.sport}</td>
                            <td className="px-3 py-2 text-sm text-black">{r.level}</td>
                            <td className="px-3 py-2 text-sm text-black">{r.org_type}</td>
                            <td className="px-3 py-2 text-sm text-black">{r.country}</td>
                            <td className="px-3 py-2 text-sm text-black">{r.region}</td>
                            <td className="px-3 py-2 text-sm text-black">{r.city}</td>
                            <td className="px-3 py-2 text-sm text-black break-all">{r.website_url}</td>
                            <td className="px-3 py-2 text-sm text-black break-all">{r.general_email}</td>
                            <td className="px-3 py-2 text-sm text-black break-all">{r.general_phone}</td>
                            <td className="px-3 py-2 text-sm text-black break-all">{r.source_url}</td>
                            <td className="px-3 py-2 text-sm"><span className="text-black/70">{r.contacts_json ? 'yes' : ''}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="text-xs text-foreground/70">Showing first 10 rows.</div>
                  <div className="flex justify-end">
                    <Button
                      onClick={async () => {
                        if (!userId) return
                        setImportPhase('importing')
                        let insertedOrgs = 0
                        let insertedContacts = 0
                        let failures = 0
                        try {
                          const orgPayload = importRows.map(r => ({
                            name: r.org_name,
                            sport: r.sport || null,
                            level: r.level || null,
                            org_type: r.org_type || null,
                            country: r.country || null,
                            region: r.region || null,
                            city: r.city || null,
                            website_url: r.website_url || null,
                            general_email: r.general_email || null,
                            general_phone: r.general_phone || null,
                            source_url: r.source_url || null,
                            owner_id: userId
                          }))
                          const { data: orgsIns, error: orgErr } = await supabase!.from('orgs').insert(orgPayload).select('*')
                          if (orgErr) throw orgErr
                          insertedOrgs = (orgsIns || []).length

                          // Build contacts
                          const contactsIns = []
                          for (let i = 0; i < importRows.length; i++) {
                            const row = importRows[i]
                            const org = (orgsIns as any[])[i]
                            if (!org) continue
                            const contacts = parseContacts(row.contacts_json)
                            for (const c of contacts) {
                              contactsIns.push({
                                org_id: org.id,
                                user_id: userId,
                                role: c.role ?? null,
                                name: c.name ?? null,
                                email: c.email ?? null,
                                phone: c.phone ?? null,
                                contact_url: c.contact_url ?? null
                              })
                            }
                          }
                          if (contactsIns.length > 0) {
                            const { data: contactsData, error: cErr } = await supabase!.from('org_contacts').insert(contactsIns).select('id')
                            if (cErr) throw cErr
                            insertedContacts = (contactsData || []).length
                          }

                          setImportSummary({ orgs: insertedOrgs, contacts: insertedContacts, failures })
                          setImportPhase('done')
                          await loadOrgs()
                        } catch (e) {
                          failures = importRows.length
                          setImportSummary({ orgs: insertedOrgs, contacts: insertedContacts, failures })
                          setImportPhase('done')
                        }
                      }}
                      disabled={importErrors.length > 0 || !userId}
                    >
                      Confirm Import
                    </Button>
                  </div>
                </div>
              )}

              {importPhase === 'importing' && (
                <div className="text-sm">Importing…</div>
              )}

              {importPhase === 'done' && importSummary && (
                <div className="space-y-2">
                  <div className="font-medium">Import complete</div>
                  <div className="text-sm">Inserted orgs: {importSummary.orgs}</div>
                  <div className="text-sm">Inserted contacts: {importSummary.contacts}</div>
                  <div className="text-sm">Failures: {importSummary.failures}</div>
                  <div className="flex justify-end">
                    <Button onClick={() => { setImportOpen(false); setImportRows([]); setImportErrors([]); setImportPhase('idle'); setImportSummary(null) }}>Done</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

function Field({ label, value, kind }: { label: string, value: string | null, kind?: 'link' }) {
  if (!value) return null
  if (kind === 'link') {
    return (
      <div>
        <div className="text-xs uppercase tracking-wide text-foreground/60">{label}</div>
        <a href={value} target="_blank" rel="noreferrer" className="text-blue-500 underline break-all">{value}</a>
      </div>
    )
  }
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-foreground/60">{label}</div>
      <div className="break-all">{value}</div>
    </div>
  )
}

function TargetsPanel({ userId }: { userId: string | null }) {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<TargetRow[]>([])
  const [dueOnly, setDueOnly] = useState<boolean>(false)

  function toDateInputValue(value: string | null | undefined): string {
    if (!value) return ''
		const ts = Date.parse(value)
		if (Number.isNaN(ts)) return ''
		try {
			const d = new Date(ts)
			const t = d.getTime()
			if (Number.isNaN(t)) return ''
			return d.toISOString().slice(0, 10)
		} catch {
			return ''
		}
  }

	function sanitizeTargetRow(input: any): TargetRow {
		const tags: string[] = Array.isArray(input?.tags) ? input.tags.filter(Boolean).map((x: any) => String(x)) : []
		const nextFollowup: string | null =
			typeof input?.next_followup_at === 'string' && !Number.isNaN(Date.parse(input.next_followup_at))
				? input.next_followup_at
				: null
		const status: string = typeof input?.status === 'string' && input.status.trim() ? input.status : 'To Contact'
		return {
			id: String(input?.id ?? ''),
			user_id: String(input?.user_id ?? ''),
			org_id: String(input?.org_id ?? ''),
			status,
			tags,
			notes: input?.notes ?? null,
			next_followup_at: nextFollowup,
			created_at: String(input?.created_at ?? new Date().toISOString()),
			updated_at: String(input?.updated_at ?? new Date().toISOString()),
			orgs: (input?.orgs && typeof input.orgs === 'object') ? input.orgs as Org : undefined
		}
	}

  async function loadTargets() {
    if (!userId) return
    setLoading(true)
    try {
      const { data, error } = await supabase!
        .from('user_targets')
        .select('*, orgs:org_id(*)')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
      if (error) throw error
			const safe = Array.isArray(data) ? (data as any[]).map(sanitizeTargetRow) : []
			setRows(safe)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    loadTargets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function updateRow(id: string, patch: Partial<TargetRow>) {
    if (!userId) return
    const { error } = await supabase!.from('user_targets').update(patch).eq('id', id).eq('user_id', userId)
    if (error) return
    await loadTargets()
  }

  function tagsToString(tags: string[] | null | undefined): string {
    return Array.isArray(tags) ? tags.join(', ') : ''
  }
  function stringToTags(value: string): string[] {
    return value.split(',').map(s => s.trim()).filter(Boolean)
  }

  const filteredRows = rows.filter(r => {
    if (!dueOnly) return true
    if (!r.next_followup_at) return false
    try {
      return new Date(r.next_followup_at).getTime() <= Date.now()
    } catch {
      return false
    }
  })

  function exportCsv() {
		const rowsForCsv = filteredRows.map(r => ({
			org_name: r.orgs?.name ?? '',
			sport: r.orgs?.sport ?? '',
			level: r.orgs?.level ?? '',
			org_type: r.orgs?.org_type ?? '',
			location: [r.orgs?.city, r.orgs?.region, r.orgs?.country].filter(Boolean).join(', '),
			website_url: r.orgs?.website_url ?? '',
			general_email: r.orgs?.general_email ?? '',
			general_phone: r.orgs?.general_phone ?? '',
			status: r.status ?? 'To Contact',
			tags: (Array.isArray(r.tags) ? r.tags : []).join(','),
			notes: r.notes ?? '',
			next_followup_at: r.next_followup_at ?? ''
		}))
		let csv = ''
		try {
			csv = Papa.unparse(rowsForCsv, { header: true })
		} catch {
			// Fallback manual CSV to avoid runtime crash
			if (rowsForCsv.length > 0) {
				const headers = Object.keys(rowsForCsv[0])
				const escape = (v: unknown) => String(v ?? '').replace(/"/g, '""')
				const lines = [
					headers.join(','),
					...rowsForCsv.map(r => headers.map(h => `"${escape((r as any)[h])}"`).join(','))
				]
				csv = lines.join('\r\n')
			} else {
				csv = ''
			}
		}
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = 'my-targets.csv'
		a.click()
		URL.revokeObjectURL(url)
  }

  const STATUS_OPTIONS = ['To Contact', 'Contacted', 'In Progress', 'Offer/Visit', 'Closed']

  return (
    <Card
      title="My Targets"
      actions={(
        <div className="flex items-center gap-2">
          <Button variant={dueOnly ? 'primary' : 'secondary'} onClick={() => setDueOnly(v => !v)}>
            {dueOnly ? 'Due Follow-ups (On)' : 'Due Follow-ups'}
          </Button>
          <Button onClick={exportCsv} disabled={filteredRows.length === 0}>Export CSV</Button>
        </div>
      )}
    >
      <div className="space-y-4">
        {filteredRows.length === 0 && (
          <div className="text-foreground/70">{loading ? 'Loading…' : 'No saved targets yet.'}</div>
        )}
        {filteredRows.map(r => (
          <div key={r.id} className="border border-border rounded-lg p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{r.orgs?.name ?? 'Unknown Org'}</div>
                <div className="text-sm text-foreground/70">
                  {[r.orgs?.level, r.orgs?.sport, r.orgs?.org_type].filter(Boolean).join(' • ')}
                </div>
              </div>
              <div className="flex gap-2">
                {r.orgs?.website_url && (
                  <Button variant="secondary" onClick={() => window.open(r.orgs!.website_url!, '_blank')}>Open Website</Button>
                )}
                {(r.orgs?.general_email || r.orgs?.general_phone) && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const value = r.orgs?.general_email || r.orgs?.general_phone || ''
                      if (value) navigator.clipboard.writeText(value)
                    }}
                  >
                    Copy {r.orgs?.general_email ? 'Email' : 'Phone'}
                  </Button>
                )}
              </div>
            </div>

            {/* Quick status chips */}
            <div className="mt-3 flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(s => (
                <Button
                  key={`${r.id}-${s}`}
									variant={(r.status ?? 'To Contact') === s ? 'primary' : 'secondary'}
									onClick={() => updateRow(r.id, { status: s })}
                >
                  {s.replace('/', '-')}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-foreground/60 mb-1">Status</div>
								<Select value={r.status ?? 'To Contact'} onChange={e => updateRow(r.id, { status: e.target.value })}>
                  {['To Contact', 'Contacted', 'In Progress', 'Offer/Visit', 'Closed'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-foreground/60 mb-1">Next Follow-Up</div>
                <Input
                  type="date"
                  value={toDateInputValue(r.next_followup_at)}
                  onChange={e => {
										let iso: string | null = null
										if (e.target.value) {
											try {
												const d = new Date(e.target.value + 'T12:00:00')
												const t = d.getTime()
												iso = Number.isNaN(t) ? null : d.toISOString()
											} catch {
												iso = null
											}
										}
                    // eslint-disable-next-line @typescript-eslint/no-floating-promises
                    updateRow(r.id, { next_followup_at: iso as any })
                  }}
                />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-foreground/60 mb-1">Tags</div>
                <Input
                  placeholder="comma,separated,tags"
                  value={tagsToString(r.tags)}
                  onChange={e => updateRow(r.id, { tags: stringToTags(e.target.value) as any })}
                />
              </div>
            </div>

            <div className="mt-3">
              <div className="text-xs uppercase tracking-wide text-foreground/60 mb-1">Notes</div>
              <Textarea
                rows={3}
                placeholder="Notes about your outreach…"
                value={r.notes ?? ''}
                onChange={e => updateRow(r.id, { notes: e.target.value })}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}


