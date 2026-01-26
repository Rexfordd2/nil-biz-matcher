#!/usr/bin/env node
/**
 * Verify deployed build by calling /healthz and printing the buildId.
 * Usage:
 *   node scripts/verify-build.mjs https://your-app.vercel.app [expectedBuildId]
 * Or set env:
 *   DEPLOY_URL=https://your-app.vercel.app EXPECTED_BUILD_ID=abc123 node scripts/verify-build.mjs
 */
const urlArg = process.argv[2] || process.env.DEPLOY_URL
const expected = process.argv[3] || process.env.EXPECTED_BUILD_ID

if (!urlArg) {
  console.error('Usage: node scripts/verify-build.mjs <deployUrl> [expectedBuildId]')
  process.exit(2)
}

const base = urlArg.replace(/\/$/, '')
const endpoint = `${base}/healthz`

async function main() {
  try {
    const res = await fetch(endpoint, { headers: { 'Accept': 'application/json' } })
    if (!res.ok) {
      console.error(`Request failed: ${res.status} ${res.statusText}`)
      process.exit(1)
    }
    const data = await res.json()
    const { buildId, timestamp } = data || {}
    console.log(JSON.stringify({ endpoint, buildId, timestamp }, null, 2))
    if (expected) {
      if ((buildId || '').toString() !== expected.toString()) {
        console.error(`Expected buildId ${expected} but received ${buildId}`)
        process.exit(1)
      } else {
        console.log('Build ID matches expected.')
      }
    }
  } catch (err) {
    console.error('Verification error:', err?.message || err)
    process.exit(1)
  }
}

main()

