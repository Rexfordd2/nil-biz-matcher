import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isExistingUserLoginEnabled } from '../existingUserLogin'
import { resolveAppMode } from '../appMode'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

type MatrixRow = {
	name: string
	publicMode: boolean
	appModeFlag?: string
	existingUserLogin?: string
	expectLoginEnabled: boolean
	expectSignupDisabled: boolean
	expectAppRedirectsToDemo: boolean
}

const matrix: MatrixRow[] = [
	{
		name: 'public demo, login off',
		publicMode: true,
		appModeFlag: 'demo',
		existingUserLogin: 'false',
		expectLoginEnabled: false,
		expectSignupDisabled: true,
		expectAppRedirectsToDemo: true,
	},
	{
		name: 'closed beta, login on',
		publicMode: true,
		appModeFlag: 'beta',
		existingUserLogin: 'true',
		expectLoginEnabled: true,
		expectSignupDisabled: true,
		expectAppRedirectsToDemo: false,
	},
	{
		name: 'closed beta, login off',
		publicMode: true,
		appModeFlag: 'beta',
		existingUserLogin: 'false',
		expectLoginEnabled: false,
		expectSignupDisabled: true,
		expectAppRedirectsToDemo: false,
	},
	{
		name: 'absent app mode + public mode defaults to demo',
		publicMode: true,
		appModeFlag: undefined,
		existingUserLogin: undefined,
		expectLoginEnabled: false,
		expectSignupDisabled: true,
		expectAppRedirectsToDemo: true,
	},
]

describe('closed beta auth contract matrix', () => {
	for (const row of matrix) {
		it(row.name, () => {
			const appMode = resolveAppMode({
				appModeFlag: row.appModeFlag,
				publicMode: row.publicMode,
			})
			const loginEnabled =
				!row.publicMode || isExistingUserLoginEnabled({ envFlag: row.existingUserLogin })
			const signupDisabled = row.publicMode
			const appRedirectsToDemo = appMode === 'demo'

			expect(loginEnabled).toBe(row.expectLoginEnabled)
			expect(signupDisabled).toBe(row.expectSignupDisabled)
			expect(appRedirectsToDemo).toBe(row.expectAppRedirectsToDemo)
		})
	}

	it('workflow cloud off does not affect login enablement', () => {
		expect(isExistingUserLoginEnabled({ envFlag: 'true' })).toBe(true)
		const eligibility = fs.readFileSync(
			path.join(root, 'src/persistence/workflows/cloudEligibility.ts'),
			'utf8',
		)
		expect(eligibility).not.toContain('isExistingUserLoginEnabled')
	})

	it('no query parameter, localStorage, or Clerk path enables auth', () => {
		const login = fs.readFileSync(path.join(root, 'src/pages/auth/LoginRoute.tsx'), 'utf8')
		const signup = fs.readFileSync(path.join(root, 'src/pages/auth/SignupRoute.tsx'), 'utf8')
		const existing = fs.readFileSync(path.join(root, 'src/config/existingUserLogin.ts'), 'utf8')
		const pkg = fs.readFileSync(path.join(root, 'package.json'), 'utf8')

		expect(login).not.toMatch(/searchParams.*EXISTING_USER|EXISTING_USER.*searchParams/)
		expect(signup).not.toMatch(/searchParams.*signup|localStorage.*signup/i)
		expect(existing).not.toContain('URLSearchParams')
		expect(existing).not.toMatch(/localStorage\./)
		expect(pkg).not.toMatch(/@clerk\//)
		expect(login).not.toMatch(/ClerkProvider|@clerk/)
		expect(signup).not.toMatch(/ClerkProvider|@clerk/)
	})

	it('E2E bypass remains local-only', () => {
		const e2e = fs.readFileSync(path.join(root, 'src/config/e2e.ts'), 'utf8')
		expect(e2e).toContain('isLocalE2EAuthBypassAllowed')
		expect(e2e).toMatch(/localhost|127\.0\.0\.1/)
	})

	it('beta login UX copy does not claim public demo login is disabled', () => {
		const login = fs.readFileSync(path.join(root, 'src/components/auth/LoginSupabase.tsx'), 'utf8')
		const disabled = fs.readFileSync(
			path.join(root, 'src/components/auth/PublicAuthDisabled.tsx'),
			'utf8',
		)
		expect(login).toContain('Log in to NIL Roster')
		expect(login).toContain('Existing beta members can sign in below.')
		expect(disabled).toContain('New accounts are opened by invitation.')
		expect(disabled).not.toContain('Login disabled in public release')
	})
})
