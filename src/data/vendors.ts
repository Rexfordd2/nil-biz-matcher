export type VendorCategory =
	| 'photographer'
	| 'videographer'
	| 'editor'
	| 'graphic_designer'
	| 'brand_strategist'
	| 'social_media_manager'
	| 'legal_tax_pro'
	| 'trainer_coach'
	| 'event_planner'
	| 'other'

export type VendorProfile = {
	id: string
	name: string
	category: VendorCategory
	location?: string
	remoteOk?: boolean
	websiteUrl?: string
	contactEmail?: string
	socialHandle?: string
	notes?: string
}

export const VENDOR_CATEGORIES: { value: VendorCategory; label: string }[] = [
	{ value: 'photographer', label: 'Photographer' },
	{ value: 'videographer', label: 'Videographer' },
	{ value: 'editor', label: 'Editor' },
	{ value: 'graphic_designer', label: 'Graphic Designer' },
	{ value: 'brand_strategist', label: 'Brand Strategist' },
	{ value: 'social_media_manager', label: 'Social Media Manager' },
	{ value: 'legal_tax_pro', label: 'Legal / Tax Pro' },
	{ value: 'trainer_coach', label: 'Trainer / Coach' },
	{ value: 'event_planner', label: 'Event Planner' },
	{ value: 'other', label: 'Other' }
]

// Initial static sample data; replace/extend as needed.
export const VENDORS: VendorProfile[] = [
	{
		id: 'ven-photog-1',
		name: 'Northside Sports Photography',
		category: 'photographer',
		location: 'Columbus, OH',
		remoteOk: false,
		websiteUrl: 'https://example.com/northside-photo',
		socialHandle: '@northsidephoto',
		notes: 'Game-day photos and personal brand shoots. HS-friendly packages.'
	},
	{
		id: 'ven-video-1',
		name: 'Highlight Labs',
		category: 'videographer',
		location: 'Remote',
		remoteOk: true,
		websiteUrl: 'https://example.com/highlight-labs',
		contactEmail: 'contact@highlightlabs.io',
		notes: 'Edits from user-submitted clips. Fast turnaround highlight reels.'
	},
	{
		id: 'ven-editor-1',
		name: 'ClipCraft Editors',
		category: 'editor',
		remoteOk: true,
		socialHandle: '@clipcraft',
		notes: 'Short-form editing for TikTok/Reels. Monthly buckets available.'
	},
	{
		id: 'ven-design-1',
		name: 'Studio T Graphics',
		category: 'graphic_designer',
		location: 'Austin, TX',
		websiteUrl: 'https://example.com/studiot',
		notes: 'Logos, thumbnails, and social templates for young creators.'
	},
	{
		id: 'ven-legal-1',
		name: 'NextGen Tax & Legal (Educational)',
		category: 'legal_tax_pro',
		remoteOk: true,
		websiteUrl: 'https://example.com/nextgen',
		notes: 'Educational consults around 1099s and basic entity setup. Not legal advice.'
	},
	{
		id: 'ven-trainer-1',
		name: 'Velocity Performance',
		category: 'trainer_coach',
		location: 'Cincinnati, OH',
		websiteUrl: 'https://example.com/velocity',
		notes: 'Speed and agility for multi-sport athletes; small group sessions.'
	}
]


