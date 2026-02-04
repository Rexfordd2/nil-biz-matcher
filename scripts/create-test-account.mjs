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
	console.error('   Looking for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
	process.exit(1)
}

const email = process.argv[2]
const password = process.argv[3]

if (!email || !password) {
	console.log('Usage: node create-test-account.mjs <email> <password>')
	console.log('Example: node create-test-account.mjs test@example.com mypassword123')
	process.exit(1)
}

console.log('🔄 Creating account...')
console.log(`   Email: ${email}`)

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const { data, error } = await supabase.auth.signUp({
	email,
	password,
})

if (error) {
	console.error('❌ Sign up failed:', error.message)
	process.exit(1)
}

console.log('✅ Account created successfully!')
console.log('   User ID:', data.user?.id)

if (data.user?.email_confirmed_at) {
	console.log('✅ Email confirmed')
} else {
	console.log('⚠️  Email confirmation required')
	console.log('   Check your inbox for a confirmation email')
	console.log('   Or configure Supabase to disable email confirmation')
}

console.log('\n✅ You can now run the diagnostic:')
console.log(`   npm run diag:profile:prompt`)
