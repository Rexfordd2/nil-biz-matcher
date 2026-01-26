export type CsvOrgRow = {
  org_name: string
  sport?: string
  level?: string
  org_type?: string
  country?: string
  region?: string
  city?: string
  website_url?: string
  general_email?: string
  general_phone?: string
  source_url?: string
  contacts_json?: string
}

export type ImportContact = {
  role?: string | null
  name?: string | null
  email?: string | null
  phone?: string | null
  contact_url?: string | null
}

export const REQUIRED_COLUMN = 'org_name'

const COLUMN_ALIASES: Record<string, keyof CsvOrgRow> = {
  org_name: 'org_name',
  name: 'org_name',
  sport: 'sport',
  level: 'level',
  org_type: 'org_type',
  type: 'org_type',
  country: 'country',
  region: 'region',
  state: 'region',
  city: 'city',
  website_url: 'website_url',
  website: 'website_url',
  general_email: 'general_email',
  email: 'general_email',
  general_phone: 'general_phone',
  phone: 'general_phone',
  source_url: 'source_url',
  contacts_json: 'contacts_json'
}

export function normalizeColumns(input: Record<string, string>): CsvOrgRow {
  const out: Partial<CsvOrgRow> = {}
  for (const [k, v] of Object.entries(input)) {
    const key = (k || '').toLowerCase().trim()
    const mapTo = COLUMN_ALIASES[key]
    if (!mapTo) continue
    ;(out as any)[mapTo] = (v ?? '').trim()
  }
  return out as CsvOrgRow
}

export function validateRow(row: CsvOrgRow, index: number): string[] {
  const errs: string[] = []
  if (!row.org_name || row.org_name.trim() === '') {
    errs.push(`Row ${index + 1}: org_name is required`)
  }
  if (row.contacts_json) {
    try {
      const parsed = JSON.parse(row.contacts_json)
      if (!Array.isArray(parsed)) {
        errs.push(`Row ${index + 1}: contacts_json must be an array`)
      } else {
        for (let i = 0; i < parsed.length; i++) {
          const c = parsed[i]
          if (typeof c !== 'object' || c === null) {
            errs.push(`Row ${index + 1}: contacts_json[${i}] must be an object`)
            continue
          }
        }
      }
    } catch (e: any) {
      errs.push(`Row ${index + 1}: contacts_json invalid JSON (${String(e?.message || e)})`)
    }
  }
  return errs
}

export function parseContacts(value: string | undefined): ImportContact[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.map((c: any) => ({
      role: c?.role ?? null,
      name: c?.name ?? null,
      email: c?.email ?? null,
      phone: c?.phone ?? null,
      contact_url: c?.contact_url ?? null
    }))
  } catch {
    return []
  }
}


