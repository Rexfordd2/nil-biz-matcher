import { beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
	FINANCE_CHECKLIST_DEFAULTS,
	FINANCE_CHECKLIST_KEY,
	loadFinanceChecklist,
	normalizeFinanceChecklist,
	saveFinanceChecklist,
} from '../financeChecklist'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

describe('finance checklist', () => {
	beforeEach(() => {
		const store = new Map<string, string>()
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
			setItem: (key: string, value: string) => {
				store.set(key, value)
			},
			removeItem: (key: string) => {
				store.delete(key)
			},
			clear: () => store.clear(),
			key: () => null,
			length: 0,
		})
	})

	it('uses the exact finance.checklist storage key', () => {
		expect(FINANCE_CHECKLIST_KEY).toBe('finance.checklist')
		const src = fs.readFileSync(path.join(root, 'utils/financeChecklist.ts'), 'utf8')
		expect(src).toContain("'finance.checklist'")
		const page = fs.readFileSync(path.join(root, 'pages/NILHub.tsx'), 'utf8')
		expect(page).toContain('loadFinanceChecklist')
		expect(page).toContain('saveFinanceChecklist')
		expect(page).toContain('NIL Money Readiness')
	})

	it('loads defaults when nothing is stored', () => {
		expect(loadFinanceChecklist()).toEqual(FINANCE_CHECKLIST_DEFAULTS)
	})

	it('normalizes previously shaped checklist state', () => {
		expect(
			normalizeFinanceChecklist({
				export_log: true,
				collect_payments: 'yes',
				tax_docs: 1,
				talk_cpa: false,
				review_llc: true,
				extra_field: true,
			})
		).toEqual({
			export_log: true,
			collect_payments: false,
			tax_docs: false,
			talk_cpa: false,
			review_llc: true,
		})
	})

	it('persists toggles under finance.checklist', () => {
		saveFinanceChecklist({
			...FINANCE_CHECKLIST_DEFAULTS,
			export_log: true,
			talk_cpa: true,
		})
		const raw = localStorage.getItem('finance.checklist')
		expect(raw).toBeTruthy()
		expect(JSON.parse(raw!)).toEqual({
			export_log: true,
			collect_payments: false,
			tax_docs: false,
			talk_cpa: true,
			review_llc: false,
		})
		expect(loadFinanceChecklist().export_log).toBe(true)
		expect(loadFinanceChecklist().talk_cpa).toBe(true)
	})

	it('does not store dollar amounts or sensitive financial identifiers', () => {
		saveFinanceChecklist({
			...FINANCE_CHECKLIST_DEFAULTS,
			tax_docs: true,
		})
		const raw = localStorage.getItem('finance.checklist') || ''
		expect(raw).not.toMatch(/\$|EIN|SSN|routing|account number|tax id/i)
	})
})
