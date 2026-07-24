import { load, save } from './storage'

/** Existing localStorage key — do not rename. Stores checklist completion booleans only. */
export const FINANCE_CHECKLIST_KEY = 'finance.checklist'

export type FinanceChecklistState = {
	export_log: boolean
	collect_payments: boolean
	tax_docs: boolean
	talk_cpa: boolean
	review_llc: boolean
}

export const FINANCE_CHECKLIST_DEFAULTS: FinanceChecklistState = {
	export_log: false,
	collect_payments: false,
	tax_docs: false,
	talk_cpa: false,
	review_llc: false,
}

export const FINANCE_CHECKLIST_ITEMS: Array<{
	key: keyof FinanceChecklistState
	label: string
}> = [
	{ key: 'export_log', label: 'Export deal log for this year' },
	{ key: 'collect_payments', label: 'Collect payment records (bank/account statements)' },
	{ key: 'tax_docs', label: 'Collect W-9 / 1099 / platform summaries' },
	{
		key: 'talk_cpa',
		label: 'Talk to a CPA about state/local taxes, self-employment taxes, deductible expenses',
	},
	{
		key: 'review_llc',
		label: 'Review whether an LLC/EIN is appropriate with a professional',
	},
]

function asBool(value: unknown): boolean {
	return value === true
}

/** Normalize previously saved checklist shapes into the known boolean keys. */
export function normalizeFinanceChecklist(raw: unknown): FinanceChecklistState {
	const src =
		raw && typeof raw === 'object' && !Array.isArray(raw)
			? (raw as Record<string, unknown>)
			: {}
	return {
		export_log: asBool(src.export_log),
		collect_payments: asBool(src.collect_payments),
		tax_docs: asBool(src.tax_docs),
		talk_cpa: asBool(src.talk_cpa),
		review_llc: asBool(src.review_llc),
	}
}

export function loadFinanceChecklist(): FinanceChecklistState {
	const raw = load<unknown>(FINANCE_CHECKLIST_KEY, FINANCE_CHECKLIST_DEFAULTS)
	return normalizeFinanceChecklist(raw)
}

export function saveFinanceChecklist(state: FinanceChecklistState): void {
	save(FINANCE_CHECKLIST_KEY, normalizeFinanceChecklist(state))
}
