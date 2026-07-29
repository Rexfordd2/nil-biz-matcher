import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * PR-1 compatibility contract: these localStorage key literals must not change.
 */
const PROTECTED_LITERALS = [
	'athleteLedger:users',
	'athleteLedger:currentUserId',
	'athleteLedger:onboarding:seen:',
	'athleteLedger:recruitingTargets:',
	'al_waitlist_joined',
	'al_waitlist_skipped',
	'al_waitlist_confirmed',
	'athleteProfileDraft:',
	'anon_profile_draft',
	'recruiting_v2.store.v1',
	'recruiting_v2.last_search',
	'deals.store',
	'opps.store',
	'events.store',
	'recruiting.coaches',
	'recruiting.clips',
	'recruiting.outreach'
]

function walk(dir: string, files: string[] = []): string[] {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue
		const full = path.join(dir, entry.name)
		if (entry.isDirectory()) walk(full, files)
		else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) files.push(full)
	}
	return files
}

describe('protected localStorage key literals', () => {
	it('keeps every protected key literal present in source', () => {
		const files = [...walk(path.join(root, 'src')), ...walk(path.join(root, 'api'))]
		const blob = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n')

		for (const key of PROTECTED_LITERALS) {
			expect(blob.includes(key), `Missing protected key literal: ${key}`).toBe(true)
		}
	})
})
