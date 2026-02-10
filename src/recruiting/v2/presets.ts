/**
 * Search presets for RecruitingV2
 * Easy to edit and extend
 */

export type SearchPreset = {
  id: string
  label: string
  sport: string
  sportOther?: string
  level: string
  orgType: string
}

export const SEARCH_PRESETS: SearchPreset[] = [
  {
    id: 'hs-soccer',
    label: '⚽ HS Soccer',
    sport: 'soccer',
    level: 'hs',
    orgType: 'school'
  },
  {
    id: 'college-basketball',
    label: '🏀 College Basketball',
    sport: 'basketball',
    level: 'college',
    orgType: 'school'
  },
  {
    id: 'club-soccer',
    label: '⚽ Club Soccer',
    sport: 'soccer',
    level: 'club',
    orgType: 'club'
  },
  {
    id: 'college-football',
    label: '🏈 College Football',
    sport: 'football',
    level: 'college',
    orgType: 'school'
  },
  {
    id: 'pro-baseball',
    label: '⚾ Pro Baseball',
    sport: 'baseball',
    level: 'pro',
    orgType: 'club'
  },
  {
    id: 'hs-volleyball',
    label: '🏐 HS Volleyball',
    sport: 'volleyball',
    level: 'hs',
    orgType: 'school'
  },
  {
    id: 'college-lacrosse',
    label: '🥍 College Lacrosse',
    sport: 'lacrosse',
    level: 'college',
    orgType: 'school'
  },
  {
    id: 'youth-hockey',
    label: '🏒 Youth Hockey',
    sport: 'ice hockey',
    level: 'youth',
    orgType: 'club'
  }
]
