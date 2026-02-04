#!/usr/bin/env node
/**
 * Athlete Profile Diagnostic Script
 * 
 * Tests the complete athlete profile persistence flow:
 * 1. Authenticates with Supabase using test credentials
 * 2. Reads current user's profile from athlete_profiles
 * 3. Upserts a test profile
 * 4. Re-reads and verifies the update
 * 
 * Usage:
 *   node scripts/diagnose-athlete-profile.mjs [--email=...] [--password=...] [--prompt]
 * 
 * Credentials can be provided via:
 *   - CLI args: --email=test@example.com --password=your-password
 *   - Environment variables: SUPABASE_TEST_EMAIL, SUPABASE_TEST_PASSWORD
 *   - Interactive prompts: --prompt (will ask for credentials if not provided)
 * 
 * Required environment variables:
 *   VITE_SUPABASE_URL or SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY
 * 
 * Exit codes:
 *   0 - All tests passed
 *   1 - One or more tests failed
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as readline from 'readline'

// Load environment variables
dotenv.config()

// Parse CLI arguments
function parseArgs() {
	const args = process.argv.slice(2)
	const parsed = {}
	
	for (const arg of args) {
		if (arg.startsWith('--email=')) {
			parsed.email = arg.substring('--email='.length)
		} else if (arg.startsWith('--password=')) {
			parsed.password = arg.substring('--password='.length)
		} else if (arg === '--prompt') {
			parsed.prompt = true
		}
	}
	
	return parsed
}

const cliArgs = parseArgs()

// Interactive prompt helpers
function promptText(question) {
	return new Promise((resolve) => {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout
		})
		
		rl.question(question, (answer) => {
			rl.close()
			resolve(answer.trim())
		})
	})
}

function promptPassword(question) {
	return new Promise((resolve) => {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout
		})
		
		// Hide input by muting stdout
		const stdin = process.stdin
		let password = ''
		
		process.stdout.write(question)
		
		stdin.setRawMode(true)
		stdin.resume()
		stdin.setEncoding('utf8')
		
		const onData = (char) => {
			const charCode = char.charCodeAt(0)
			
			if (charCode === 13) { // Enter key
				stdin.setRawMode(false)
				stdin.pause()
				stdin.removeListener('data', onData)
				process.stdout.write('\n')
				rl.close()
				resolve(password)
			} else if (charCode === 3) { // Ctrl+C
				stdin.setRawMode(false)
				process.stdout.write('\n')
				process.exit(1)
			} else if (charCode === 127) { // Backspace
				if (password.length > 0) {
					password = password.slice(0, -1)
				}
			} else if (charCode >= 32 && charCode <= 126) { // Printable characters
				password += char
			}
		}
		
		stdin.on('data', onData)
	})
}

// ANSI color codes for output
const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	cyan: '\x1b[36m',
	gray: '\x1b[90m'
}

function log(message, color = 'reset') {
	console.log(`${colors[color]}${message}${colors.reset}`)
}

function logStep(step, message) {
	log(`\n[Step ${step}] ${message}`, 'bright')
}

function logSuccess(message) {
	log(`✓ ${message}`, 'green')
}

function logError(message) {
	log(`✗ ${message}`, 'red')
}

function logWarning(message) {
	log(`⚠ ${message}`, 'yellow')
}

function logInfo(message) {
	log(`  ${message}`, 'cyan')
}

function logDetail(message) {
	log(`  ${message}`, 'gray')
}

function formatError(error) {
	const details = {
		code: error?.code || 'N/A',
		status: error?.status || error?.statusCode || 'N/A',
		message: error?.message || String(error),
		details: error?.details || 'N/A',
		hint: error?.hint || 'N/A'
	}
	return JSON.stringify(details, null, 2)
}

async function main() {
	log('\n' + '='.repeat(70), 'bright')
	log('Athlete Profile Diagnostic Tool', 'bright')
	log('='.repeat(70) + '\n', 'bright')

	let exitCode = 0
	let supabase = null
	let userId = null

	try {
		// ================================================================
		// Step 0: Validate environment variables
		// ================================================================
		logStep(0, 'Validating environment variables')

		const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
		const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
		
		// Get credentials from CLI args, env vars, or interactive prompts
		let TEST_EMAIL = cliArgs.email || process.env.SUPABASE_TEST_EMAIL
		let TEST_PASSWORD = cliArgs.password || process.env.SUPABASE_TEST_PASSWORD

		if (!SUPABASE_URL) {
			logError('Missing SUPABASE_URL or VITE_SUPABASE_URL')
			logInfo('Add to .env: VITE_SUPABASE_URL=https://[project-ref].supabase.co')
			exitCode = 1
		} else {
			logSuccess(`SUPABASE_URL found: ${SUPABASE_URL}`)
		}

		if (!SUPABASE_ANON_KEY) {
			logError('Missing SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY')
			logInfo('Add to .env: VITE_SUPABASE_ANON_KEY=eyJ...')
			exitCode = 1
		} else {
			logSuccess(`SUPABASE_ANON_KEY found (length: ${SUPABASE_ANON_KEY.length})`)
		}

		// If credentials are missing and --prompt flag is set (or no credentials at all), prompt interactively
		if ((!TEST_EMAIL || !TEST_PASSWORD) && (cliArgs.prompt || (!cliArgs.email && !cliArgs.password))) {
			log('')
			logInfo('Credentials not provided. Enter them now:')
			log('')
			
			if (!TEST_EMAIL) {
				TEST_EMAIL = await promptText('Email: ')
			}
			
			if (!TEST_PASSWORD) {
				TEST_PASSWORD = await promptPassword('Password: ')
			}
			
			log('')
		}

		if (!TEST_EMAIL || !TEST_PASSWORD) {
			logError('Missing test credentials')
			logInfo('Provide credentials via CLI args, environment variables, or interactive prompts:')
			log('')
			logInfo('Option 1 - Interactive prompts:')
			logDetail('  node scripts/diagnose-athlete-profile.mjs --prompt')
			logDetail('  npm run diag:profile:prompt')
			log('')
			logInfo('Option 2 - CLI arguments:')
			logDetail('  node scripts/diagnose-athlete-profile.mjs --email=test@example.com --password=your-password')
			log('')
			logInfo('Option 3 - Environment variables:')
			logDetail('  Add to .env:')
			logDetail('    SUPABASE_TEST_EMAIL=test@example.com')
			logDetail('    SUPABASE_TEST_PASSWORD=your-test-password')
			logDetail('  Then run: npm run diag:profile')
			log('')
			exitCode = 1
		} else {
			const source = cliArgs.email ? 'CLI args' : (process.env.SUPABASE_TEST_EMAIL ? 'environment' : 'interactive prompt')
			logSuccess(`Credentials obtained (${source})`)
			logInfo(`Email: ${TEST_EMAIL}`)
			logSuccess('Password provided')
		}

		if (exitCode !== 0) {
			log('\n' + '='.repeat(70), 'red')
			logError('Environment validation failed. Cannot proceed.')
			log('='.repeat(70) + '\n', 'red')
			process.exit(exitCode)
		}

		// ================================================================
		// Step 1: Initialize Supabase client
		// ================================================================
		logStep(1, 'Initializing Supabase client')

		try {
			supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
			logSuccess('Supabase client initialized')
		} catch (error) {
			logError('Failed to initialize Supabase client')
			logInfo('Error details:')
			logDetail(formatError(error))
			exitCode = 1
			throw error
		}

		// ================================================================
		// Step 2: Authenticate with test credentials
		// ================================================================
		logStep(2, 'Authenticating with test credentials')

		try {
			const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
				email: TEST_EMAIL,
				password: TEST_PASSWORD
			})

			if (authError) {
				throw authError
			}

			if (!authData?.user) {
				throw new Error('Authentication succeeded but no user returned')
			}

			userId = authData.user.id
			logSuccess(`Authenticated as: ${authData.user.email}`)
			logInfo(`User ID: ${userId}`)
			logDetail(`Session valid: ${authData.session ? 'Yes' : 'No'}`)
		} catch (error) {
			logError('Authentication failed')
			logInfo('Error details:')
			logDetail(formatError(error))
			logWarning('Possible issues:')
			logWarning('  - User does not exist (create account first)')
			logWarning('  - Wrong password')
			logWarning('  - Email confirmation required')
			logWarning('  - Supabase auth disabled')
			exitCode = 1
			throw error
		}

		// ================================================================
		// Step 3: Read existing profile (if any)
		// ================================================================
		logStep(3, 'Reading existing profile from athlete_profiles table')

		let existingProfile = null
		try {
			const { data, error } = await supabase
				.from('athlete_profiles')
				.select('user_id, profile, created_at, updated_at')
				.eq('user_id', userId)
				.maybeSingle()

			if (error) {
				throw error
			}

			if (data) {
				existingProfile = data
				logSuccess('Profile found in database')
				logInfo(`Created: ${data.created_at}`)
				logInfo(`Updated: ${data.updated_at}`)
				logDetail(`Profile keys: ${data.profile ? Object.keys(data.profile).join(', ') : '(empty)'}`)
			} else {
				logWarning('No existing profile found (this is OK for new users)')
			}
		} catch (error) {
			logError('Failed to read profile')
			logInfo('Error details:')
			logDetail(formatError(error))
			logWarning('Possible issues:')
			logWarning('  - Table "athlete_profiles" does not exist')
			logWarning('  - RLS policy blocks SELECT')
			logWarning('  - user_id column missing or wrong type')
			logWarning('Run: node verify-profile-persistence.mjs')
			exitCode = 1
			throw error
		}

		// ================================================================
		// Step 4: Upsert test profile
		// ================================================================
		logStep(4, 'Upserting test profile')

		const testTimestamp = Date.now()
		const testProfile = {
			test: true,
			ts: testTimestamp,
			testRun: new Date().toISOString(),
			diagnosticScript: true
		}

		try {
			// Build payload with explicit user_id (uuid)
			const payload = {
				user_id: userId, // uuid type, must match auth.uid()
				profile: testProfile // jsonb type
			}
			
			logInfo('Upserting payload:')
			logDetail(`  user_id: ${userId}`)
			logDetail(`  profile keys: ${Object.keys(testProfile).join(', ')}`)
			
			// Upsert with explicit conflict target (user_id is primary key)
			const { error: upsertError } = await supabase
				.from('athlete_profiles')
				.upsert(payload, { onConflict: 'user_id' })

			if (upsertError) {
				throw upsertError
			}

			logSuccess('Test profile upserted successfully')
			
			// Immediately verify the row exists
			logInfo('Verifying row exists post-upsert...')
			const { data: verifyData, error: verifyError } = await supabase
				.from('athlete_profiles')
				.select('user_id, updated_at')
				.eq('user_id', userId)
				.maybeSingle()
			
			if (verifyError) {
				logWarning('Upsert succeeded but verify failed')
				logDetail(`Verify error: ${JSON.stringify(verifyError)}`)
				throw new Error('Row verification failed after upsert')
			}
			
			if (!verifyData) {
				logError('Row not found after upsert!')
				throw new Error('Upsert reported success but row does not exist')
			}
			
			logSuccess('Row verified: exists in database')
			logDetail(`  user_id: ${verifyData.user_id}`)
			logDetail(`  updated_at: ${verifyData.updated_at}`)
		} catch (error) {
			logError('Failed to upsert profile')
			logInfo('Error details:')
			logDetail(formatError(error))
			logWarning('Possible issues:')
			logWarning('  - RLS policy blocks INSERT or UPDATE')
			logWarning('  - user_id does not match auth.uid()')
			logWarning('  - Foreign key constraint fails (user not in auth.users)')
			logWarning('  - profile column is not jsonb type')
			logWarning('Run: node scripts/diagnose-athlete-profile.mjs')
			logInfo('SQL to fix (run in Supabase SQL Editor):')
			logDetail('  See: SUPABASE_FIX_ATHLETE_PROFILES.sql')
			exitCode = 1
			throw error
		}

		// ================================================================
		// Step 5: Re-read profile to verify update
		// ================================================================
		logStep(5, 'Re-reading profile to verify update')

		try {
			const { data, error } = await supabase
				.from('athlete_profiles')
				.select('user_id, profile, created_at, updated_at')
				.eq('user_id', userId)
				.single()

			if (error) {
				throw error
			}

			if (!data) {
				throw new Error('Profile not found after upsert')
			}

			logSuccess('Profile successfully retrieved')
			logInfo(`User ID: ${data.user_id}`)
			logInfo(`Created: ${data.created_at}`)
			logInfo(`Updated: ${data.updated_at}`)
			logDetail(`Profile content:`)
			logDetail(JSON.stringify(data.profile, null, 2))

			// Verify the test data is present
			if (data.profile?.test === true && data.profile?.ts === testTimestamp) {
				logSuccess('Test data verified in profile')
			} else {
				logError('Test data not found in profile')
				logWarning('Profile was saved but content does not match')
				exitCode = 1
			}
		} catch (error) {
			logError('Failed to re-read profile')
			logInfo('Error details:')
			logDetail(formatError(error))
			logWarning('Possible issues:')
			logWarning('  - Upsert succeeded but SELECT fails (RLS issue)')
			logWarning('  - Profile was not actually saved')
			exitCode = 1
			throw error
		}

		// ================================================================
		// Step 6: Clean up (optional - restore original profile)
		// ================================================================
		if (existingProfile && existingProfile.profile) {
			logStep(6, 'Restoring original profile (cleanup)')

			try {
				const { error } = await supabase
					.from('athlete_profiles')
					.update({ profile: existingProfile.profile })
					.eq('user_id', userId)

				if (error) {
					throw error
				}

				logSuccess('Original profile restored')
			} catch (error) {
				logWarning('Failed to restore original profile (test data remains)')
				logDetail(formatError(error))
				// Don't fail the entire test for cleanup issues
			}
		} else {
			logInfo('\n[Step 6] Skipping cleanup (no original profile to restore)')
		}

		// ================================================================
		// Success summary
		// ================================================================
		log('\n' + '='.repeat(70), 'green')
		log('✓ All diagnostics passed!', 'green')
		log('='.repeat(70), 'green')
		logInfo('Athlete profile persistence is working correctly.')
		logInfo('The table exists, RLS policies are correct, and CRUD operations succeed.')
		log('')

	} catch (error) {
		// Error already logged in individual steps
		log('\n' + '='.repeat(70), 'red')
		log('✗ Diagnostic failed', 'red')
		log('='.repeat(70), 'red')
		log('')
		exitCode = 1
	} finally {
		// Sign out to clean up session
		if (supabase && userId) {
			try {
				await supabase.auth.signOut()
				logDetail('Signed out successfully')
			} catch (error) {
				// Ignore sign-out errors
			}
		}
	}

	process.exit(exitCode)
}

// Run the diagnostic
main().catch((error) => {
	console.error('\nUnexpected error:', error)
	process.exit(1)
})
