import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('private beta legal and trust contract', () => {
	it('publishes dated, non-placeholder privacy and terms pages', () => {
		const privacy = read('src/pages/Privacy.tsx')
		const terms = read('src/pages/Terms.tsx')
		for (const page of [privacy, terms]) {
			expect(page).toContain('August 10, 2026')
			expect(page).toContain('monstermasteryfb@gmail.com')
			expect(page.toLowerCase()).not.toContain('is a placeholder')
			expect(page.toLowerCase()).not.toContain('these terms are placeholders')
		}
		expect(privacy).toContain('not available to children under 13')
		expect(privacy).toContain('Real-athlete reporting')
		expect(terms).toContain('does not automatically send messages')
	})

	it('keeps login tripwire counters out of the accessibility tree', () => {
		const login = read('src/components/auth/LoginSupabase.tsx')
		for (const testId of [
			'login-status',
			'login-submit-captured',
			'login-click-captured',
			'login-native-submit-count',
			'login-handle-submit-count',
			'login-submit-start-count',
			'login-capture-default-prevented',
			'login-capture-event-phase',
			'login-bridge-fired-count',
		]) {
			expect(login).toMatch(new RegExp(`data-testid="${testId}" hidden aria-hidden="true"`))
		}
	})
})
