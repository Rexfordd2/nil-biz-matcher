export type CseResult = {
  title: string
  snippet: string
  link: string
}

export function isGoogleCseConfigured(): boolean {
  const key = import.meta.env.VITE_GOOGLE_CSE_API_KEY
  const cx = import.meta.env.VITE_GOOGLE_CSE_CX
  return Boolean(key && cx)
}

export async function searchContacts(query: string): Promise<CseResult[]> {
  const key = import.meta.env.VITE_GOOGLE_CSE_API_KEY
  const cx = import.meta.env.VITE_GOOGLE_CSE_CX
  if (!key || !cx) {
    throw new Error('Google CSE not configured')
  }
  const url = new URL('https://www.googleapis.com/customsearch/v1')
  url.searchParams.set('key', String(key))
  url.searchParams.set('cx', String(cx))
  url.searchParams.set('q', String(query))

  try {
    const res = await fetch(url.toString())
    if (!res.ok) {
      throw new Error(`CSE HTTP ${res.status}`)
    }
    const data = await res.json() as any
    const items: any[] = Array.isArray(data?.items) ? data.items : []
    return items.map((it) => ({
      title: String(it?.title ?? ''),
      snippet: String(it?.snippet ?? ''),
      link: String(it?.link ?? '')
    }))
  } catch (e: any) {
    // Degrade gracefully
    return []
  }
}


