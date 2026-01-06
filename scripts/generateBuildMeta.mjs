import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function getShortSha() {
	try {
		const out = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
		return out || 'unknown'
	} catch {
		return 'unknown'
	}
}

function getIsoNow() {
	return new Date().toISOString()
}

function upsertEnvVar(lines, key, value) {
	const idx = lines.findIndex(l => l.startsWith(`${key}=`))
	const line = `${key}="${value}"`
	if (idx >= 0) lines[idx] = line
	else lines.push(line)
}

const envLocalPath = resolve(process.cwd(), '.env.local')
const existing = existsSync(envLocalPath) ? readFileSync(envLocalPath, 'utf8') : ''
const lines = existing
	.split(/\r?\n/)
	.filter(Boolean)
	.filter(l => !l.startsWith('VITE_BUILD_ID=') && !l.startsWith('VITE_BUILD_TIME='))

const sha = getShortSha()
const ts = getIsoNow()

upsertEnvVar(lines, 'VITE_BUILD_ID', sha)
upsertEnvVar(lines, 'VITE_BUILD_TIME', ts)

writeFileSync(envLocalPath, lines.join('\n') + '\n', 'utf8')
console.log(`[build-meta] Wrote .env.local with VITE_BUILD_ID=${sha}, VITE_BUILD_TIME=${ts}`)


