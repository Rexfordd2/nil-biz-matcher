import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(rel: string): string {
	return fs.readFileSync(path.join(root, rel), 'utf8')
}

/** Strip line + block comments for code-only scans. */
function stripComments(src: string): string {
	return src
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const CANARY_RUNTIME_FILES = [
	'src/lib/auth/workflowCanaryClaim.ts',
	'src/lib/auth/mapSupabaseUser.ts',
	'src/persistence/workflows/cloudEligibility.ts',
	'src/hooks/useWorkflowDomainPersistence.ts',
	'src/config/workflowCloudPersistence.ts',
	'src/config/existingUserLogin.ts',
	'src/context/AuthContext.tsx',
	'src/pages/auth/LoginRoute.tsx',
	'src/pages/auth/SignupRoute.tsx',
]

describe('PR-4B2 static safety', () => {
	it('no email / user-ID / athlete-ID canary allowlists in runtime canary files', () => {
		for (const rel of CANARY_RUNTIME_FILES) {
			const code = stripComments(read(rel))
			expect(code).not.toMatch(/CANARY_USER_IDS|CANARY_EMAILS|CANARY_ATHLETE_IDS/)
			expect(code).not.toMatch(/allowlist|whitelist/i)
		}
	})

	it('canary claim is not read from user_metadata', () => {
		const claimCode = stripComments(read('src/lib/auth/workflowCanaryClaim.ts'))
		const mapper = read('src/lib/auth/mapSupabaseUser.ts')
		expect(claimCode).not.toContain('user_metadata')
		expect(mapper).toContain('readWorkflowCloudPersistenceCanary(su.app_metadata)')
		expect(mapper).not.toMatch(/readWorkflowCloudPersistenceCanary\([^)]*user_metadata/)
		expect(stripComments(mapper)).not.toMatch(
			/user_metadata[\s\S]{0,80}workflow_cloud_persistence_canary/
		)
	})

	it('no canary entitlement written to localStorage', () => {
		for (const rel of CANARY_RUNTIME_FILES) {
			const code = stripComments(read(rel))
			expect(code).not.toMatch(/localStorage\.(setItem|set)\([^)]*canary/i)
			expect(code).not.toMatch(/localStorage\.(setItem|set)\([^)]*workflow_cloud/i)
		}
		const claim = stripComments(read('src/lib/auth/workflowCanaryClaim.ts'))
		const eligibility = stripComments(read('src/persistence/workflows/cloudEligibility.ts'))
		expect(claim).not.toContain('localStorage')
		expect(claim).not.toContain('sessionStorage')
		expect(eligibility).not.toContain('localStorage')
		expect(eligibility).not.toContain('sessionStorage')
	})

	it('no metadata update call in canary runtime for canary grant', () => {
		for (const rel of CANARY_RUNTIME_FILES) {
			const code = stripComments(read(rel))
			expect(code).not.toMatch(/updateUserById/)
			expect(code).not.toMatch(/admin\.updateUser/)
			expect(code).not.toMatch(/updateUser\(/)
			expect(code).not.toMatch(/service_role/)
			expect(code).not.toMatch(/SUPABASE_SECRET_KEY/)
			expect(code).not.toMatch(/SUPABASE_DB_PASSWORD/)
		}
	})

	it('canary scripts refuse secrets and Production project refs', () => {
		const script = read('scripts/verify-workflow-canary-local.mjs')
		expect(script).toContain('SUPABASE_DB_PASSWORD must be unset')
		expect(script).toContain('SUPABASE_SECRET_KEY must be unset')
		expect(script).toContain('duuvyyvfqbzozuhzlbek')
		expect(script).toMatch(/Refusing Production project ref/)
		expect(script).not.toMatch(/SUPABASE_SECRET_KEY\s*=\s*['"][^'"]+['"]/)
		expect(script).not.toMatch(/service_role\s*=/)
	})

	it('hook requires eligibility before workflow table requests', () => {
		const hook = read('src/hooks/useWorkflowDomainPersistence.ts')
		expect(hook).toContain('evaluateWorkflowCloudEligibility')
		expect(hook).toContain('getWorkflowCloudPersistenceMode')
		expect(hook).toContain('workflowCloudPersistenceCanary')
		expect(hook).toMatch(/canAttemptCloud/)
		expect(hook).toMatch(/if\s*\(\s*!userId\s*\|\|\s*!canAttemptCloud/)
	})

	it('storage keys remain opps.store / deals.store / events.store', () => {
		const adapters = read('src/hooks/workflowDomainAdapters.ts')
		const hook = read('src/hooks/useWorkflowDomainPersistence.ts')
		expect(adapters).toContain("'opps.store'")
		expect(adapters).toContain("'deals.store'")
		expect(adapters).toContain("'events.store'")
		expect(hook).toContain("'opps.store' | 'deals.store' | 'events.store'")
	})

	it('no committed rollout mode canary/all or login enablement in example defaults', () => {
		const envExample = read('.env.example')
		expect(envExample).toMatch(/VITE_WORKFLOW_CLOUD_PERSISTENCE=false/)
		expect(envExample).toMatch(/VITE_WORKFLOW_CLOUD_PERSISTENCE_MODE=off/)
		expect(envExample).toMatch(/VITE_EXISTING_USER_LOGIN_ENABLED=false/)
		expect(envExample).not.toMatch(/^VITE_WORKFLOW_CLOUD_PERSISTENCE=true$/m)
		expect(envExample).not.toMatch(/^VITE_WORKFLOW_CLOUD_PERSISTENCE_MODE=(canary|all)$/m)
		expect(envExample).not.toMatch(/^VITE_EXISTING_USER_LOGIN_ENABLED=true$/m)
	})

	it('documents NOT ENABLED BY THIS COMMIT for proposed Production canary', () => {
		const doc = read('docs/workflow-cloud-persistence-rollout.md')
		expect(doc).toContain('NOT ENABLED BY THIS COMMIT')
		expect(doc).toContain('workflow_cloud_persistence_canary')
		expect(doc).toContain('RLS')
	})
})
