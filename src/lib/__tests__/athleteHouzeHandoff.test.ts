import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
	ATHLETE_HOUZE_HOME_URL,
	ATHLETE_HOUZE_NOT_SYNCING_MESSAGE,
	ATHLETE_HOUZE_SESSION_KEY,
	athleteHouzeReturnUrl,
	athleteHouzeSyncMessage,
	captureAthleteHouzeSource,
	hasAthleteHouzeContext,
	isAthleteHouzeReportingAccount,
	isAthleteHouzeSource,
} from '../athleteHouzeHandoff'

function memoryStorage() {
	const m = new Map<string, string>()
	return {
		getItem: (k: string) => m.get(k) ?? null,
		setItem: (k: string, v: string) => {
			m.set(k, v)
		},
		map: m,
	}
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

describe('Athlete Houze handoff', () => {
	it('detects only source=athlete-houze', () => {
		expect(isAthleteHouzeSource('?source=athlete-houze')).toBe(true)
		expect(isAthleteHouzeSource('?foo=1&source=athlete-houze')).toBe(true)
		expect(isAthleteHouzeSource('?source=Athlete-Houze')).toBe(false)
		expect(isAthleteHouzeSource('?source=evil')).toBe(false)
		expect(isAthleteHouzeSource('')).toBe(false)
	})

	it('remembers the handoff for the tab so context survives in-app navigation', () => {
		const s = memoryStorage()
		expect(captureAthleteHouzeSource('', s)).toBe(false)
		expect(captureAthleteHouzeSource('?source=athlete-houze', s)).toBe(true)
		expect(s.map.get(ATHLETE_HOUZE_SESSION_KEY)).toBe('athlete-houze')
		expect(captureAthleteHouzeSource('', s)).toBe(true)
		expect(hasAthleteHouzeContext(s)).toBe(true)
	})

	it('return destination is the fixed Athlete Houze home (no open redirect)', () => {
		expect(ATHLETE_HOUZE_HOME_URL).toBe('https://athletehouze.com')
		expect(athleteHouzeReturnUrl()).toBe('https://athletehouze.com')
		expect(athleteHouzeReturnUrl.length).toBe(0)
		const s = memoryStorage()
		captureAthleteHouzeSource(
			'?source=athlete-houze&returnTo=https://evil.example&return_url=//evil.example&redirect=https://evil.example',
			s
		)
		expect([...s.map.values()].join(' ')).not.toContain('evil')
		expect(athleteHouzeReturnUrl()).toBe('https://athletehouze.com')
	})

	it('banner source never reads a return URL from the query string', () => {
		const banner = fs.readFileSync(path.join(root, 'src/components/AthleteHouzeHandoffBanner.tsx'), 'utf8')
		const lib = fs.readFileSync(path.join(root, 'src/lib/athleteHouzeHandoff.ts'), 'utf8')
		for (const src of [banner, lib]) {
			expect(src).not.toMatch(/get\(['"](returnTo|return_url|redirect|next|url)['"]\)/)
			expect(src).not.toMatch(/window\.location\.(assign|replace)\(/)
		}
		expect(banner).toContain('href={athleteHouzeReturnUrl()}')
	})

	it('states not-syncing for normal accounts and never claims Connected', () => {
		expect(athleteHouzeSyncMessage(false)).toBe(ATHLETE_HOUZE_NOT_SYNCING_MESSAGE)
		expect(ATHLETE_HOUZE_NOT_SYNCING_MESSAGE).toBe(
			'Your work is saved in NIL Roster. Athlete Houze is not automatically syncing this activity yet.'
		)
		for (const msg of [athleteHouzeSyncMessage(false), athleteHouzeSyncMessage(true)]) {
			expect(msg.toLowerCase()).not.toContain('connected')
		}
	})

	it('treats only operator-configured synthetic canary accounts as reporting', () => {
		expect(isAthleteHouzeReportingAccount(null)).toBe(false)
		expect(isAthleteHouzeReportingAccount({ workflow_cloud_persistence_canary: true })).toBe(false)
		expect(
			isAthleteHouzeReportingAccount({
				workflow_cloud_persistence_canary: true,
				synthetic_test_data: true,
				athlete_houze_external_id: 'real-athlete-1',
			})
		).toBe(false)
		expect(
			isAthleteHouzeReportingAccount({
				workflow_cloud_persistence_canary: true,
				synthetic_test_data: true,
				athlete_houze_external_id: 'nil-canary-0001',
			})
		).toBe(true)
	})
})
