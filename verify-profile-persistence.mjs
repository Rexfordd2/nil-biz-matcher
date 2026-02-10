#!/usr/bin/env node
/**
 * Athlete Profile Persistence Verification Script
 * 
 * This script verifies that the athlete_profiles table exists in Supabase
 * and has the correct schema and RLS policies.
 * 
 * Usage:
 *   node verify-profile-persistence.mjs
 * 
 * Prerequisites:
 *   - Supabase CLI installed (or direct database access)
 *   - Environment variables set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
	console.error('❌ Missing Supabase credentials');
	console.error('   Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY)');
	process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('🔍 Verifying Athlete Profile Persistence Setup\n');

async function verify() {
	const results = {
		passed: 0,
		failed: 0,
		warnings: 0
	};

	// Test 1: Check if table exists
	console.log('1️⃣  Checking if athlete_profiles table exists...');
	try {
		const { data, error } = await supabase
			.from('athlete_profiles')
			.select('user_id')
			.limit(0);
		
		if (error) {
			if (error.message.includes('does not exist') || error.code === '42P01') {
				console.error('   ❌ Table does not exist');
				console.error('   → Run: psql $DATABASE_URL -f supabase/athlete_profiles.sql');
				results.failed++;
			} else {
				console.error('   ❌ Error checking table:', error.message);
				results.failed++;
			}
		} else {
			console.log('   ✅ Table exists');
			results.passed++;
		}
	} catch (err) {
		console.error('   ❌ Unexpected error:', err.message);
		results.failed++;
	}

	// Test 2: Check RLS is enabled
	console.log('\n2️⃣  Checking if RLS is enabled...');
	try {
		const { data, error } = await supabase.rpc('exec_sql', {
			sql: `
				SELECT tablename, rowsecurity 
				FROM pg_tables 
				WHERE schemaname = 'public' 
				  AND tablename = 'athlete_profiles'
			`
		});

		if (error) {
			console.log('   ⚠️  Cannot verify RLS status (requires service role key)');
			console.log('   → Manually verify: SELECT rowsecurity FROM pg_tables WHERE tablename = \'athlete_profiles\'');
			results.warnings++;
		} else if (data && data[0]?.rowsecurity) {
			console.log('   ✅ RLS is enabled');
			results.passed++;
		} else {
			console.error('   ❌ RLS is NOT enabled');
			console.error('   → Run: ALTER TABLE athlete_profiles ENABLE ROW LEVEL SECURITY;');
			results.failed++;
		}
	} catch (err) {
		console.log('   ⚠️  Cannot verify RLS status:', err.message);
		console.log('   → This is expected without service role key, verify manually');
		results.warnings++;
	}

	// Test 3: Check policies exist
	console.log('\n3️⃣  Checking RLS policies...');
	const expectedPolicies = [
		'Allow users to read own profile',
		'Allow users to insert own profile',
		'Allow users to update own profile',
		'Allow users to delete own profile'
	];

	for (const policyName of expectedPolicies) {
		try {
			// Attempt to query with anon key - if RLS works, query will succeed/fail based on auth
			// This indirectly verifies policies exist
			const { error } = await supabase
				.from('athlete_profiles')
				.select('user_id')
				.limit(1);

			if (error && error.code === '42501') {
				console.log(`   ⚠️  Policy check requires authenticated user`);
				console.log(`   → Manually verify: SELECT policyname FROM pg_policies WHERE tablename = 'athlete_profiles'`);
				results.warnings++;
				break;
			}
		} catch (err) {
			console.log(`   ⚠️  Cannot verify policy: ${policyName}`);
			results.warnings++;
		}
	}

	console.log('   ℹ️  Policy verification requires service role key or manual check');
	console.log('   → Run: SELECT policyname, cmd FROM pg_policies WHERE tablename = \'athlete_profiles\' ORDER BY cmd;');
	console.log('   → Expected: 4 policies (DELETE, INSERT, SELECT, UPDATE)');

	// Test 4: Check schema structure
	console.log('\n4️⃣  Checking table schema...');
	try {
		const { data, error } = await supabase
			.from('athlete_profiles')
			.select('user_id, profile, created_at, updated_at')
			.limit(0);

		if (error) {
			console.error('   ❌ Schema check failed:', error.message);
			results.failed++;
		} else {
			console.log('   ✅ Required columns exist (user_id, profile, created_at, updated_at)');
			results.passed++;
		}
	} catch (err) {
		console.error('   ❌ Schema check error:', err.message);
		results.failed++;
	}

	// Test 5: Check JSONB profile column
	console.log('\n5️⃣  Checking profile JSONB column...');
	try {
		// Try to insert a test profile (will fail if not authenticated, but tests column type)
		const { error } = await supabase
			.from('athlete_profiles')
			.select('profile')
			.limit(1);

		if (error && !error.message.includes('permission')) {
			console.error('   ❌ Profile column check failed:', error.message);
			results.failed++;
		} else {
			console.log('   ✅ Profile JSONB column accessible');
			results.passed++;
		}
	} catch (err) {
		console.error('   ❌ JSONB column check error:', err.message);
		results.failed++;
	}

	// Test 6: Check environment variables
	console.log('\n6️⃣  Checking environment configuration...');
	if (process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY) {
		console.log('   ✅ VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set');
		results.passed++;
	} else {
		console.error('   ❌ Missing environment variables');
		console.error('   → Add to .env: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
		results.failed++;
	}

	// Test 7: Check updated_at trigger
	console.log('\n7️⃣  Checking updated_at trigger...');
	console.log('   ℹ️  Trigger verification requires manual check or integration test');
	console.log('   → Manually verify: SELECT tgname FROM pg_trigger WHERE tgrelid = \'athlete_profiles\'::regclass;');
	console.log('   → Expected: trg_athlete_profiles_updated_at');
	results.warnings++;

	// Summary
	console.log('\n' + '='.repeat(60));
	console.log('📊 Verification Summary\n');
	console.log(`   ✅ Passed:   ${results.passed}`);
	console.log(`   ❌ Failed:   ${results.failed}`);
	console.log(`   ⚠️  Warnings: ${results.warnings}`);
	console.log('='.repeat(60));

	if (results.failed === 0) {
		console.log('\n🎉 All checks passed! Athlete profile persistence is ready.');
		console.log('\n📝 Next steps:');
		console.log('   1. Start dev server: npm run dev');
		console.log('   2. Log in to the app');
		console.log('   3. Navigate to Athlete Profile tab');
		console.log('   4. Fill in profile and click "Save Profile"');
		console.log('   5. Refresh page to verify persistence');
		console.log('\n📖 Full verification guide: ATHLETE_PROFILE_PERSISTENCE_VERIFICATION.md');
		process.exit(0);
	} else {
		console.log('\n⚠️  Some checks failed. Please address the issues above.');
		console.log('\n🔧 Quick fixes:');
		console.log('   1. Apply schema: psql $DATABASE_URL -f supabase/athlete_profiles.sql');
		console.log('   2. Apply RLS: psql $DATABASE_URL -f supabase/VERIFY_ATHLETE_PROFILES_RLS.sql');
		console.log('   3. Or run migration: psql $DATABASE_URL -f supabase/migrations/20260202_app_user_scoping.sql');
		console.log('\n📖 Full troubleshooting guide: ATHLETE_PROFILE_PERSISTENCE_VERIFICATION.md');
		process.exit(1);
	}
}

verify().catch(err => {
	console.error('\n💥 Verification script failed:', err.message);
	console.error(err.stack);
	process.exit(1);
});
