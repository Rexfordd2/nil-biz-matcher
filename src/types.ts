export type SchoolLevel = 'Middle School' | 'High School' | 'College' | 'Post-Grad'
export type Professionalism = 'Emerging' | 'Developing' | 'Polished'

export type SocialHandle = {
	platform: string
	handle: string
	url?: string
}

export type AthleteSport = {
	sportName: string
	positions: string[]
}

export type AthleteProfile = {
	id: string
	name: string
	school: string
	schoolLevel: SchoolLevel
	/**
	 * Lowercase level string for generalized matching (e.g., "high school").
	 * Derived from schoolLevel when possible.
	 */
	level?: string
	/**
	 * Multi-sport with multi-positions per sport.
	 */
	sports: AthleteSport[]
	location?: string
	/**
	 * Backwards-compat: legacy aggregate social and followers.
	 */
	social?: {
		handle?: string
		link?: string
		followers?: number
	}
	/**
	 * Multiple social handles across platforms.
	 */
	socialHandles: SocialHandle[]
	/**
	 * Predefined multi-select styles as free text values.
	 */
	contentStyles: string[]
	personality: string
	values: string[]
	timePerWeekHours: number
	professionalism: Professionalism
	createdAt: number
}

export type BusinessLevel = 'LOCAL' | 'REGIONAL' | 'NATIONAL'

export type Business = {
	id: string
	name: string
	location: string
	/**
	 * Canonical business URL (normalized)
	 */
	url?: string
	website?: string
	logoUrl?: string
	/**
	 * Optional reference to an external provider record (e.g., Yelp).
	 */
	externalProvider?: 'yelp' | 'other'
	externalProviderId?: string
	phone?: string
	coordinates?: {
		latitude?: number
		longitude?: number
	}
	/**
	 * Structured social handles for the business.
	 */
	socialHandles?: SocialHandle[]
	/**
	 * Backwards-compat: legacy string links.
	 */
	socialLinks?: string[]
	description: string
	category?: string
	level?: BusinessLevel
	analysis?: BusinessAnalysis
	match?: MatchResult
	status?: 'Not Contacted' | 'Pending' | 'In Discussion' | 'Partnered'
	createdAt: number
}

export type BusinessAnalysis = {
	history: string
	intentMission: string
	mainGoals: string[]
	marketingNeeds: string[]
	levelGuess: BusinessLevel
}

export type FitRating = 'PERFECT FIT' | 'GOOD FIT' | 'STRETCH FIT' | 'POOR FIT'

export type MatchResult = {
	brandAlignment: number // 0-100
	audienceOverlap: number // 0-100
	practicalIntegration: number // 0-100
	score: number // 0-100
	rating: FitRating
	explanation: string
	recommendedLevels: BusinessLevel[]
}

export type OutreachBundle = {
	dm: string
	email: string
}


