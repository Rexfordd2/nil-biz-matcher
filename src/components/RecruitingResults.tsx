/**
 * RecruitingV2 Results Panel (Middle)
 */

import { useMemo } from 'react'
import type { NormalizedPlace } from '../hooks/usePlacesSearch'
import type { RecruitingV2Contact } from '../recruiting/v2/types'
import Button from './ui/Button'

type Props = {
  results: NormalizedPlace[]
  loading: boolean
  error: string | null
  isStale: boolean
  selectedPlaceId: string | null
  contacts: Record<string, RecruitingV2Contact>
  onSelectPlace: (placeId: string) => void
  onToggleStar: (place: NormalizedPlace) => void
  onRetry: () => void
}

export default function RecruitingResults({
  results,
  loading,
  error,
  isStale,
  selectedPlaceId,
  contacts,
  onSelectPlace,
  onToggleStar,
  onRetry
}: Props) {
  const sortedResults = useMemo(() => {
    // Sort: starred first, then alphabetically
    return [...results].sort((a, b) => {
      const aStarred = contacts[a.placeId]?.starred ?? false
      const bStarred = contacts[b.placeId]?.starred ?? false
      
      if (aStarred !== bStarred) {
        return bStarred ? 1 : -1
      }
      
      return a.name.localeCompare(b.name)
    })
  }, [results, contacts])

  if (loading && results.length === 0) {
    return (
      <div className="border border-border rounded-lg p-8 text-center text-foreground/70">
        Searching...
      </div>
    )
  }

  if (error && !isStale) {
    return (
      <div className="border border-border rounded-lg p-6">
        <div className="text-red-600 mb-4">
          <div className="font-semibold mb-2">❌ Search Error</div>
          <div className="text-sm">{error}</div>
        </div>
        <Button onClick={onRetry} variant="secondary">
          Retry Search
        </Button>
      </div>
    )
  }

  if (results.length === 0 && !loading) {
    return (
      <div className="border border-border rounded-lg p-8 text-center text-foreground/70">
        No results yet. Use the filters on the left to search.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {isStale && error && (
        <div className="border border-amber-500/40 bg-amber-500/10 rounded-md p-3">
          <div className="text-amber-600 text-sm flex items-center justify-between gap-2">
            <span>
              ⚠️ {error}
              <span className="ml-2 font-semibold">(Showing last known good results)</span>
            </span>
            <Button 
              variant="secondary" 
              onClick={onRetry} 
              disabled={loading}
              className="shrink-0"
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      <div className="text-sm text-foreground/70 mb-2">
        {sortedResults.length} result{sortedResults.length !== 1 ? 's' : ''}
        {Object.values(contacts).filter(c => c.starred).length > 0 && (
          <span className="ml-2">
            • {Object.values(contacts).filter(c => c.starred).length} starred
          </span>
        )}
      </div>

      <div className="border border-border rounded-md divide-y divide-border overflow-hidden max-h-[600px] overflow-y-auto">
        {sortedResults.map(place => {
          const contact = contacts[place.placeId]
          const isStarred = contact?.starred ?? false
          const isSelected = selectedPlaceId === place.placeId

          return (
            <div
              key={place.placeId}
              className={`p-3 hover:bg-mid/60 cursor-pointer transition-colors ${
                isSelected ? 'bg-mid/60' : ''
              }`}
              onClick={() => onSelectPlace(place.placeId)}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    onToggleStar(place)
                  }}
                  className="mt-1 text-xl hover:scale-110 transition-transform"
                  title={isStarred ? 'Remove from shortlist' : 'Add to shortlist'}
                >
                  {isStarred ? '⭐' : '☆'}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{place.name}</div>
                  {place.formattedAddress && (
                    <div className="text-sm text-foreground/70 truncate">
                      {place.formattedAddress}
                    </div>
                  )}
                  {place.rating && (
                    <div className="text-xs text-foreground/60 mt-1">
                      ⭐ {place.rating.toFixed(1)}
                      {place.userRatingsTotal && ` (${place.userRatingsTotal} reviews)`}
                    </div>
                  )}
                  {contact && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        {contact.status}
                      </span>
                      {contact.lastContactedAt && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400 border border-green-500/30">
                          Contacted {new Date(contact.lastContactedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
