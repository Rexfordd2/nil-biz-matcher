#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load env vars (dotenv.config() already called above)
dotenv.config({ path: join(__dirname, '..', '.env.local') })
dotenv.config({ path: join(__dirname, '..', '.env') })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const SMOKE_EMAIL = process.env.SMOKE_EMAIL
const SMOKE_PASSWORD = process.env.SMOKE_PASSWORD

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
	console.error('❌ ERROR: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set')
	process.exit(1)
}

if (!SMOKE_EMAIL || !SMOKE_PASSWORD) {
	console.error('❌ ERROR: SMOKE_EMAIL and SMOKE_PASSWORD must be set')
	process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function ensureSmokeUser() {
	try {
		// Try to sign in first (user might already exist)
		const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
			email: SMOKE_EMAIL,
			password: SMOKE_PASSWORD
		})

		if (signInData?.user) {
			console.log(`✅ Smoke test user already exists: ${SMOKE_EMAIL}`)
			await supabase.auth.signOut()
			return
		}

		// User doesn't exist or wrong password - try to sign up
		const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
			email: SMOKE_EMAIL,
			password: SMOKE_PASSWORD,
			options: {
				data: {
					full_name: 'Smoke Test User',
					role: 'athlete'
				}
			}
		})

		if (signUpError) {
			// Check if user already exists (common error)
			if (signUpError.message.includes('already registered') || signUpError.message.includes('already exists')) {
				console.log(`✅ Smoke test user already exists: ${SMOKE_EMAIL}`)
				return
			}
			console.error(`❌ Failed to create smoke test user: ${signUpError.message}`)
			process.exit(1)
		}

		if (signUpData?.user) {
			console.log(`✅ Created smoke test user: ${SMOKE_EMAIL}`)
		} else {
			console.log(`⚠️  Signup initiated but user confirmation may be required`)
		}
	} catch (error) {
		console.error(`❌ Error ensuring smoke test user: ${error.message}`)
		process.exit(1)
	}
}

ensureSmokeUser()
