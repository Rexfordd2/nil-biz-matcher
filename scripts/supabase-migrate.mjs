#!/usr/bin/env node
/**
 * Supabase Migration Automation
 * 
 * Applies supabase/migrations/20260128_update_waitlist_schema.sql to the linked project
 * via Supabase CLI when available, or prints copy-pastable Dashboard instructions.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const MIGRATION_FILE = 'supabase/migrations/20260128_update_waitlist_schema.sql'
const MIGRATION_VERSION = '20260128'

/**
 * Run a command synchronously and return { exitCode, stdout, stderr }
 */
function runSync(command, args = [], options = {}) {
	const result = spawnSync(command, args, {
		shell: true,
		encoding: 'utf-8',
		...options
	})
	
	return {
		exitCode: result.status !== null ? result.status : 1,
		stdout: result.stdout || '',
		stderr: result.stderr || ''
	}
}

/**
 * Check if Supabase CLI is installed
 */
function checkSupabaseCli() {
	console.log('[CHECK] Supabase CLI installation...')
	const result = runSync('supabase', ['--version'])
	
	if (result.exitCode !== 0) {
		console.error('❌ Supabase CLI not found')
		console.error('')
		console.error('Install Supabase CLI:')
		console.error('  npm i -g supabase')
		console.error('')
		console.error('Or use scoop on Windows:')
		console.error('  scoop bucket add supabase https://github.com/supabase/scoop-bucket.git')
		console.error('  scoop install supabase')
		return false
	}
	
	const version = result.stdout.trim()
	console.log(`✅ Supabase CLI installed: ${version}`)
	return true
}

/**
 * Check authentication (SUPABASE_ACCESS_TOKEN or supabase login)
 */
function checkAuth() {
	console.log('\n[CHECK] Supabase authentication...')
	
	// Check for access token env var
	if (process.env.SUPABASE_ACCESS_TOKEN) {
		console.log('✅ SUPABASE_ACCESS_TOKEN is set')
		return true
	}
	
	// Check if logged in via supabase login
	const result = runSync('supabase', ['projects', 'list'])
	
	if (result.exitCode !== 0) {
		console.error('❌ Not authenticated with Supabase')
		console.error('')
		console.error('Authenticate with Supabase CLI:')
		console.error('  supabase login')
		console.error('')
		console.error('Or set SUPABASE_ACCESS_TOKEN environment variable:')
		console.error('  $env:SUPABASE_ACCESS_TOKEN = "sbp_..."')
		console.error('')
		console.error('Get your access token from: https://supabase.com/dashboard/account/tokens')
		return false
	}
	
	console.log('✅ Authenticated with Supabase')
	return true
}

/**
 * Check if project is linked
 */
function checkLinked() {
	console.log('\n[CHECK] Project linking...')
	
	// Method 1: Check for .vercel/project.json (from the vercel-env-setup script pattern)
	// But for Supabase it's likely a different path - let's just try the command
	
	// Run a simple linked command to see if it works
	const result = runSync('supabase', ['migration', 'list', '--linked'])
	
	if (result.exitCode !== 0 || result.stderr.includes('not linked') || result.stderr.includes('No project linked')) {
		console.error('❌ Project not linked')
		console.error('')
		console.error('Link your project:')
		console.error('  supabase link --project-ref <your-project-ref>')
		console.error('')
		console.error('Find your project ref at: https://supabase.com/dashboard/project/_/settings/general')
		return false
	}
	
	console.log('✅ Project is linked')
	return true
}

/**
 * Check if migration file exists
 */
function checkMigrationFile() {
	const migrationPath = resolve(process.cwd(), MIGRATION_FILE)
	
	if (!existsSync(migrationPath)) {
		console.error(`❌ Migration file not found: ${MIGRATION_FILE}`)
		return false
	}
	
	console.log(`✅ Migration file exists: ${MIGRATION_FILE}`)
	return true
}

/**
 * Apply migrations using supabase db push
 */
function applyMigrations() {
	console.log('\n[APPLY] Running supabase db push --linked...')
	
	const result = runSync('supabase', ['db', 'push', '--linked'], {
		stdio: 'inherit' // Show output directly
	})
	
	if (result.exitCode !== 0) {
		console.error('\n❌ Migration failed')
		return false
	}
	
	console.log('\n✅ Migration command completed')
	return true
}

/**
 * Verify migration was applied
 */
function verifyMigration() {
	console.log('\n[VERIFY] Checking migration history...')
	
	const result = runSync('supabase', ['migration', 'list', '--linked'])
	
	if (result.exitCode !== 0) {
		console.error('❌ Could not verify migration history')
		return false
	}
	
	// Check if the migration version appears in the output
	if (result.stdout.includes(MIGRATION_VERSION)) {
		console.log(`✅ Migration ${MIGRATION_VERSION} is applied`)
		return true
	} else {
		console.warn(`⚠️  Migration ${MIGRATION_VERSION} not found in remote history`)
		console.warn('   This could mean:')
		console.warn('   - Migration was already applied previously')
		console.warn('   - Migration is pending and needs to be pushed')
		return false
	}
}

/**
 * Print fallback instructions for Dashboard SQL Editor
 */
function printFallbackInstructions() {
	console.log('\n=== Fallback: Apply Migration Manually ===\n')
	console.log('Copy the migration SQL to clipboard with:')
	console.log('')
	console.log(`  Get-Content -Raw '${MIGRATION_FILE}' | Set-Clipboard`)
	console.log('')
	console.log('Then:')
	console.log('  1. Open https://supabase.com/dashboard')
	console.log('  2. Select your project')
	console.log('  3. Navigate to SQL Editor')
	console.log('  4. Click "New Query"')
	console.log('  5. Paste the SQL (Ctrl+V)')
	console.log('  6. Click "Run" or press Ctrl+Enter')
	console.log('')
	console.log('The migration is idempotent and safe to run multiple times.')
	console.log('')
}

/**
 * Main function
 */
async function main() {
	console.log('=== Supabase Migration Automation ===\n')
	console.log(`Target migration: ${MIGRATION_FILE}\n`)
	
	// Step 1: Check migration file exists
	if (!checkMigrationFile()) {
		process.exit(1)
	}
	
	// Step 2: Check CLI
	const cliInstalled = checkSupabaseCli()
	if (!cliInstalled) {
		printFallbackInstructions()
		process.exit(1)
	}
	
	// Step 3: Check authentication
	const authenticated = checkAuth()
	if (!authenticated) {
		printFallbackInstructions()
		process.exit(1)
	}
	
	// Step 4: Check project link
	const linked = checkLinked()
	if (!linked) {
		printFallbackInstructions()
		process.exit(1)
	}
	
	// Step 5: Apply migrations
	const applied = applyMigrations()
	if (!applied) {
		printFallbackInstructions()
		process.exit(1)
	}
	
	// Step 6: Verify migration
	const verified = verifyMigration()
	
	if (verified) {
		console.log('\n=== Migration Complete ===')
		console.log(`✅ ${MIGRATION_FILE} has been applied to your linked Supabase project`)
		console.log('')
		process.exit(0)
	} else {
		console.log('\n=== Migration Status Unclear ===')
		console.log('Migration command succeeded but verification inconclusive.')
		console.log('Check the Supabase Dashboard to confirm the waitlist table exists.')
		console.log('')
		process.exit(0)
	}
}

main().catch((err) => {
	console.error('\n❌ Unexpected error:', err.message)
	console.error(err.stack)
	printFallbackInstructions()
	process.exit(1)
})
