#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Discover domains/aliases for the current Vercel project.
 *
 * Requirements:
 * - Env: VERCEL_TOKEN is required
 * - Project resolution:
 *   - Use VERCEL_PROJECT_ID if set
 *   - Else read .vercel/project.json (projectId or projectName)
 *   - Else read vercel.json "name" as the project name
 *   - If only a name is available, resolve to an id via Vercel API
 *
 * Output:
 * - First line: comma-separated https:// domains (machine-friendly, for DOMAINS env var)
 * - Then: a readable list for humans
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const API_BASE = 'https://api.vercel.com'

async function readJsonIfExists(filePath) {
  try {
    const contents = await fs.readFile(filePath, 'utf8')
    return JSON.parse(contents)
  } catch {
    return null
  }
}

function getTeamQueryParams() {
  const orgId = process.env.VERCEL_ORG_ID || process.env.VERCEL_TEAM_ID || ''
  const params = new URLSearchParams()
  if (orgId && /^team_/.test(orgId)) {
    params.set('teamId', orgId)
  } else if (orgId && /^user_/.test(orgId)) {
    // Some endpoints accept userId for personal scope
    params.set('userId', orgId)
  }
  return params
}

async function fetchJson(url, token) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'get-vercel-domains/1.0',
      Accept: 'application/json'
    }
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP_${res.status} ${res.statusText} ${text ? `- ${text.slice(0, 200)}` : ''}`.trim())
  }
  return res.json()
}

async function resolveProject({ token }) {
  const cwd = process.cwd()
  const vercelProject = await readJsonIfExists(path.join(cwd, '.vercel', 'project.json'))
  const vercelConfig = await readJsonIfExists(path.join(cwd, 'vercel.json'))

  const envProjectId = process.env.VERCEL_PROJECT_ID || process.env.NEXT_PUBLIC_VERCEL_PROJECT_ID // tolerate alt name
  const fromVercelProjectId = vercelProject?.projectId
  const fromVercelProjectName = vercelProject?.projectName
  const fromVercelJsonName = vercelConfig?.name

  // If we already have a project id, try to also determine the name
  if (envProjectId || fromVercelProjectId) {
    const projectId = envProjectId || fromVercelProjectId
    try {
      const params = getTeamQueryParams()
      const url = `${API_BASE}/v9/projects/${encodeURIComponent(projectId)}${params.toString() ? `?${params}` : ''}`
      const proj = await fetchJson(url, token)
      return { id: proj.id || projectId, name: proj.name || fromVercelProjectName || fromVercelJsonName || '' }
    } catch {
      // Fallback without network name resolution
      return { id: projectId, name: fromVercelProjectName || fromVercelJsonName || '' }
    }
  }

  const projectName = fromVercelProjectName || fromVercelJsonName
  if (projectName) {
    const params = getTeamQueryParams()
    const url = `${API_BASE}/v9/projects/${encodeURIComponent(projectName)}${params.toString() ? `?${params}` : ''}`
    const proj = await fetchJson(url, token)
    if (!proj?.id) throw new Error('Could not resolve project id from name')
    return { id: proj.id, name: proj.name || projectName }
  }

  throw new Error('Unable to determine Vercel project. Set VERCEL_PROJECT_ID, or ensure .vercel/project.json exists, or set "name" in vercel.json.')
}

function normalizeHostnameToHttps(host) {
  const h = String(host || '').trim()
  if (!h) return null
  // Strip protocol if present
  const noProto = h.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
  // Skip obvious placeholders
  if (/yourdomain|example\.com/i.test(noProto)) return null
  return `https://${noProto}`
}

async function listProjectDomains({ projectId, token }) {
  const params = getTeamQueryParams()
  const qp = params.toString() ? `?${params}` : ''

  // Project domains (custom domains connected to the project)
  const domainsUrl = `${API_BASE}/v10/projects/${encodeURIComponent(projectId)}/domains${qp}`
  let domainNames = []
  try {
    const domainsRes = await fetchJson(domainsUrl, token)
    const domains = Array.isArray(domainsRes?.domains) ? domainsRes.domains : []
    domainNames = domains.map(d => d?.name).filter(Boolean)
  } catch {
    // Ignore if endpoint not available
  }

  // Aliases (legacy/assignment list). Use v3 aliases with projectId filter.
  const aliasesParams = getTeamQueryParams()
  aliasesParams.set('projectId', projectId)
  const aliasesUrl = `${API_BASE}/v3/aliases?${aliasesParams}`
  let aliasHosts = []
  try {
    const aliasesRes = await fetchJson(aliasesUrl, token)
    const aliases = Array.isArray(aliasesRes?.aliases) ? aliasesRes.aliases : []
    aliasHosts = aliases
      .map(a => a?.alias || a?.domain || a?.name || a?.url || '')
      .filter(Boolean)
  } catch {
    // Ignore if endpoint not available
  }

  return { domainNames, aliasHosts }
}

async function main() {
  const token = process.env.VERCEL_TOKEN
  if (!token) {
    console.error('VERCEL_TOKEN is required. Create a personal access token in Vercel Settings.')
    process.exit(2)
  }

  let project
  try {
    project = await resolveProject({ token })
  } catch (e) {
    console.error(`Project resolution failed: ${e?.message || e}`)
    process.exit(2)
  }

  let domainNames = []
  let aliasHosts = []
  try {
    const listed = await listProjectDomains({ projectId: project.id, token })
    domainNames = listed.domainNames
    aliasHosts = listed.aliasHosts
  } catch (e) {
    console.error(`Failed to list project domains: ${e?.message || e}`)
    process.exit(2)
  }

  // Include default *.vercel.app domain if we know the project name
  const defaults = []
  if (project?.name) {
    defaults.push(`${project.name}.vercel.app`)
  }

  const set = new Set()
  for (const host of [...domainNames, ...aliasHosts, ...defaults]) {
    const url = normalizeHostnameToHttps(host)
    if (url) set.add(url)
  }

  const out = Array.from(set).sort((a, b) => a.localeCompare(b))

  // 1) Machine-friendly first line: CSV
  console.log(out.join(','))

  // 2) Human-readable
  console.log('\nDomains discovered:')
  for (const d of out) console.log(`- ${d}`)
}

// Run
main().catch((e) => {
  console.error('Fatal error in get-vercel-domains:', e?.message || e)
  process.exit(1)
})

