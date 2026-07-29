import { describe, expect, it } from 'vitest'
import { isExistingUserLoginEnabled } from '../existingUserLogin'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

describe('isExistingUserLoginEnabled', () => {
	it('default / false preserves disabled login', () => {
		expect(isExistingUserLoginEnabled({ envFlag: undefined })).toBe(false)
		expect(isExistingUserLoginEnabled({ envFlag: '' })).toBe(false)
		expect(isExistingUserLoginEnabled({ envFlag: 'false' })).toBe(false)
		expect(isExistingUserLoginEnabled({ envFlag: 'TRUE' })).toBe(false)
		expect(isExistingUserLoginEnabled({ envFlag: '1' })).toBe(false)
	})

	it('exact "true" enables existing-user login', () => {
		expect(isExistingUserLoginEnabled({ envFlag: 'true' })).toBe(true)
	})
})

describe('login gate source contracts', () => {
	it('login can be enabled while signup stays PUBLIC_MODE-gated', () => {
		const login = fs.readFileSync(path.join(root, 'src/pages/auth/LoginRoute.tsx'), 'utf8')
		const signup = fs.readFileSync(path.join(root, 'src/pages/auth/SignupRoute.tsx'), 'utf8')

		expect(login).toContain('isExistingUserLoginEnabled')
		expect(login).toContain('PUBLIC_MODE && !isExistingUserLoginEnabled()')
		expect(signup).toContain('PUBLIC_MODE')
		expect(signup).toContain("PublicAuthDisabled kind=\"signup\"")
		expect(signup).not.toContain('isExistingUserLoginEnabled')
	})

	it('query parameters do not enable login or canary state', () => {
		const login = fs.readFileSync(path.join(root, 'src/pages/auth/LoginRoute.tsx'), 'utf8')
		const existing = fs.readFileSync(path.join(root, 'src/config/existingUserLogin.ts'), 'utf8')
		const claim = fs.readFileSync(path.join(root, 'src/lib/auth/workflowCanaryClaim.ts'), 'utf8')
		const eligibility = fs.readFileSync(
			path.join(root, 'src/persistence/workflows/cloudEligibility.ts'),
			'utf8'
		)

		expect(login).not.toMatch(/searchParams.*EXISTING_USER|EXISTING_USER.*searchParams/)
		expect(existing).not.toContain('URLSearchParams')
		expect(existing).not.toMatch(/localStorage\./)
		expect(claim).not.toContain('URLSearchParams')
		expect(claim).not.toMatch(/localStorage\./)
		expect(eligibility).not.toContain('URLSearchParams')
		expect(eligibility).not.toMatch(/localStorage\./)
	})

	it('protected /app routes still require a valid session (AuthGate)', () => {
		const router = fs.readFileSync(path.join(root, 'src/routes/RootRouter.tsx'), 'utf8')
		expect(router).toContain('AuthGate')
		expect(router).toContain('!user && !initializing')
		expect(router).toContain('isLocalE2EAuthBypassAllowed')
	})

	it('public signup remains blocked under PUBLIC_MODE', () => {
		const signup = fs.readFileSync(path.join(root, 'src/pages/auth/SignupRoute.tsx'), 'utf8')
		expect(signup).toMatch(/if\s*\(\s*PUBLIC_MODE\s*\)/)
	})
})
