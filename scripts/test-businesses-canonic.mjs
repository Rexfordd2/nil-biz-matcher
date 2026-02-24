#!/usr/bin/env node
/**
 * Runtime test: canonical businesses + user_businesses
 *
 * 1. Logs in with test credentials (SUPABASE_TEST_EMAIL / SUPABASE_TEST_PASSWORD)
 * 2. Calls upsertBusinessCanonical + saveUserBusiness
 * 3. Calls listUserBusinesses
 * 4. Prints PASS/FAIL with errors
 *
 * Requires: .env with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_TEST_EMAIL, SUPABASE_TEST_PASSWORD
 *
 * Run: node scripts/test-businesses-canonic.mjs
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const testEmail = process.env.SUPABASE_TEST_EMAIL
const testPassword = process.env.SUPABASE_TEST_PASSWORD

const PLACE_ID = 'test-canonic-' + Date.now()
const BUSINESS_NAME = 'Test Canonical Business ' + Date.now()

function log(msg) {
	console.log('[test-businesses]', msg)
}

function fail(reason, err) {
	console.error('\n--- FAIL ---')
	console.error(reason)
	if (err) console.error(err)
	process.exit(1)
}

async function main() {
	log('Starting canonical businesses test...')

	if (!supabaseUrl || !supabaseAnonKey) {
		fail('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
	}
	if (!testEmail || !testPassword) {
		fail('Missing SUPABASE_TEST_EMAIL or SUPABASE_TEST_PASSWORD in .env')
	}

	const supabase = createClient(supabaseUrl, supabaseAnonKey)

	// 1) Sign in
	log('Signing in...')
	const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
		email: testEmail,
		password: testPassword,
	})
	if (authErr) {
		fail('Login failed: ' + authErr.message, authErr)
	}
	const userId = authData.user.id
	log('Signed in as ' + authData.user.email + ' (' + userId + ')')

	// 2) upsertBusinessCanonical
	log('Upserting canonical business...')
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
		fail('upsertBusinessCanonical failed: ' + bizErr.message, bizErr)
	}
	log('Canonical business upserted')

	// 3) saveUserBusiness
	log('Saving user_businesses row...')
	const { error: ubErr } = await supabase.from('user_businesses').upsert(
		{
			user_id: userId,
			place_id: PLACE_ID,
			status: 'Not Contacted',
			tags: ['test'],
			updated_at: new Date().toISOString(),
		},
		{ onConflict: 'user_id,place_id', ignoreDuplicates: false }
	)
	if (ubErr) {
		fail('saveUserBusiness failed: ' + ubErr.message, ubErr)
	}
	log('User business saved')

	// 4) listUserBusinesses (same logic as service: user_businesses + businesses join)
	log('Listing user businesses...')
	const { data: ubData, error: ubListErr } = await supabase
		.from('user_businesses')
		.select('place_id, status, tags, created_at')
		.eq('user_id', userId)
		.order('created_at', { ascending: false })

	if (ubListErr) {
		fail('listUserBusinesses (user_businesses) failed: ' + ubListErr.message, ubListErr)
	}

	const placeIds = (ubData || []).map((r) => r.place_id)
	if (placeIds.length === 0) {
		fail('listUserBusinesses returned no rows')
	}

	const { data: bizData, error: bizListErr } = await supabase
		.from('businesses')
		.select('place_id, name, address, lat, lng, phone, website, rating, types, raw, created_at')
		.in('place_id', placeIds)

	if (bizListErr) {
		fail('listUserBusinesses (businesses join) failed: ' + bizListErr.message, bizListErr)
	}

	const found = (bizData || []).some((b) => b.place_id === PLACE_ID)
	if (!found) {
		fail('listUserBusinesses did not return the test business (place_id=' + PLACE_ID + ')')
	}

	log('List returned ' + (bizData?.length ?? 0) + ' business(es) including test row')
	console.log('\n--- PASS ---')
	process.exit(0)
}

main().catch((err) => {
	fail('Unexpected error', err)
})
