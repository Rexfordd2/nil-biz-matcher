type CseApiItem = {
	title?: string
	snippet?: string
	link?: string
}

export type CseResult = {
	title: string
	snippet: string
	link: string
}

function getEnv(): { apiKey: string | undefined; cx: string | undefined } {
	// Vite exposes env at build-time
	const apiKey = import.meta.env.VITE_GOOGLE_CSE_API_KEY as string | undefined
	const cx = import.meta.env.VITE_GOOGLE_CSE_CX as string | undefined
	return { apiKey, cx }
}

export function isGoogleCseConfigured(): boolean {
	const { apiKey, cx } = getEnv()
	return Boolean(apiKey && apiKey.trim() && cx && cx.trim())
}

export async function searchWeb(query: string): Promise<Array<{ title: string; snippet: string; link: string }>> {
	const { apiKey, cx } = getEnv()
	if (!apiKey || !cx) {
		// Missing env: return empty (UI should surface a non-blocking note)
		return []
	}
	const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}`
	try {
		const resp = await fetch(url)
		if (!resp.ok) {
			return []
		}
		const data = await resp.json()
		const items: CseApiItem[] = Array.isArray(data?.items) ? data.items : []
		return items
			.map(it => ({
				title: String(it?.title ?? ''),
				snippet: String(it?.snippet ?? ''),
				link: String(it?.link ?? '')
			}))
			.filter(r => r.link)
	} catch {
		return []
	}
}

// Back-compat for existing imports
export async function searchContacts(query: string): Promise<CseResult[]> {
	return searchWeb(query)
}
