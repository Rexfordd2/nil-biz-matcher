import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'

// Force Node.js runtime (not Edge) - required for fs operations
export const config = {
	runtime: 'nodejs'
}

/**
 * Waitlist endpoint: accepts email submissions and stores them.
 * 
 * Storage strategy:
 * 1. Prefer Supabase when configured (SUPABASE_URL + service role or anon key)
 * 2. Hybrid fallback: return success without storage (unless WAITLIST_FALLBACK_STORAGE=true)
 * 
 * Response format:
 * - { ok: true, status: "created" } - new email added
 * - { ok: true, status: "already_registered" } - duplicate email (treated as success)
 * - { ok: true, status: "accepted_no_storage" } - accepted but not stored (Supabase not configured)
 * - { ok: false, error: "..." } - validation or server error
 * 
 * GET handler:
 * - Returns { ok: true } for sanity checks
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
	try {
		// GET handler for sanity checks
		if (req.method === 'GET') {
			return res.status(200).json({ ok: true })
		}

		if (req.method !== 'POST') {
			return res.status(405).json({ ok: false, error: 'Method Not Allowed' })
		}

	// Parse and validate email
	const { email, source, utm_source, utm_medium, utm_campaign, utm_term, utm_content, anon_id, website } = (req.body || {}) as {
		email?: string
		source?: string
		utm_source?: string
		utm_medium?: string
		utm_campaign?: string
		utm_term?: string
		utm_content?: string
		anon_id?: string
		website?: string // Honeypot field
	}

	// Honeypot check: if website field is filled, it's likely a bot
	// Return success to avoid revealing the honeypot, but don't store
	if (website && website.trim() !== '') {
		// Silent rejection - return success to bot but don't store
		return res.status(200).json({ ok: true, status: 'honeypot_rejected' })
	}

	// Normalize and validate email
	const normalizedEmail = (email || '').trim().toLowerCase()
	if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
		return res.status(400).json({ ok: false, error: 'Invalid email address' })
	}

	// Check for required environment variables
	const hasSupabaseUrl = Boolean(process.env.SUPABASE_URL)
	const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

	// Require both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in production
	if (!hasSupabaseUrl || !hasServiceRoleKey) {
		return res.status(503).json({ ok: false, error: 'missing_env' })
	}

	// Check for Supabase configuration
	// Prefer SUPABASE_* (server-only) over VITE_* (client-exposed)
	const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
	const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
	const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
	
	// Prefer service role key (bypasses RLS, more reliable for server-side writes)
	const supabaseKey = supabaseServiceRoleKey || supabaseAnonKey

	// Check if we're in production/Vercel where Supabase should be configured
	const isVercel = Boolean(process.env.VERCEL)
	const requireSupabase = isVercel || process.env.REQUIRE_SUPABASE === 'true'

	// If Supabase is required but not configured, return 503
	if (requireSupabase && (!supabaseUrl || !supabaseKey)) {
		return res.status(503).json({ ok: false, error: 'missing_env' })
	}

	// Attempt Supabase write when configured
	if (supabaseUrl && supabaseKey) {
		try {
			const supabase = createClient(supabaseUrl, supabaseKey, {
				auth: {
					autoRefreshToken: false,
					persistSession: false
				}
			})

			const insertPayload = {
				email: normalizedEmail,
				anon_id: anon_id || null,
				source: source || null,
				utm_source: utm_source || null,
				utm_medium: utm_medium || null,
				utm_campaign: utm_campaign || null,
				utm_term: utm_term || null,
				utm_content: utm_content || null
			}

		const { error } = await supabase.from('waitlist').insert(insertPayload)

		if (error) {
			// Treat duplicate emails as success (unique constraint violation)
			if (
				error.code === '23505' ||
				error.message.includes('duplicate') ||
				error.message.includes('unique') ||
				error.message.includes('already exists')
			) {
				return res.status(200).json({ ok: true, status: 'already_registered' })
			}

			// Check for table/schema errors (missing table, wrong schema, permission denied)
			const isSchemaError = 
				error.code === '42P01' || // undefined_table
				error.code === '42703' || // undefined_column
				error.code === '42501' || // insufficient_privilege
				error.message.includes('relation') && error.message.includes('does not exist') ||
				error.message.includes('column') && error.message.includes('does not exist') ||
				error.message.includes('permission denied') ||
				error.message.includes('schema')

			if (isSchemaError) {
				// Truncate error details to avoid exposing too much info
				const details = (error.message || error.code || 'schema_error').substring(0, 100)
				return res.status(500).json({ ok: false, error: 'db_error', details })
			}

			// Other database errors
			const details = (error.message || 'unknown').substring(0, 100)
			return res.status(500).json({ ok: false, error: 'db_error', details })
		}

		// Success: new email inserted
		return res.status(200).json({ ok: true, status: 'created' })
	} catch (err: any) {
		// Truncate error details to avoid exposing too much info
		const details = (err.message || 'unknown').substring(0, 100)
		return res.status(500).json({ ok: false, error: 'db_error', details })
	}
	}

	// Fallback mode: Supabase not configured
	// Hybrid strategy: default to no-op success, unless WAITLIST_FALLBACK_STORAGE=true
	const enableFallbackStorage = process.env.WAITLIST_FALLBACK_STORAGE === 'true'

	if (!enableFallbackStorage) {
		// Graceful no-op: accept submission without storage
		// Useful for production when Supabase is temporarily unavailable or not yet configured
		return res.status(200).json({ ok: true, status: 'accepted_no_storage' })
	}

	// Fallback storage enabled: JSON file storage (development/testing)
	// Use /tmp on Vercel (ephemeral but writable), ./waitlist.json locally
	const fallbackIsVercel = Boolean(process.env.VERCEL)
	const filePath = fallbackIsVercel ? '/tmp/waitlist.json' : './waitlist.json'

	try {
		// Ensure directory exists (only needed for local non-/tmp paths)
		if (!fallbackIsVercel) {
			const dir = '.'
			if (!existsSync(dir)) {
				await mkdir(dir, { recursive: true })
			}
		}

		// Read existing entries
		let entries: any[] = []
		if (existsSync(filePath)) {
			try {
				const content = await readFile(filePath, 'utf-8')
				entries = JSON.parse(content)
				if (!Array.isArray(entries)) {
					entries = []
				}
			} catch {
				entries = []
			}
		}

		// Check for duplicate email (case-insensitive)
		const isDuplicate = entries.some((entry: any) => 
			typeof entry.email === 'string' && entry.email.toLowerCase() === normalizedEmail
		)
		if (isDuplicate) {
			return res.status(200).json({ ok: true, status: 'already_registered' })
		}

		// Append new entry
		entries.push({
			email: normalizedEmail,
			anon_id: anon_id || null,
			source: source || null,
			utm_source: utm_source || null,
			utm_medium: utm_medium || null,
			utm_campaign: utm_campaign || null,
			utm_term: utm_term || null,
			utm_content: utm_content || null,
			created_at: new Date().toISOString()
		})

		await writeFile(filePath, JSON.stringify(entries, null, 2), 'utf-8')

		return res.status(200).json({ ok: true, status: 'created' })
	} catch (err: any) {
		// Truncate error details to avoid exposing too much info
		const details = (err.message || 'unknown').substring(0, 100)
		return res.status(500).json({ ok: false, error: 'db_error', details })
	}
	} catch (topLevelErr: any) {
		// Top-level catch to prevent any uncaught exceptions
		// Return a generic error without exposing internal details
		const details = (topLevelErr.message || 'unknown').substring(0, 100)
		return res.status(500).json({ ok: false, error: 'server_error', details })
	}
}
