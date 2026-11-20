import { defineConfig, devices } from '@playwright/test'

// Workers restart after a failure; keep one set of synthetic accounts per run.
process.env.ACCEPTANCE_RUN_ID ||= Date.now().toString(36)

export default defineConfig({
	testDir: '.',
	fullyParallel: false,
	workers: 1,
	reporter: [['list']],
	outputDir: process.env.ACCEPTANCE_OUTPUT_DIR || '../../../test-results/acceptance',
	use: {
		baseURL: process.env.BASE_URL,
		video: process.env.ACCEPTANCE_VIDEO ? { mode: 'on', size: { width: 1280, height: 800 } } : 'off',
		viewport: { width: 1280, height: 800 },
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } }],
})
