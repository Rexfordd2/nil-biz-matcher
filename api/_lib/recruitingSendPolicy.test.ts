import { describe, expect, it } from 'vitest'
import {
	buildSendAuditRecord,
	escapeHtml,
	evaluateRecruitingSendPermission,
	validateConfirmedSingleRecipient,
} from './recruitingSendPolicy'

const ON = { RECRUITING_EMAIL_SEND_ENABLED: 'true' }
const adult = { id: 'u-adult', email: 'a@x.test', app_metadata: { recruiting_email_send: 'adult_verified' } }

describe('recruiting send policy', () => {
	it('is off unless the server flag is explicitly true', () => {
		expect(evaluateRecruitingSendPermission({ env: {}, user: adult })).toEqual({ allowed: false, reason: 'flag_off' })
		expect(evaluateRecruitingSendPermission({ env: { RECRUITING_EMAIL_SEND_ENABLED: '1' }, user: adult }).allowed).toBe(false)
	})

	it('requires an authenticated user', () => {
		expect(evaluateRecruitingSendPermission({ env: ON, user: null })).toEqual({ allowed: false, reason: 'unauthenticated' })
	})

	it('requires the admin-controlled adult/operator claim; user_metadata cannot grant it', () => {
		expect(
			evaluateRecruitingSendPermission({
				env: ON,
				user: { id: 'u', user_metadata: { recruiting_email_send: 'operator', role: 'athlete_18_plus' } },
			})
		).toEqual({ allowed: false, reason: 'not_permitted' })
		expect(
			evaluateRecruitingSendPermission({ env: ON, user: { id: 'u', app_metadata: { recruiting_email_send: true } } })
		).toEqual({ allowed: false, reason: 'not_permitted' })
		expect(evaluateRecruitingSendPermission({ env: ON, user: adult })).toEqual({ allowed: true, context: 'adult_verified' })
		expect(
			evaluateRecruitingSendPermission({ env: ON, user: { id: 'op', app_metadata: { recruiting_email_send: 'operator' } } })
		).toEqual({ allowed: true, context: 'operator' })
	})

	it('minor markers block sending even with a claim', () => {
		for (const marker of [
			{ user_metadata: { role: 'athlete_under_18' } },
			{ user_metadata: { onboardingRole: 'athlete_under_18' } },
			{ user_metadata: { guardianRequired: true } },
			{ app_metadata: { recruiting_email_send: 'operator', minor: true } },
		]) {
			const user = { id: 'm', ...marker, app_metadata: { recruiting_email_send: 'operator', ...(marker as any).app_metadata } }
			expect(evaluateRecruitingSendPermission({ env: ON, user })).toEqual({ allowed: false, reason: 'minor_account' })
		}
	})

	it('accepts exactly one confirmed recipient', () => {
		expect(
			validateConfirmedSingleRecipient({ coach: { name: 'Coach K', email: 'K@School.edu' }, confirmRecipientEmail: 'k@school.edu' })
		).toEqual({ ok: true, recipient: { name: 'Coach K', email: 'k@school.edu' } })
		expect(
			validateConfirmedSingleRecipient({ coaches: [{ name: 'A', email: 'a@s.edu' }], confirmRecipientEmail: 'a@s.edu' }).ok
		).toBe(true)
	})

	it('rejects bulk payloads, missing confirmation, and mismatched confirmation', () => {
		expect(
			validateConfirmedSingleRecipient({
				coaches: [{ email: 'a@s.edu' }, { email: 'b@s.edu' }],
				confirmRecipientEmail: 'a@s.edu',
			}).ok
		).toBe(false)
		expect(validateConfirmedSingleRecipient({ coach: { email: 'a@s.edu' }, coachIds: ['1', '2'], confirmRecipientEmail: 'a@s.edu' }).ok).toBe(false)
		expect(validateConfirmedSingleRecipient({ coach: { email: 'a@s.edu' } }).ok).toBe(false)
		expect(validateConfirmedSingleRecipient({ coach: { email: 'a@s.edu' }, confirmRecipientEmail: 'b@s.edu' }).ok).toBe(false)
		expect(validateConfirmedSingleRecipient({ coach: { email: 'a@s.edu, b@s.edu' }, confirmRecipientEmail: 'a@s.edu, b@s.edu' }).ok).toBe(false)
	})

	it('builds an audit record without storing the raw recipient address', () => {
		const rec = buildSendAuditRecord({
			userId: 'u1',
			outcome: 'sent',
			context: 'adult_verified',
			recipientEmail: 'Coach@School.edu',
			messageId: 'm-1',
			now: new Date('2026-01-01T00:00:00Z'),
		})
		expect(rec).toMatchObject({
			event: 'recruiting_email_send',
			at: '2026-01-01T00:00:00.000Z',
			userId: 'u1',
			outcome: 'sent',
			context: 'adult_verified',
			recipientDomain: 'school.edu',
			messageId: 'm-1',
		})
		expect(rec.auditId).toMatch(/^[0-9a-f-]{36}$/)
		expect(rec.recipientHash).toMatch(/^[0-9a-f]{24}$/)
		expect(JSON.stringify(rec)).not.toContain('coach@school.edu')
	})

	it('escapes HTML in user-provided email content', () => {
		expect(escapeHtml('<script>"x"&\'y\'</script>')).toBe('&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;')
	})
})
