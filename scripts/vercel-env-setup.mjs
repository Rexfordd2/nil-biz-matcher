#!/usr/bin/env node
/**
 * Vercel Environment Setup Script
 * 
 * Ensures required environment variables for public release are set in Vercel:
 * - VITE_PUBLIC_MODE
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * 
 * Targets production + preview environments.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const REQUIRED_VARS = ['VITE_PUBLIC_MODE', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
const TARGET_ENVS = ['production', 'preview']

/**
 * Run a command and return { exitCode, stdout, stderr }
 */
function runCommand(command, args = [], options = {}) {
	return new Promise((resolve) => {
		const proc = spawn(command, args, {
			shell: true,
			...options
		})
		
		let stdout = ''
		let stderr = ''
		
		if (proc.stdout) {
			proc.stdout.on('data', (data) => {
				stdout += data.toString()
			})
		}
		
		if (proc.stderr) {
			proc.stderr.on('data', (data) => {
				stderr += data.toString()
			})
		}
		
		proc.on('close', (exitCode) => {
			resolve({ exitCode: exitCode || 0, stdout, stderr })
		})
		
		proc.on('error', (err) => {
			resolve({ exitCode: 1, stdout, stderr: stderr + err.message })
		})
	})
}

/**
 * Pipe value to vercel env add command
 */
function addEnvVar(name, value, environment, isSensitive = false) {
	return new Promise((resolve) => {
		const args = ['vercel', 'env', 'add', name, environment]
		if (isSensitive) {
			args.push('--sensitive')
		}
		
		const proc = spawn('npx', args, {
			shell: true,
			stdio: ['pipe', 'pipe', 'pipe']
		})
		
		let stdout = ''
		let stderr = ''
		
		proc.stdout.on('data', (data) => {
			stdout += data.toString()
		})
		
		proc.stderr.on('data', (data) => {
			stderr += data.toString()
		})
		
		// Pipe the value via stdin
		proc.stdin.write(value + '\n')
		proc.stdin.end()
		
		proc.on('close', (exitCode) => {
			resolve({ exitCode: exitCode || 0, stdout, stderr })
		})
		
		proc.on('error', (err) => {
			resolve({ exitCode: 1, stdout, stderr: stderr + err.message })
		})
	})
}

/**
 * Check if Vercel CLI is installed
 */
async function checkVercelCli() {
	console.log('[CHECK] Vercel CLI installation...')
	const result = await runCommand('vercel', ['--version'])
	
	if (result.exitCode !== 0) {
		console.error('❌ Vercel CLI not found')
		console.error('   Install: npm i -g vercel')
		return false
	}
	
	const version = result.stdout.trim()
	console.log(`✅ Vercel CLI installed: ${version}`)
	return true
}

/**
 * Check if user is logged in
 */
async function checkLogin() {
	console.log('\n[CHECK] Vercel login status...')
	const result = await runCommand('vercel', ['whoami'])
	
	if (result.exitCode !== 0) {
		console.error('❌ Not logged in to Vercel')
		console.error('   Run: vercel login')
		return { loggedIn: false, username: null }
	}
	
	const username = result.stdout.trim()
	console.log(`✅ Logged in as: ${username}`)
	return { loggedIn: true, username }
}

/**
 * Check if project is linked
 */
function checkProjectLink() {
	console.log('\n[CHECK] Project linking...')
	const projectJsonPath = resolve(process.cwd(), '.vercel', 'project.json')
	
	if (!existsSync(projectJsonPath)) {
		console.error('❌ Project not linked')
		console.error('   Run: vercel link')
		return false
	}
	
	console.log('✅ Project is linked')
	return true
}

/**
 * Get existing env vars for an environment
 */
async function getExistingVars(environment) {
	const result = await runCommand('vercel', ['env', 'ls', environment])
	
	if (result.exitCode !== 0) {
		console.warn(`⚠️  Could not list ${environment} env vars`)
		return []
	}
	
	const output = result.stdout
	const existing = []
	
	// Parse output - check if each required var name appears as a whole word
	for (const varName of REQUIRED_VARS) {
		// Match the variable name as a whole word (with word boundaries)
		const regex = new RegExp(`\\b${varName}\\b`, 'i')
		if (regex.test(output)) {
			existing.push(varName)
		}
	}
	
	return existing
}

/**
 * Main function
 */
async function main() {
	console.log('=== Vercel Environment Setup ===\n')
	console.log(`Required variables: ${REQUIRED_VARS.join(', ')}`)
	console.log(`Target environments: ${TARGET_ENVS.join(', ')}\n`)
	
	// Step 1: Check CLI
	const cliInstalled = await checkVercelCli()
	if (!cliInstalled) {
		process.exit(1)
	}
	
	// Step 2: Check login
	const { loggedIn, username } = await checkLogin()
	if (!loggedIn) {
		process.exit(1)
	}
	
	// Step 3: Check project link
	const linked = checkProjectLink()
	if (!linked) {
		process.exit(1)
	}
	
	// Step 4: Check existing vars and add missing ones
	console.log('\n=== Checking Environment Variables ===\n')
	
	const results = {}
	
	for (const env of TARGET_ENVS) {
		console.log(`[${env.toUpperCase()}]`)
		
		const existing = await getExistingVars(env)
		results[env] = { existing: [], added: [], skipped: [], errors: [] }
		
		for (const varName of REQUIRED_VARS) {
			if (existing.includes(varName)) {
				console.log(`  ✅ ${varName} (already set)`)
				results[env].existing.push(varName)
			} else {
				// Need to add this variable
				let value = null
				let isSensitive = false
				
				if (varName === 'VITE_PUBLIC_MODE') {
					value = 'true'
				} else if (varName === 'SUPABASE_URL') {
					value = process.env.SUPABASE_URL
				} else if (varName === 'SUPABASE_SERVICE_ROLE_KEY') {
					value = process.env.SUPABASE_SERVICE_ROLE_KEY
					isSensitive = true
				}
				
				if (!value) {
					console.log(`  ⚠️  ${varName} (not set locally - skipping)`)
					results[env].skipped.push(varName)
					continue
				}
				
				// Add the variable
				console.log(`  ⏳ ${varName} (adding...)`)
				const addResult = await addEnvVar(varName, value, env, isSensitive)
				
				if (addResult.exitCode === 0) {
					console.log(`  ✅ ${varName} (added)`)
					results[env].added.push(varName)
				} else {
					console.log(`  ❌ ${varName} (failed to add)`)
					if (addResult.stderr) {
						console.log(`     Error: ${addResult.stderr.trim()}`)
					}
					results[env].errors.push(varName)
				}
			}
		}
		
		console.log('')
	}
	
	// Step 5: Print final checklist
	console.log('=== Ready to Deploy Checklist ===\n')
	console.log(`✅ Vercel CLI installed`)
	console.log(`✅ Logged in as: ${username}`)
	console.log(`✅ Project linked`)
	console.log('')
	
	let allGood = true
	
	for (const env of TARGET_ENVS) {
		const r = results[env]
		const total = REQUIRED_VARS.length
		const set = r.existing.length + r.added.length
		const missing = r.skipped.length + r.errors.length
		
		if (missing > 0) {
			allGood = false
			console.log(`⚠️  ${env.toUpperCase()}: ${set}/${total} variables set`)
			
			if (r.skipped.length > 0) {
				console.log(`   Missing locally (set and re-run): ${r.skipped.join(', ')}`)
			}
			if (r.errors.length > 0) {
				console.log(`   Failed to add: ${r.errors.join(', ')}`)
			}
		} else {
			console.log(`✅ ${env.toUpperCase()}: ${set}/${total} variables set`)
		}
	}
	
	console.log('')
	
	if (allGood) {
		console.log('✅ All required variables are set!')
		console.log('   Ready to deploy with: vercel --prod')
	} else {
		console.log('⚠️  Some variables are missing')
		console.log('')
		console.log('To set missing Supabase variables locally, run:')
		console.log('  export SUPABASE_URL="https://your-project.supabase.co"')
		console.log('  export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"')
		console.log('')
		console.log('Then re-run: npm run vercel:env')
		process.exit(1)
	}
}

main().catch((err) => {
	console.error('\n❌ Unexpected error:', err.message)
	console.error(err.stack)
	process.exit(1)
})
