import { Business, SocialHandle } from '../types'

function normalizeUrl(input: string): string | undefined {
	try {
		const u = new URL(input)
		if (!u.protocol) return undefined
		return u.toString()
	} catch {
		return undefined
	}
}

function extractMeta(doc: Document, name: string, attr = 'content'): string | undefined {
	const byName = doc.querySelector(`meta[name="${name}"]`)
	if (byName && byName.getAttribute(attr)) return byName.getAttribute(attr) || undefined
	const byProp = doc.querySelector(`meta[property="${name}"]`)
	if (byProp && byProp.getAttribute(attr)) return byProp.getAttribute(attr) || undefined
	return undefined
}

function extractSocial(doc: Document): { links: string[]; handles: SocialHandle[] } {
	const anchors = Array.from(doc.querySelectorAll('a[href]')) as HTMLAnchorElement[]
	const links: string[] = []
	const handles: SocialHandle[] = []
	const push = (platform: string, url: string) => {
		links.push(url)
		const handle = url.split('/').filter(Boolean).pop() || ''
		handles.push({ platform, handle: handle.startsWith('@') ? handle : '@' + handle, url })
	}
	for (const a of anchors) {
		const href = a.href
		if (/instagram\.com/i.test(href)) push('Instagram', href)
		else if (/tiktok\.com/i.test(href)) push('TikTok', href)
		else if (/youtube\.com|youtu\.be/i.test(href)) push('YouTube', href)
		else if (/twitter\.com|x\.com/i.test(href)) push('Twitter/X', href)
		else if (/facebook\.com/i.test(href)) push('Facebook', href)
		else if (/twitch\.tv/i.test(href)) push('Twitch', href)
		else if (/snapchat\.com/i.test(href)) push('Snapchat', href)
	}
	return { links: Array.from(new Set(links)), handles }
}

export async function importBusinessFromUrl(url: string): Promise<Partial<Business>> {
	const normalized = normalizeUrl(url)
	if (!normalized) throw new Error('Invalid URL')
	try {
		const res = await fetch(normalized, { mode: 'cors' })
		const html = await res.text()
		const doc = new DOMParser().parseFromString(html, 'text/html')
		const title = (doc.querySelector('title')?.textContent || '').trim()
		const metaTitle = extractMeta(doc, 'og:title') || extractMeta(doc, 'twitter:title') || title
		const description = (extractMeta(doc, 'description') || extractMeta(doc, 'og:description') || '').trim()
		const logoUrl = extractMeta(doc, 'og:image') || undefined
		const { links, handles } = extractSocial(doc)

		// Try naive location extraction from visible text
		let location: string | undefined
		const bodyText = doc.body?.textContent || ''
		const matchCityState = bodyText.match(/\b([A-Z][a-zA-Z]+),\s*([A-Z]{2})\b/)
		if (matchCityState) location = `${matchCityState[1]}, ${matchCityState[2]}`

		return {
			name: metaTitle || title || new URL(normalized).hostname,
			description: description || undefined,
			url: normalized,
			website: normalized,
			logoUrl,
			location,
			socialLinks: links,
			socialHandles: handles
		}
	} catch (e) {
		// CORS or parsing failure
		throw new Error('Import failed')
	}
}


