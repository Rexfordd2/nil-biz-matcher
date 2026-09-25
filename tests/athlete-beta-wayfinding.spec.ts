import { test, expect, type Page, type BrowserContext } from '@playwright/test'

/**
 * Athlete beta wayfinding: onboarding focus, Today next action, reduced athlete
 * nav, Outreach Drafts safety, and the Athlete Houze handoff.
 *
 * Signed-in flows use a locally-stubbed Supabase project (no network). Build:
 *
 *   VITE_APP_MODE=beta VITE_E2E_BYPASS_AUTH=true VITE_PUBLIC_MODE=true \
 *   VITE_ALLOW_MISSING_GOOGLE_MAPS_KEY=true \
 *   VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=e2e-anon-key \
 *   npm run build
 *   npx vite preview --host 127.0.0.1 --port 4173
 *   BASE_URL=http://127.0.0.1:4173 npx playwright test tests/athlete-beta-wayfinding.spec.ts
 */

const SUPABASE_ORIGIN = 'http://127.0.0.1:54321'
const SESSION_KEY = 'sb-127-auth-token'
const WIDTHS = [390, 768, 1440] as const

type Meta = Record<string, unknown>

function b64url(obj: unknown): string {
	return Buffer.from(JSON.stringify(obj)).toString('base64url')
}

function fakeJwt(userId: string): string {
	const exp = Math.floor(Date.now() / 1000) + 3600
	return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: userId, exp, role: 'authenticated', aud: 'authenticated' })}.sig`
}

type StubState = {
	user: { id: string; email: string; user_metadata: Meta; app_metadata: Meta; aud: string; role: string; created_at: string }
	updates: Meta[]
	sendRequests: string[]
}

async function signIn(
	context: BrowserContext,
	opts: { userId: string; userMetadata: Meta; contacts?: Array<{ id: string; name: string; email: string }> }
): Promise<StubState> {
	const state: StubState = {
		user: {
			id: opts.userId,
			email: `${opts.userId}@example.test`,
			user_metadata: { full_name: 'Jordan Lee', ...opts.userMetadata },
			app_metadata: { provider: 'email' },
			aud: 'authenticated',
			role: 'authenticated',
			created_at: '2026-01-01T00:00:00Z',
		},
		updates: [],
		sendRequests: [],
	}
	const token = fakeJwt(opts.userId)
	const session = {
		access_token: token,
		refresh_token: 'e2e-refresh',
		token_type: 'bearer',
		expires_in: 3600,
		expires_at: Math.floor(Date.now() / 1000) + 3600,
		user: state.user,
	}
	await context.addInitScript(
		([key, value]) => {
			if (!localStorage.getItem(key)) localStorage.setItem(key, value)
		},
		[SESSION_KEY, JSON.stringify(session)] as const
	)

	const contacts = opts.contacts ?? []
	await context.route(`${SUPABASE_ORIGIN}/**`, async route => {
		const req = route.request()
		const url = new URL(req.url())
		if (url.pathname === '/auth/v1/user' && req.method() === 'PUT') {
			const body = req.postDataJSON() as { data?: Meta }
			state.updates.push(body?.data || {})
			state.user = { ...state.user, user_metadata: { ...state.user.user_metadata, ...(body?.data || {}) } }
			return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.user) })
		}
		if (url.pathname === '/auth/v1/user') {
			return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.user) })
		}
		if (url.pathname === '/rest/v1/user_targets') {
			const rows = contacts.length ? [{ org_id: 'org-1' }] : []
			return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) })
		}
		if (url.pathname === '/rest/v1/orgs') {
			return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'org-1', name: 'State University' }]) })
		}
		if (url.pathname === '/rest/v1/org_contacts') {
			const rows = contacts.map(c => ({ ...c, org_id: 'org-1' }))
			return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) })
		}
		if (url.pathname.startsWith('/rest/v1/')) {
			return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
		}
		return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
	})
	await context.route('**/api/recruiting/send', async route => {
		state.sendRequests.push(route.request().method())
		return route.fulfill({ status: 404, body: 'not found' })
	})
	return state
}

async function primaryNavLabels(page: Page, width: number): Promise<string[]> {
	if (width < 768) {
		return (await page.getByTestId('mobile-bottom-nav').locator('button').allTextContents()).map(t => t.trim())
	}
	const sidebar = page.getByTestId('app-sidebar')
	return (await sidebar.locator('nav > div').first().locator('button').allTextContents()).map(t => t.trim())
}

async function expectNoHorizontalOverflow(page: Page) {
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
	expect(overflow).toBeLessThanOrEqual(1)
}

for (const width of WIDTHS) {
	test.describe(`athlete beta wayfinding @ ${width}px`, () => {
		test.use({ viewport: { width, height: 900 } })

		test('under-18 first run: recruiting focus → Today with one next action and guardian note', async ({ page, context }) => {
			const stub = await signIn(context, { userId: `minor-${width}`, userMetadata: { role: 'athlete' } })
			await page.goto('/onboarding')
			await expect(page.getByTestId('onboarding-page')).toBeVisible({ timeout: 15000 })
			await expect(page.getByTestId('onboarding-intent-step')).toContainText('What are you here to work on first?')
			await expect(page.getByTestId('onboarding-intent-recruiting')).toBeDisabled()

			await page.getByTestId('onboarding-role-athlete_under_18').check()
			await expect(page.getByTestId('onboarding-save-role')).toBeDisabled()
			await page.getByTestId('onboarding-guardian-ack').check()
			await page.getByTestId('onboarding-save-role').click()

			await page.getByTestId('onboarding-intent-recruiting').check()
			await page.getByTestId('onboarding-save-intent').click()
			await page.waitForURL(/\/app\/today$/, { timeout: 15000 })

			expect(stub.updates[0]).toMatchObject({ role: 'athlete_under_18', guardianRequired: true })
			expect(stub.updates[1]).toMatchObject({ onboardingIntent: 'recruiting' })
			expect(await page.evaluate(k => localStorage.getItem(k), `athleteLedger:onboarding:intent:minor-${width}`)).toBe('recruiting')

			const card = page.getByTestId('today-next-action')
			await expect(card).toBeVisible()
			await expect(page.getByTestId('today-track')).toHaveText('Recruiting')
			await expect(page.getByTestId('today-progress')).toHaveText('Step 1 of 3')
			await expect(page.getByTestId('today-next-action-title')).toContainText('Athlete Passport')
			await expect(page.getByTestId('today-next-action-why')).not.toBeEmpty()
			await expect(page.getByTestId('today-next-action-done-when')).not.toBeEmpty()
			await expect(page.getByTestId('today-guardian-note')).toContainText('parent or guardian')
			const box = await card.boundingBox()
			expect(box && box.y + Math.min(box.height, 200)).toBeLessThan(900)

			const labels = await primaryNavLabels(page, width)
			expect(labels.join('|')).not.toMatch(/Network|Career/)
			if (width < 768) {
				expect(labels).toEqual(['Today', 'Passport', 'Recruiting', 'Opps', 'More'])
			} else {
				expect(labels).toEqual(['Today', 'Athlete Passport', 'Recruiting', 'Opportunities'])
				await expect(page.getByTestId('nav-section-toggle-more-explore')).toHaveAttribute('aria-expanded', 'false')
				await page.getByTestId('nav-section-toggle-more-explore').click()
				await expect(page.getByTestId('nav-network')).toBeVisible()
				await expect(page.getByTestId('nav-career')).toBeVisible()
				await expect(page.getByTestId('nav-learn')).toBeVisible()
			}
			await expectNoHorizontalOverflow(page)
			await page.screenshot({ path: `test-results/wayfinding-minor-today-${width}.png`, fullPage: false })
		})

		test('minor cannot bulk-send coach email; legacy blast URL opens Outreach Drafts', async ({ page, context }) => {
			const stub = await signIn(context, {
				userId: `minor-drafts-${width}`,
				userMetadata: { role: 'athlete_under_18', guardianRequired: true, onboardingIntent: 'recruiting' },
				contacts: [
					{ id: 'c1', name: 'Pat Smith', email: 'pat@state.edu' },
					{ id: 'c2', name: 'Alex Jones', email: 'alex@state.edu' },
				],
			})
			await page.goto('/app/recruiting/blast')
			await page.waitForURL(/\/app\/recruiting\/drafts$/, { timeout: 15000 })
			await expect(page.getByRole('heading', { name: 'Outreach Drafts' })).toBeVisible()
			await expect(page.getByTestId('outreach-minor-notice')).toBeVisible()
			await expect(page.getByText('Recipients (from My Targets)')).toBeVisible()
			await expect(page.getByTestId('outreach-recipients').locator('li')).toHaveCount(2)

			const body = (await page.locator('body').textContent()) || ''
			expect(body).not.toContain('Select all')
			expect(body).not.toContain('Send Blast')
			expect(body).not.toContain('Recruiting Blast')

			await page.getByTestId('outreach-recipients').locator('input[type="checkbox"]').nth(0).check()
			await page.getByTestId('outreach-recipients').locator('input[type="checkbox"]').nth(1).check()
			await expect(page.getByTestId('outreach-review-c1')).toContainText('Hi Coach Smith')
			await expect(page.getByTestId('outreach-review-c2')).toContainText('Hi Coach Jones')
			await expect(page.getByRole('button', { name: /send/i })).toHaveCount(0)
			expect(stub.sendRequests).toEqual([])
			await expect(page.getByTestId('recruiting-subnav-drafts')).toHaveAttribute('aria-current', 'page')
			await expectNoHorizontalOverflow(page)
			await page.screenshot({ path: `test-results/wayfinding-minor-drafts-${width}.png`, fullPage: false })
		})

		test('adult athlete first run: NIL focus drives the first recommendation', async ({ page, context }) => {
			const stub = await signIn(context, { userId: `adult-${width}`, userMetadata: { role: 'athlete' } })
			await page.goto('/onboarding')
			await page.getByTestId('onboarding-role-athlete_18_plus').check()
			await page.getByTestId('onboarding-save-role').click()
			await page.getByTestId('onboarding-intent-nil_identity').check()
			await page.getByTestId('onboarding-save-intent').click()
			await page.waitForURL(/\/app\/today$/, { timeout: 15000 })

			expect(stub.updates[0]).toMatchObject({ role: 'athlete_18_plus', guardianRequired: false })
			expect(stub.updates[1]).toMatchObject({ onboardingIntent: 'nil_identity' })
			await expect(page.getByTestId('today-track')).toHaveText('NIL & profile identity')
			await expect(page.getByTestId('today-progress')).toHaveText('Step 1 of 3')
			await expect(page.getByTestId('today-guardian-note')).toHaveCount(0)
			await page.getByTestId('today-next-action-cta').click()
			await page.waitForURL(/\/app\/passport\/profile$/)
			await expectNoHorizontalOverflow(page)
		})

		test('parent/guardian: no athlete focus step, guardian action on Today, full navigation', async ({ page, context }) => {
			const stub = await signIn(context, { userId: `parent-${width}`, userMetadata: { role: 'parent' } })
			await page.goto('/onboarding?returnTo=https://evil.example/phish')
			await page.getByTestId('onboarding-role-parent_guardian').check()
			await expect(page.getByTestId('onboarding-intent-step')).toHaveCount(0)
			await page.getByTestId('onboarding-save-role').click()
			await expect(page.getByTestId('onboarding-complete')).toBeVisible()
			expect(stub.updates[0]).toMatchObject({ role: 'parent_guardian', guardianRequired: false })
			expect(stub.updates[0]).not.toHaveProperty('onboardingIntent')
			await page.getByTestId('onboarding-go-app').click()
			await page.waitForURL(/127\.0\.0\.1:4173\/app\/today$|localhost:4173\/app\/today$/, { timeout: 15000 })

			await expect(page.getByTestId('today-track')).toHaveText('Parent / guardian')
			await expect(page.getByTestId('today-next-action-title')).toContainText('NIL rules')
			await expect(page.getByTestId('today-progress')).toHaveCount(0)
			const labels = await primaryNavLabels(page, width)
			expect(labels.join('|')).toContain('Network')
			await expectNoHorizontalOverflow(page)
		})

		test('source=athlete-houze shows context, fixed return path, and honest sync status', async ({ page }) => {
			await page.goto('/app/today?source=athlete-houze&returnTo=https://evil.example&return_url=//evil.example&redirect=https://evil.example')
			const banner = page.getByTestId('athlete-houze-handoff')
			await expect(banner).toBeVisible({ timeout: 15000 })
			await expect(page.getByTestId('athlete-houze-handoff-label')).toHaveText('Opened from Athlete Houze')
			await expect(page.getByTestId('athlete-houze-sync-status')).toHaveText(
				'Your work is saved in NIL Roster. Athlete Houze is not automatically syncing this activity yet.'
			)
			const link = page.getByTestId('athlete-houze-return')
			await expect(link).toHaveText('Return to Athlete Houze')
			await expect(link).toHaveAttribute('href', 'https://athletehouze.com')
			expect((await banner.textContent())?.toLowerCase()).not.toContain('connected')
			expect(await page.locator('a[href*="evil"]').count()).toBe(0)

			if (width < 768) await page.getByTestId('mobile-nav-recruiting').click()
			else await page.getByTestId('nav-recruiting').click()
			await page.waitForURL(/\/app\/recruiting\/search$/)
			await expect(page.getByTestId('athlete-houze-return')).toHaveAttribute('href', 'https://athletehouze.com')
			await expectNoHorizontalOverflow(page)
			await page.screenshot({ path: `test-results/wayfinding-houze-${width}.png`, fullPage: false })

			const [request] = await Promise.all([
				page.waitForRequest(r => r.url().startsWith('https://athletehouze.com'), { timeout: 10000 }),
				page.route('https://athletehouze.com/**', r => r.fulfill({ status: 200, body: 'Athlete Houze' })),
				link.click(),
			])
			expect(new URL(request.url()).origin).toBe('https://athletehouze.com')
		})

		test('no handoff banner without source=athlete-houze (spoofed values ignored)', async ({ page }) => {
			await page.goto('/app/today?source=https://evil.example')
			await expect(page.getByTestId('today-next-action')).toBeVisible({ timeout: 15000 })
			await expect(page.getByTestId('athlete-houze-handoff')).toHaveCount(0)
		})

		test('saved profile, recruiting list, opportunities, and drafts persist and drive Today', async ({ page, context }) => {
			const userId = `persist-${width}`
			await signIn(context, { userId, userMetadata: { role: 'athlete_18_plus', onboardingIntent: 'recruiting' } })
			await context.addInitScript(() => {
				if (localStorage.getItem('e2e:seeded')) return
				localStorage.setItem('e2e:seeded', '1')
				localStorage.setItem(
					'athlete',
					JSON.stringify({
						id: 'ath-1',
						name: 'Jordan Lee',
						school: 'Central High',
						schoolLevel: 'High School',
						sports: [{ sportName: 'Soccer', positions: ['Forward'] }],
						socialHandles: [],
						contentStyles: [],
						personality: '',
						values: [],
						timePerWeekHours: 3,
						professionalism: 'Medium',
					})
				)
				localStorage.setItem(
					'recruiting_v2.store.v1',
					JSON.stringify({
						version: 1,
						contactsByPlaceId: {
							p1: {
								placeId: 'p1',
								starred: true,
								status: 'Shortlisted',
								notes: 'Visit in spring',
								lastContactedAt: null,
								createdAt: '2026-01-01T00:00:00Z',
								updatedAt: '2026-01-01T00:00:00Z',
								place: { name: 'State University', formattedAddress: 'Somewhere' },
							},
						},
					})
				)
				localStorage.setItem('opps.store', JSON.stringify({ 'ath-1': [{ id: 'o1', athleteId: 'ath-1', title: 'Local gym', category: 'local_brand_deal', status: 'idea' }] }))
			})

			await page.goto('/app/today')
			await expect(page.getByTestId('today-progress')).toHaveText('Step 3 of 3', { timeout: 15000 })
			await expect(page.getByTestId('today-next-action-title')).toContainText('outreach draft')
			await page.getByTestId('today-next-action-cta').click()
			await page.waitForURL(/\/app\/recruiting\/drafts$/)
			await page.getByTestId('outreach-subject').fill('Interest in State University soccer')
			await page.getByTestId('outreach-save-draft').click()
			await expect(page.getByTestId('outreach-saved-drafts')).toContainText('Interest in State University soccer')

			await page.reload()
			await expect(page.getByTestId('outreach-saved-drafts')).toContainText('Interest in State University soccer', { timeout: 15000 })

			await page.goto('/app/today')
			await expect(page.getByTestId('today-progress')).toHaveText('All 3 steps done', { timeout: 15000 })

			const stored = await page.evaluate(() => ({
				athlete: JSON.parse(localStorage.getItem('athlete') || 'null'),
				recruiting: JSON.parse(localStorage.getItem('recruiting_v2.store.v1') || 'null'),
				opps: JSON.parse(localStorage.getItem('opps.store') || 'null'),
			}))
			expect(stored.athlete?.name).toBe('Jordan Lee')
			expect(stored.recruiting?.contactsByPlaceId?.p1?.notes).toBe('Visit in spring')
			expect(stored.opps?.['ath-1']?.[0]?.title).toBe('Local gym')

			await page.goto('/app/recruiting/board')
			await expect(page.getByText('To Contact')).toBeVisible()
			await expect(page.getByTestId('recruiting-subnav')).toBeVisible()
		})
	})
}
