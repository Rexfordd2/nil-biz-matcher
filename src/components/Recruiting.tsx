import { useEffect, useMemo, useState } from 'react'
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

type Org = {
  id: string
  name: string
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
}

type OrgContact = {
  id: string
  org_id: string
  role: string | null
  name: string | null
  email: string | null
  phone: string | null
  contact_url: string | null
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
const ORG_TYPE_OPTIONS = ['', 'school', 'team', 'club', 'league', 'association', 'other']

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
  const [tab, setTab] = useState<'Directory' | 'My Targets'>('Directory')

  if (!supabaseEnvConfigured || !supabase) {
    return (
      <Card title="Recruiting">
        <p className="text-foreground/80">
          Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant={tab === 'Directory' ? 'primary' : 'secondary'} onClick={() => setTab('Directory')}>Directory</Button>
        <Button variant={tab === 'My Targets' ? 'primary' : 'secondary'} onClick={() => setTab('My Targets')}>My Targets</Button>
      </div>

      {tab === 'Directory' && <DirectoryPanel userId={user?.id ?? null} isMobile={isMobile} />}
      {tab === 'My Targets' && <TargetsPanel userId={user?.id ?? null} />}
    </div>
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

  async function loadOrgs() {
    if (!canQuery) return
    setLoading(true)
    try {
      let query = supabase!.from('orgs').select('*').order('created_at', { ascending: false })
      if (q) {
        query = query.ilike('name', `%${q}%`)
      }
      if (sport) query = query.eq('sport', sport)
      if (level) query = query.eq('level', level)
      if (orgType) query = query.eq('org_type', orgType)
      if (country) query = query.eq('country', country)
      if (region) query = query.eq('region', region)
      const { data, error } = await query
      if (error) throw error
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

  async function loadContacts(orgId: string) {
    const { data, error } = await supabase!.from('org_contacts').select('*').eq('org_id', orgId).order('created_at', { ascending: true })
    if (error) throw error
		setContacts(Array.isArray(data) ? (data as OrgContact[]) : [])
  }

  async function onSelectOrg(o: Org) {
    setSelected(o)
    await loadContacts(o.id)
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
        { org_id: orgIds[0], role: 'Director', name: 'Alex Morgan', email: 'alex@metrofc.com', phone: '+1 310-555-0199', contact_url: 'https://linkedin.com/in/alexm' },
        { org_id: orgIds[1], role: 'Head Coach', name: 'Jamie Lee', email: 'coach.lee@psu.edu', phone: '+1 206-555-0177', contact_url: 'https://psu.example.edu/athletics/staff/lee' },
        { org_id: orgIds[2], role: 'GM', name: 'Jordan Smith', email: 'jsmith@wolves.ca', phone: '+1 604-555-0120', contact_url: null }
      ]
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { error: cErr } = await supabase!.from('org_contacts').insert(contactsToInsert)
      if (cErr) throw cErr
      await loadOrgs()
    } finally {
      setDevBusy(false)
    }
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
      <div className="grid grid-cols-1 md:grid-cols-[1fr,360px] gap-6">
        <div className="space-y-3">
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
                  <div className="overflow-auto border border-border rounded-md">
                    <table className="min-w-full text-sm">
                      <thead className="bg-surface">
                        <tr>
                          {['org_name','sport','level','org_type','country','region','city','website_url','general_email','general_phone','source_url','contacts_json'].map(h => (
                            <th key={h} className="px-2 py-2 text-left font-medium border-b border-border">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.slice(0, 10).map((r, i) => (
                          <tr key={`row-${i}`} className="border-b border-border">
                            <td className="px-2 py-2">{r.org_name}</td>
                            <td className="px-2 py-2">{r.sport}</td>
                            <td className="px-2 py-2">{r.level}</td>
                            <td className="px-2 py-2">{r.org_type}</td>
                            <td className="px-2 py-2">{r.country}</td>
                            <td className="px-2 py-2">{r.region}</td>
                            <td className="px-2 py-2">{r.city}</td>
                            <td className="px-2 py-2 break-all">{r.website_url}</td>
                            <td className="px-2 py-2 break-all">{r.general_email}</td>
                            <td className="px-2 py-2 break-all">{r.general_phone}</td>
                            <td className="px-2 py-2 break-all">{r.source_url}</td>
                            <td className="px-2 py-2"><span className="text-foreground/60">{r.contacts_json ? 'yes' : ''}</span></td>
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
    const { error } = await supabase!.from('user_targets').update(patch).eq('id', id)
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


