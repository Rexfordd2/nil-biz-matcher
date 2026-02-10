/**
 * RecruitingV2 Filters Panel (Left)
 */

import { useState } from 'react'
import Input from './ui/Input'
import Select from './ui/Select'
import Button from './ui/Button'
import type { SearchFilters } from '../recruiting/v2/types'
import { SEARCH_PRESETS } from '../recruiting/v2/presets'

type Props = {
  filters: SearchFilters
  onChange: (filters: SearchFilters) => void
  onSearch: () => void
  loading: boolean
  disabled: boolean
}

const SPORTS_OPTIONS = [
  '', 'soccer', 'basketball', 'football', 'baseball', 'volleyball', 'softball', 
  'hockey', 'ice hockey', 'lacrosse', 'rugby', 'tennis', 'wrestling', 
  'track & field', 'cross country', 'swimming', 'mma', 'equestrian', 
  'shooting', 'weightlifting', 'gymnastics', 'rowing', 'fencing', 
  'cricket', 'badminton', 'handball', 'waterpolo', 'other'
]

const LEVEL_OPTIONS = ['', 'youth', 'hs', 'college', 'semi-pro', 'pro', 'club']

const ORG_TYPE_OPTIONS = ['', 'school', 'club', 'league', 'association', 'other']

const RADIUS_OPTIONS = [5, 10, 25, 50, 100]

export default function RecruitingFilters({ filters, onChange, onSearch, loading, disabled }: Props) {
  const [locationInput, setLocationInput] = useState(filters.locationText)

  function updateFilter<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    onChange({ ...filters, [key]: value })
  }

  function handleClear() {
    onChange({
      sport: '',
      sportOther: '',
      level: '',
      orgType: '',
      locationText: '',
      radiusMiles: 25
    })
    setLocationInput('')
  }

  function handleLocationApply() {
    updateFilter('locationText', locationInput.trim())
  }

  const canSearch = 
    (filters.sport && filters.sport !== '') || 
    (filters.level && filters.level !== '') || 
    (filters.orgType && filters.orgType !== '')

  function handlePresetClick(presetId: string) {
    const preset = SEARCH_PRESETS.find(p => p.id === presetId)
    if (!preset) return

    onChange({
      ...filters,
      sport: preset.sport,
      sportOther: preset.sportOther || '',
      level: preset.level,
      orgType: preset.orgType
    })
  }

  return (
    <div className="space-y-4">
      {/* Search Presets */}
      <div>
        <div className="text-xs uppercase tracking-wide text-foreground/60 mb-2">Quick Presets</div>
        <div className="flex flex-wrap gap-1.5">
          {SEARCH_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handlePresetClick(preset.id)}
              disabled={disabled}
              className="px-2 py-1 text-xs rounded bg-mid/60 hover:bg-mid text-foreground/90 hover:text-white border border-border hover:border-foreground/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={`Set: ${preset.sport}${preset.sportOther ? ` (${preset.sportOther})` : ''} • ${preset.level} • ${preset.orgType}`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-border pt-4"></div>
        <div className="text-xs uppercase tracking-wide text-foreground/60 mb-1">Sport</div>
        <Select 
          value={filters.sport} 
          onChange={e => {
            updateFilter('sport', e.target.value)
            if (e.target.value !== 'other') updateFilter('sportOther', '')
          }}
          disabled={disabled}
        >
          {SPORTS_OPTIONS.map(v => (
            <option key={v} value={v}>{v ? v : 'All sports'}</option>
          ))}
        </Select>
        {filters.sport === 'other' && (
          <div className="mt-2">
            <Input 
              placeholder="Specify sport…" 
              value={filters.sportOther} 
              onChange={e => updateFilter('sportOther', e.target.value)}
              disabled={disabled}
            />
          </div>
        )}
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-foreground/60 mb-1">Level</div>
        <Select 
          value={filters.level} 
          onChange={e => updateFilter('level', e.target.value)}
          disabled={disabled}
        >
          {LEVEL_OPTIONS.map(v => (
            <option key={v} value={v}>{v ? v : 'All levels'}</option>
          ))}
        </Select>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-foreground/60 mb-1">Org Type</div>
        <Select 
          value={filters.orgType} 
          onChange={e => updateFilter('orgType', e.target.value)}
          disabled={disabled}
        >
          {ORG_TYPE_OPTIONS.map(v => (
            <option key={v} value={v}>{v ? v : 'All org types'}</option>
          ))}
        </Select>
      </div>

      <div className="border-t border-border pt-4">
        <div className="text-xs uppercase tracking-wide text-foreground/60 mb-3">
          Location (Optional)
        </div>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="City, State, or ZIP"
              value={locationInput}
              onChange={e => setLocationInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleLocationApply()
                }
              }}
              disabled={disabled}
            />
            <Button
              variant="secondary"
              onClick={handleLocationApply}
              disabled={disabled}
            >
              Apply
            </Button>
          </div>
          {filters.locationText && (
            <div className="text-xs text-green-600">
              ✓ Location: {filters.locationText}
            </div>
          )}
          <div>
            <div className="text-xs uppercase tracking-wide text-foreground/60 mb-1">Radius</div>
            <Select
              value={filters.radiusMiles}
              onChange={e => updateFilter('radiusMiles', Number(e.target.value))}
              disabled={disabled}
            >
              {RADIUS_OPTIONS.map(miles => (
                <option key={miles} value={miles}>{miles} miles</option>
              ))}
            </Select>
          </div>
          <div className="text-xs text-foreground/60 italic">
            💡 Leave location empty to search nationwide
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button 
          onClick={onSearch} 
          disabled={!canSearch || loading || disabled}
          className="flex-1"
        >
          {loading ? 'Searching…' : 'Search'}
        </Button>
        <Button 
          variant="secondary" 
          onClick={handleClear}
          disabled={disabled}
        >
          Clear
        </Button>
      </div>

      {!canSearch && (
        <div className="text-xs text-amber-600">
          Select at least one filter (sport, level, or org type) to search
        </div>
      )}

      <div className="text-xs text-foreground/60">Results powered by Google</div>
    </div>
  )
}
