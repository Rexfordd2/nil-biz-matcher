// Utility to update meta tags dynamically for SEO and Open Graph

type MetaTag = {
	name?: string
	property?: string
	content: string
}

export function updateMetaTags(tags: MetaTag[]): void {
	tags.forEach(tag => {
		let element: HTMLMetaElement | null = null
		
		if (tag.name) {
			element = document.querySelector(`meta[name="${tag.name}"]`)
		} else if (tag.property) {
			element = document.querySelector(`meta[property="${tag.property}"]`)
		}
		
		if (!element) {
			element = document.createElement('meta')
			if (tag.name) {
				element.setAttribute('name', tag.name)
			} else if (tag.property) {
				element.setAttribute('property', tag.property)
			}
			document.head.appendChild(element)
		}
		
		element.setAttribute('content', tag.content)
	})
}

export function updateTitle(title: string): void {
	document.title = title
}

export function setOpenGraphTags(params: {
	title: string
	description: string
	url?: string
	image?: string
	type?: string
}): void {
	const baseUrl = window.location.origin
	const tags: MetaTag[] = [
		{ property: 'og:title', content: params.title },
		{ property: 'og:description', content: params.description },
		{ property: 'og:type', content: params.type || 'website' },
		{ property: 'og:url', content: params.url || window.location.href },
		{ name: 'twitter:card', content: 'summary_large_image' },
		{ name: 'twitter:title', content: params.title },
		{ name: 'twitter:description', content: params.description },
	]
	
	if (params.image) {
		tags.push(
			{ property: 'og:image', content: params.image.startsWith('http') ? params.image : `${baseUrl}${params.image}` },
			{ name: 'twitter:image', content: params.image.startsWith('http') ? params.image : `${baseUrl}${params.image}` }
		)
	}
	
	updateMetaTags(tags)
	updateTitle(params.title)
}
