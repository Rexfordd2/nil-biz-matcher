#!/usr/bin/env node
/**
 * Verify canonical businesses (businesses + user_businesses) end-to-end.
 *
 * 1) Log in with SUPABASE_TEST_EMAIL/PASSWORD, --email/--password, or --prompt
 * 2) Upsert a synthetic business into businesses + user_businesses
 * 3) List user businesses and assert the synthetic row is returned with status/tags
 * 4) Update status/tags and confirm persistence
 * 5) Clean up (remove user_businesses row for that place_id)
 *
 * Exit: 0 on PASS, 1 on FAIL. Error codes: LOGIN_FAILED, UPSERT_FAILED, LIST_MISSING,
 * UPDATE_PERSIST_FAILED, CLEANUP_FAILED.
 *
 * Run: npm run diag:biz
 * Or:  node scripts/verify-businesses-canonical.mjs [--email=...] [--password=...] [--prompt]
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as readline from 'readline'

dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local' })

function parseArgs() {
	const args = process.argv.slice(2)
	const parsed = {}
	for (const arg of args) {
		if (arg.startsWith('--email=')) parsed.email = arg.substring('--email='.length)
		else if (arg.startsWith('--password=')) parsed.password = arg.substring('--password='.length)
		else if (arg === '--prompt') parsed.prompt = true
	}
	return parsed
}

function promptText(question) {
	return new Promise((resolve) => {
		const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
		rl.question(question, (answer) => {
			rl.close()
			resolve(answer.trim())
		})
	})
}

const cliArgs = parseArgs()

let supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
let supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
let testEmail = cliArgs.email || process.env.SUPABASE_TEST_EMAIL
let testPassword = cliArgs.password || process.env.SUPABASE_TEST_PASSWORD

const PLACE_ID = 'verify-canonic-' + Date.now()
const BUSINESS_NAME = 'Verify Canonical ' + Date.now()
const INITIAL_STATUS = 'Not Contacted'
const INITIAL_TAGS = ['verify']
const UPDATED_STATUS = 'Contacted'
const UPDATED_TAGS = ['verify', 'updated']

function log(msg) {
	console.log('[verify-businesses]', msg)
}

function fail(code, reason, err) {
	console.error('\n--- FAIL ---')
	console.error('CODE:', code)
	console.error(reason)
	if (err) console.error(err)
	process.exit(1)
}

async function main() {
	log('Loading config...')

	if (!supabaseUrl || !supabaseAnonKey) {
		fail('LOGIN_FAILED', 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
	}
	if (!testEmail || !testPassword) {
		if (cliArgs.prompt) {
			if (!testEmail) testEmail = await promptText('Supabase test email: ')
			if (!testPassword) testPassword = await promptText('Supabase test password: ')
		}
		if (!testEmail || !testPassword) {
			fail('LOGIN_FAILED', 'Missing SUPABASE_TEST_EMAIL/SUPABASE_TEST_PASSWORD (or --email=... --password=... or --prompt)')
		}
	}

	const supabase = createClient(supabaseUrl, supabaseAnonKey)

	// 1) Login
	log('Signing in...')
	const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
		email: testEmail,
		password: testPassword,
	})
	if (authErr) {
		fail('LOGIN_FAILED', 'Login failed: ' + authErr.message, authErr)
	}
	const userId = authData.user.id
	log('Signed in as ' + authData.user.email)

	// 2) Upsert synthetic business (businesses + user_businesses)
	log('Upserting synthetic business...')
	const { error: bizErr } = await supabase
		.from('businesses')
		.upsert(
			{
				place_id: PLACE_ID,
				name: BUSINESS_NAME,
				address: null,
				lat: null,
				lng: null,
				phone: null,
				website: null,
				rating: null,
				types: [],
				raw: {},
				updated_at: new Date().toISOString(),
			},
			{ onConflict: 'place_id', ignoreDuplicates: false }
		)
	if (bizErr) {
		fail('UPSERT_FAILED', 'businesses upsert: ' + bizErr.message, bizErr)
	}

	const { error: ubErr } = await supabase.from('user_businesses').upsert(
		{
			user_id: userId,
			place_id: PLACE_ID,
			status: INITIAL_STATUS,
			tags: INITIAL_TAGS,
			updated_at: new Date().toISOString(),
		},
		{ onConflict: 'user_id,place_id', ignoreDuplicates: false }
	)
	if (ubErr) {
		fail('UPSERT_FAILED', 'user_businesses upsert: ' + ubErr.message, ubErr)
	}

	// 3) List and assert synthetic row with status/tags
	log('Listing and asserting synthetic row...')
	const { data: ubData, error: ubListErr } = await supabase
		.from('user_businesses')
		.select('place_id, status, tags, created_at')
		.eq('user_id', userId)
		.order('created_at', { ascending: false })

	if (ubListErr) {
		fail('LIST_MISSING', 'user_businesses select: ' + ubListErr.message, ubListErr)
	}

	const ubRow = (ubData || []).find((r) => r.place_id === PLACE_ID)
	if (!ubRow) {
		fail('LIST_MISSING', 'Synthetic business not in user_businesses list (place_id=' + PLACE_ID + ')')
	}

	const placeIds = (ubData || []).map((r) => r.place_id)
	const { data: bizData, error: bizListErr } = await supabase
		.from('businesses')
		.select('place_id, name, address, lat, lng, phone, website, rating, types, raw, created_at')
		.in('place_id', placeIds)

	if (bizListErr) {
		fail('LIST_MISSING', 'businesses select: ' + bizListErr.message, bizListErr)
	}

	const bizRow = (bizData || []).find((b) => b.place_id === PLACE_ID)
	if (!bizRow) {
		fail('LIST_MISSING', 'Synthetic business not in businesses list (place_id=' + PLACE_ID + ')')
	}

	if (ubRow.status !== INITIAL_STATUS) {
		fail('LIST_MISSING', 'Expected status "' + INITIAL_STATUS + '", got "' + ubRow.status + '"')
	}
	if (!Array.isArray(ubRow.tags) || ubRow.tags.join(',') !== INITIAL_TAGS.join(',')) {
		fail('LIST_MISSING', 'Expected tags ' + JSON.stringify(INITIAL_TAGS) + ', got ' + JSON.stringify(ubRow.tags))
	}

	// 4) Update status/tags and confirm persistence
	log('Updating status/tags...')
	const { error: updateErr } = await supabase
		.from('user_businesses')
		.update({
			status: UPDATED_STATUS,
			tags: UPDATED_TAGS,
			updated_at: new Date().toISOString(),
		})
		.eq('user_id', userId)
		.eq('place_id', PLACE_ID)

	if (updateErr) {
		fail('UPDATE_PERSIST_FAILED', 'user_businesses update: ' + updateErr.message, updateErr)
	}

	log('Asserting update persisted...')
	const { data: ubData2, error: ubListErr2 } = await supabase
		.from('user_businesses')
		.select('place_id, status, tags')
		.eq('user_id', userId)
		.eq('place_id', PLACE_ID)
		.single()

	if (ubListErr2 || !ubData2) {
		fail('UPDATE_PERSIST_FAILED', 'Re-read after update failed: ' + (ubListErr2?.message || 'no row'), ubListErr2)
	}
	if (ubData2.status !== UPDATED_STATUS) {
		fail('UPDATE_PERSIST_FAILED', 'Expected status "' + UPDATED_STATUS + '", got "' + ubData2.status + '"')
	}
	if (!Array.isArray(ubData2.tags) || ubData2.tags.join(',') !== UPDATED_TAGS.join(',')) {
		fail('UPDATE_PERSIST_FAILED', 'Expected tags ' + JSON.stringify(UPDATED_TAGS) + ', got ' + JSON.stringify(ubData2.tags))
	}

	// 5) Cleanup
	log('Cleaning up...')
	const { error: delErr } = await supabase
		.from('user_businesses')
		.delete()
		.eq('user_id', userId)
		.eq('place_id', PLACE_ID)

	if (delErr) {
		fail('CLEANUP_FAILED', 'Delete user_businesses: ' + delErr.message, delErr)
	}

	// Optional: remove canonical row so DB stays clean
	await supabase.from('businesses').delete().eq('place_id', PLACE_ID)

	log('Done.')
	console.log('\n--- PASS ---')
	process.exit(0)
}

main().catch((err) => {
	fail('CLEANUP_FAILED', 'Unexpected error: ' + (err?.message || err), err)
})
