#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

// Load environment variables
config({ path: resolve(rootDir, '.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
	console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env')
	process.exit(1)
}

const email = process.argv[2]

if (!email) {
	console.log('Usage: node reset-password.mjs <email>')
	console.log('Example: node reset-password.mjs test@example.com')
	process.exit(1)
}

console.log('🔄 Sending password reset email...')
console.log(`   Email: ${email}`)

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const { error } = await supabase.auth.resetPasswordForEmail(email)

if (error) {
	console.error('❌ Reset failed:', error.message)
	process.exit(1)
}

console.log('✅ Password reset email sent!')
console.log('   Check your inbox for the reset link')
