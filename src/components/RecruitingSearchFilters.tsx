import { useEffect, useState } from 'react'
import Input from './ui/Input'
import Select from './ui/Select'
import Button from './ui/Button'
import { loadGoogleMaps, hasGoogleMapsKey } from '../lib/google/maps'

export type LocationFilter = {
  locationText: string
  lat: number | null
  lng: number | null
  radiusMiles: number
}

type Props = {
  value: LocationFilter
  onChange: (filter: LocationFilter) => void
  disabled?: boolean
}

const RADIUS_OPTIONS = [5, 10, 25, 50, 100] as const
const STORAGE_KEY = 'recruiting_location_filter'

export default function RecruitingSearchFilters({ value, onChange, disabled }: Props) {
  const [locationInput, setLocationInput] = useState(value.locationText)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [geocodeError, setGeocodeError] = useState<string | null>(null)
  const [isGeolocating, setIsGeolocating] = useState(false)
  const [geolocationError, setGeolocationError] = useState<string | null>(null)

  // Sync local input with external value when it changes
  useEffect(() => {
    setLocationInput(value.locationText)
  }, [value.locationText])

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as LocationFilter
        onChange(parsed)
      }
    } catch {
      // Ignore parse errors
    }
  }, []) // Only run on mount

  // Save to localStorage whenever value changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch {
      // Ignore storage errors
    }
  }, [value])

  async function geocodeLocation(address: string): Promise<{ lat: number; lng: number } | null> {
    if (!hasGoogleMapsKey) {
      throw new Error('Google Maps API key not configured')
    }

    const google = await loadGoogleMaps()
    const geocoder = new google.maps.Geocoder()

    return new Promise((resolve, reject) => {
      geocoder.geocode({ address }, (results, status) => {
        if (status === 'OK' && results && results[0]?.geometry?.location) {
          const location = results[0].geometry.location
          const latValue = location.lat
          const lngValue = location.lng
          const lat: number = typeof latValue === 'function' ? latValue() : latValue
          const lng: number = typeof lngValue === 'function' ? lngValue() : lngValue
          resolve({ lat, lng })
        } else if (status === 'ZERO_RESULTS') {
          resolve(null)
        } else {
          reject(new Error(`Geocoding failed: ${status}`))
        }
      })
    })
  }

  async function handleApplyLocation() {
    const trimmed = locationInput.trim()
    if (!trimmed) {
      onChange({
        ...value,
        locationText: '',
        lat: null,
        lng: null
      })
      setGeocodeError(null)
      return
    }

    setIsGeocoding(true)
    setGeocodeError(null)

    try {
      const coords = await geocodeLocation(trimmed)
      if (!coords) {
        setGeocodeError('Location not found. Please check the address.')
        onChange({
          ...value,
          locationText: trimmed,
          lat: null,
          lng: null
        })
      } else {
        onChange({
          ...value,
          locationText: trimmed,
          lat: coords.lat,
          lng: coords.lng
        })
        setGeocodeError(null)
      }
    } catch (e: any) {
      setGeocodeError(e?.message || 'Geocoding failed')
      onChange({
        ...value,
        locationText: trimmed,
        lat: null,
        lng: null
      })
    } finally {
      setIsGeocoding(false)
    }
  }

  async function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setGeolocationError('Geolocation not supported by your browser')
      return
    }

    setIsGeolocating(true)
    setGeolocationError(null)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords

          // Reverse geocode to get address text
          if (!hasGoogleMapsKey) {
            // If no API key, just use coordinates
            onChange({
              ...value,
              locationText: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
              lat: latitude,
              lng: longitude
            })
            setIsGeolocating(false)
            return
          }

          const google = await loadGoogleMaps()
          const geocoder = new google.maps.Geocoder()

          geocoder.geocode(
            { location: { lat: latitude, lng: longitude } },
            (results, status) => {
              if (status === 'OK' && results && results[0]) {
                const address = results[0].formatted_address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
                onChange({
                  ...value,
                  locationText: address,
                  lat: latitude,
                  lng: longitude
                })
              } else {
                onChange({
                  ...value,
                  locationText: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
                  lat: latitude,
                  lng: longitude
                })
              }
              setIsGeolocating(false)
            }
          )
        } catch (e: any) {
          setGeolocationError('Failed to get address from location')
          setIsGeolocating(false)
        }
      },
      (error) => {
        setIsGeolocating(false)
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGeolocationError('Location permission denied. Please use manual input.')
            break
          case error.POSITION_UNAVAILABLE:
            setGeolocationError('Location unavailable')
            break
          case error.TIMEOUT:
            setGeolocationError('Location request timed out')
            break
          default:
            setGeolocationError('Failed to get location')
        }
      },
      {
        timeout: 10000,
        maximumAge: 300000, // Cache for 5 minutes
        enableHighAccuracy: false
      }
    )
  }

  function handleClearLocation() {
    setLocationInput('')
    onChange({
      ...value,
      locationText: '',
      lat: null,
      lng: null
    })
    setGeocodeError(null)
    setGeolocationError(null)
  }

  const hasLocation = value.lat !== null && value.lng !== null

  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs uppercase tracking-wide text-foreground/60 mb-1">
          Location
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="City, State or ZIP"
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleApplyLocation()
              }
            }}
            disabled={disabled || isGeocoding || isGeolocating}
          />
          <Button
            onClick={handleApplyLocation}
            disabled={disabled || isGeocoding || isGeolocating || !locationInput.trim()}
          >
            {isGeocoding ? 'Finding...' : 'Apply'}
          </Button>
        </div>
        {geocodeError && (
          <div className="text-sm text-red-600 mt-1">{geocodeError}</div>
        )}
        {geolocationError && (
          <div className="text-sm text-amber-600 mt-1">{geolocationError}</div>
        )}
        {hasLocation && (
          <div className="text-xs text-green-600 mt-1">
            ✓ Location set: {value.locationText}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={handleUseMyLocation}
          disabled={disabled || isGeocoding || isGeolocating || !hasGoogleMapsKey}
        >
          {isGeolocating ? 'Locating...' : '📍 Use my location'}
        </Button>
        {(hasLocation || locationInput) && (
          <Button
            variant="secondary"
            onClick={handleClearLocation}
            disabled={disabled}
          >
            Clear
          </Button>
        )}
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-foreground/60 mb-1">
          Radius
        </div>
        <Select
          value={value.radiusMiles}
          onChange={(e) =>
            onChange({ ...value, radiusMiles: Number(e.target.value) })
          }
          disabled={disabled}
        >
          {RADIUS_OPTIONS.map((miles) => (
            <option key={miles} value={miles}>
              {miles} miles
            </option>
          ))}
        </Select>
      </div>

      {!hasLocation && (
        <div className="text-xs text-foreground/60 italic">
          💡 Add a location to narrow results by distance
        </div>
      )}
    </div>
  )
}
