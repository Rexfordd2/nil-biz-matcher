type OrgLike = {
  name: string
  city?: string | null
  region?: string | null
  country?: string | null
  sport?: string | null
}

function encode(q: string): string {
  return encodeURIComponent(q)
}

export function buildSearchLinks(org: OrgLike): {
  googleUrl: string
  linkedInUrl: string
  xUrl: string
  defaultQuery: string
} {
  const parts = [
    org.name,
    org.sport || '',
    org.city || '',
    org.region || '',
    org.country || '',
    'coach recruiting coordinator email phone',
    'site:.edu OR site:.com'
  ].filter(Boolean)
  const query = parts.join(' ')
  const googleUrl = `https://www.google.com/search?q=${encode(query)}`
  const linkedInUrl = `https://www.linkedin.com/search/results/people/?keywords=${encode(`${org.name} ${org.sport || ''} coach recruiting`)}`
  const xUrl = `https://x.com/search?q=${encode(`${org.name} ${org.sport || ''} coach recruiting email`)}&src=typed_query`
  return { googleUrl, linkedInUrl, xUrl, defaultQuery: query }
}


