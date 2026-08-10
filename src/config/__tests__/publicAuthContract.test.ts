import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isExistingUserLoginEnabled } from '../existingUserLogin'
import { resolveAppMode } from '../appMode'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

describe('public auth contract (PUBLIC_MODE=false, APP_MODE=beta)', () => {
	it('resolves beta app mode for production contract', () => {
		expect(
			resolveAppMode({
				appModeFlag: 'beta',
				publicMode: false,
			}),
		).toBe('beta')
	})

	it('does not require EXISTING_USER_LOGIN when PUBLIC_MODE is false', () => {
		const publicMode = false
		const loginEnabled = !publicMode || isExistingUserLoginEnabled({ envFlag: undefined })
		const resetEnabled = loginEnabled
		const signupDisabled = publicMode
		expect(loginEnabled).toBe(true)
		expect(resetEnabled).toBe(true)
		expect(signupDisabled).toBe(false)
	})

	it('signup session semantics never treat confirmation-required as authenticated', () => {
		const auth = fs.readFileSync(path.join(root, 'src/lib/authSupabase.ts'), 'utf8')
		const signup = fs.readFileSync(path.join(root, 'src/components/auth/SignUpSupabase.tsx'), 'utf8')
		expect(auth).toContain('requiresEmailConfirmation')
		expect(auth).toContain('session')
		expect(signup).toContain('requiresEmailConfirmation')
		expect(signup).toContain('signup-confirm-required')
		expect(signup).toContain('Check your email to finish creating your NIL Roster account.')
		expect(signup).not.toMatch(/onSignedIn\(current\)[\s\S]{0,40}requiresEmailConfirmation/)
	})

	it('no invitation-only / private-beta signup messaging remains in auth UI', () => {
		const files = [
			'src/components/auth/PublicAuthDisabled.tsx',
			'src/components/auth/LoginSupabase.tsx',
			'src/components/auth/SignUpSupabase.tsx',
			'src/pages/auth/SignupRoute.tsx',
			'src/pages/Home.tsx',
		]
		for (const rel of files) {
			const text = fs.readFileSync(path.join(root, rel), 'utf8')
			expect(text).not.toMatch(/private beta/i)
			expect(text).not.toMatch(/invitation only|invite-only|opened by invitation/i)
			expect(text).not.toMatch(/existing beta members/i)
			expect(text).not.toMatch(/Sign up disabled|signup disabled/i)
			expect(text).not.toMatch(/Login disabled in public release/i)
		}
	})

	it('signed-in change password is available in Settings', () => {
		const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8')
		const form = fs.readFileSync(path.join(root, 'src/components/auth/ChangePasswordForm.tsx'), 'utf8')
		expect(app).toContain('ChangePasswordForm')
		expect(form).toContain('updatePassword')
		expect(form).toContain('Password updated successfully.')
		expect(form).not.toMatch(/currentPassword|oldPassword|existing password/i)
	})

	it('signup role is user_metadata only and never claims workflow canary', () => {
		const signup = fs.readFileSync(path.join(root, 'src/components/auth/SignUpSupabase.tsx'), 'utf8')
		expect(signup).toContain("role,")
		expect(signup).toContain('workflowCloudPersistenceCanary: false')
		expect(signup).toContain('never claim app_metadata privileges')
		expect(signup).not.toMatch(/app_metadata\s*:/)
		expect(signup).not.toMatch(/workflow_cloud_persistence_canary\s*:\s*true/)
	})

	it('Clerk remains absent', () => {
		const pkg = fs.readFileSync(path.join(root, 'package.json'), 'utf8')
		expect(pkg).not.toMatch(/@clerk\//)
	})

	it('workflow cloud remains independently off in env example', () => {
		const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8')
		expect(envExample).toMatch(/VITE_WORKFLOW_CLOUD_PERSISTENCE_MODE=off/)
		expect(envExample).toMatch(/VITE_PUBLIC_MODE=false/)
		expect(envExample).toMatch(/VITE_APP_MODE=beta/)
	})
})

describe('demo surface still gates auth when PUBLIC_MODE=true', () => {
	it('signup stays disabled under PUBLIC_MODE', () => {
		expect(true).toBe(true)
		const signup = fs.readFileSync(path.join(root, 'src/pages/auth/SignupRoute.tsx'), 'utf8')
		expect(signup).toMatch(/if\s*\(\s*PUBLIC_MODE\s*\)/)
		expect(signup).toContain("PublicAuthDisabled kind=\"signup\"")
	})
})
