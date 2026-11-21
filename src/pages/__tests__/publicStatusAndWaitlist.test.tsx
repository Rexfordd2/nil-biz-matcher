import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const supabaseCalls = vi.hoisted(() => ({ from: vi.fn(), getSession: vi.fn() }))

vi.mock('../../lib/supabaseClient', () => ({
	supabaseEnvConfigured: true,
	supabase: { from: supabaseCalls.from, auth: { getSession: supabaseCalls.getSession } },
}))

describe('public status page', () => {
	it('renders without querying Supabase or echoing session and request details', async () => {
		const { default: Status } = await import('../Status')
		const html = renderToStaticMarkup(createElement(Status))

		expect(html).toContain('Current Site Status')
		expect(html).toContain('href="https://athletehouze.com"')
		expect(html).not.toMatch(/Supabase configured|Session present|returnTo|Unknown error/)
		expect(html).not.toContain('login optional')
		expect(html).toContain('opens after you create a free account or log in')
		expect(supabaseCalls.from).not.toHaveBeenCalled()
		expect(supabaseCalls.getSession).not.toHaveBeenCalled()
	})
})

describe('waitlist without a configured signup form', () => {
	beforeEach(() => {
		vi.resetModules()
		vi.stubEnv('VITE_WAITLIST_EMBED_HTML', '')
		vi.stubEnv('VITE_WAITLIST_EMBED_URL', '')
	})

	afterEach(() => {
		vi.unstubAllEnvs()
	})

	it('explains that signups are not collected and never shows environment variable names', async () => {
		vi.stubEnv('VITE_PUBLIC_MODE', '')
		const { default: WaitlistEmbed, isWaitlistEmbedConfigured } = await import('../../components/WaitlistEmbed')
		const html = renderToStaticMarkup(createElement(WaitlistEmbed))

		expect(isWaitlistEmbedConfigured()).toBe(false)
		expect(html).toContain('Early-access signups are not being collected here right now.')
		expect(html).toContain('Create a free account')
		expect(html).not.toMatch(/VITE_|environment variables|not configured/)
	})

	it('does not offer account creation when public mode disables signup', async () => {
		vi.stubEnv('VITE_PUBLIC_MODE', 'true')
		const { default: WaitlistEmbed } = await import('../../components/WaitlistEmbed')
		const html = renderToStaticMarkup(createElement(WaitlistEmbed))

		expect(html).toContain('Early-access signups are not being collected here right now.')
		expect(html).not.toContain('Create a free account')
	})

	it('hides the waitlist promise and the "I already joined" shortcut on the waitlist page', async () => {
		const { default: Waitlist } = await import('../Waitlist')
		const html = renderToStaticMarkup(createElement(Waitlist))

		expect(html).toContain('Early Access')
		expect(html).not.toContain('Join the Waitlist')
		expect(html).not.toContain('I already joined')
		expect(html).not.toContain('be the first to know when we launch')
	})

	it('keeps the configured form path unchanged', async () => {
		vi.stubEnv('VITE_WAITLIST_EMBED_URL', 'https://forms.gle/example')
		const { default: Waitlist } = await import('../Waitlist')
		const html = renderToStaticMarkup(createElement(Waitlist))

		expect(html).toContain('Join the Waitlist')
		expect(html).toContain('I already joined')
		expect(html).toContain('data-testid="waitlist-embed-button"')
	})
})
