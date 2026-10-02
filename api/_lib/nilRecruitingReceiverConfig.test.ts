import { describe, expect, it } from 'vitest'
import { loadNilRecruitingReceiverConfig } from './nilRecruitingReceiverConfig'

const SECRET = 'development-secret-012345'
const DATABASE_URL =
	'postgresql://nil_recruiting_receiver:nil-receiver-dev-only@127.0.0.1:5432/nil_recruiting_receiver_dev'

describe('NIL recruiting receiver activation', () => {
	it('stays inactive unless development mode, secret, and a local database are all set', () => {
		expect(loadNilRecruitingReceiverConfig({})).toBeNull()
		expect(
			loadNilRecruitingReceiverConfig({
				NIL_RECRUITING_RECEIVER_MODE: 'development',
				NIL_RECRUITING_RECEIVER_HMAC_SECRET: SECRET,
			})
		).toBeNull()
		expect(
			loadNilRecruitingReceiverConfig({
				NIL_RECRUITING_RECEIVER_MODE: 'development',
				NIL_RECRUITING_RECEIVER_HMAC_SECRET: SECRET,
				NIL_RECRUITING_RECEIVER_DATABASE_URL: DATABASE_URL,
				VITE_PUBLIC_MODE: 'true',
			})
		).toMatchObject({ mode: 'development' })
	})

	it('refuses production, preview, and non-local databases', () => {
		const base = {
			NIL_RECRUITING_RECEIVER_MODE: 'development',
			NIL_RECRUITING_RECEIVER_HMAC_SECRET: SECRET,
			NIL_RECRUITING_RECEIVER_DATABASE_URL: DATABASE_URL,
		}
		expect(loadNilRecruitingReceiverConfig({ ...base, VERCEL_ENV: 'production' })).toBeNull()
		expect(loadNilRecruitingReceiverConfig({ ...base, VERCEL_ENV: 'preview' })).toBeNull()
		expect(loadNilRecruitingReceiverConfig({ ...base, NODE_ENV: 'production' })).toBeNull()
		expect(
			loadNilRecruitingReceiverConfig({
				...base,
				NIL_RECRUITING_RECEIVER_DATABASE_URL:
					'postgresql://nil_recruiting_receiver:secret@db.example.supabase.co:5432/postgres',
			})
		).toBeNull()
		expect(
			loadNilRecruitingReceiverConfig({
				...base,
				NIL_RECRUITING_RECEIVER_DATABASE_URL:
					'postgresql://nil_recruiting_receiver:secret@127.0.0.1:5432/nil_roster_prod',
			})
		).toBeNull()
	})
})
