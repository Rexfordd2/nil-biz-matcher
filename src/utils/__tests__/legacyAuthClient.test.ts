import { afterEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, string>()
const localStorageStub = {
	getItem: (k: string) => store.get(k) ?? null,
	setItem: (k: string, v: string) => void store.set(k, v),
	removeItem: (k: string) => void store.delete(k),
	clear: () => store.clear(),
	key: (i: number) => Array.from(store.keys())[i] ?? null,
	get length() { return store.size },
}

async function loadAuth(dev: boolean) {
	vi.resetModules()
	vi.stubEnv('DEV', dev)
	vi.stubGlobal('localStorage', localStorageStub)
	vi.stubGlobal('window', { localStorage: localStorageStub })
	vi.stubGlobal('fetch', vi.fn(async () => new Response(
		JSON.stringify({ code: 'LEGACY_AUTH_DISABLED' }), { status: 410 })))
	return import('../auth')
}

afterEach(() => {
	vi.unstubAllEnvs()
	vi.unstubAllGlobals()
	store.clear()
})

describe('legacy browser auth in production builds', () => {
	it('register and login do not fall back to simulated local users', async () => {
		const auth = await loadAuth(false)
		await expect(auth.authRegister({ email: 'synthetic@example.invalid', fullName: 'Synthetic' }))
			.rejects.toThrow(/Legacy sign-in is disabled/)
		await expect(auth.authLogin({ email: 'synthetic@example.invalid' }))
			.rejects.toThrow(/Legacy sign-in is disabled/)
		expect(store.size).toBe(0)
	})

	it('authMe returns no user even when a simulated local user is stored', async () => {
		const dev = await loadAuth(true)
		await dev.authRegister({ email: 'synthetic@example.invalid', fullName: 'Synthetic' })
		expect(store.size).toBeGreaterThan(0)
		const prod = await loadAuth(false)
		expect(await prod.authMe()).toBeNull()
	})
})

describe('legacy browser auth in development builds', () => {
	it('keeps the offline simulated user for local development', async () => {
		const auth = await loadAuth(true)
		const user = await auth.authRegister({ email: 'synthetic@example.invalid', fullName: 'Synthetic' })
		expect(user.email).toBe('synthetic@example.invalid')
		expect((await auth.authLogin({ email: 'synthetic@example.invalid' })).email).toBe('synthetic@example.invalid')
	})
})
