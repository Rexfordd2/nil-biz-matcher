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
  // Deep-link queries per product requirements
  const googleQuery = `${org.name} coach recruiting coordinator email phone`
  const linkedInKeywords = `${org.name} coach`
  const xQuery = `${org.name} coach email`

  const googleUrl = `https://www.google.com/search?q=${encode(googleQuery)}`
  const linkedInUrl = `https://www.linkedin.com/search/results/people/?keywords=${encode(linkedInKeywords)}`
  const xUrl = `https://x.com/search?q=${encode(xQuery)}&src=typed_query`

  // Use Google query as the default in-app search string if needed
  return { googleUrl, linkedInUrl, xUrl, defaultQuery: googleQuery }
}


