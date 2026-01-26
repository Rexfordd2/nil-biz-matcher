import { defineConfig, devices } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:4173'

export default defineConfig({
	testDir: 'tests',
	fullyParallel: false,
	use: {
		baseURL: BASE_URL,
		trace: 'on-first-retry',
	},
	reporter: [['list']],
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
})


