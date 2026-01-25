import { chromium } from 'playwright';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const ARTIFACTS_DIR = './smoke-artifacts';
if (!existsSync(ARTIFACTS_DIR)) {
	mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
	await page.goto('https://athlete-ledger.vercel.app/app', { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(3000);
	
	const currentUrl = page.url();
	if (!currentUrl.includes('/auth/login')) {
		throw new Error('Expected redirect to /auth/login but got: ' + currentUrl);
	}
	
	const loginStatusExists = await page.evaluate(() => {
		return !!document.querySelector('[data-testid="login-status"]');
	});
	
	if (!loginStatusExists) {
		const screenshotPath = join(ARTIFACTS_DIR, 'prod-login-page.png');
		await page.screenshot({ path: screenshotPath, fullPage: true });
		console.log('PROD_DOM_PROOF: FAIL');
		console.log('Screenshot: ' + screenshotPath);
		throw new Error('DEPLOY_PROOF_FAILED: login-status not present on prod');
	}
	
	const screenshotPath = join(ARTIFACTS_DIR, 'prod-login-page.png');
	await page.screenshot({ path: screenshotPath, fullPage: true });
	console.log('PROD_DOM_PROOF: PASS');
	console.log('Screenshot: ' + screenshotPath);
} finally {
	await browser.close();
}
