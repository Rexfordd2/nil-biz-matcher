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

export type MediaKit = {
	heroImages: string[] // URLs or data URLs to uploaded images
	logos: string[] // URLs or data URLs to logos
	brandColors: string[] // hex codes or CSS color strings
	samplePosts: string[] // short descriptions or captions
	externalDeckUrl?: string // optional link to a PDF or doc
}

export type SupportContact = {
	role:
		| 'head_coach'
		| 'position_coach'
		| 'strength_coach'
		| 'athletic_trainer'
		| 'physical_therapist'
		| 'skill_trainer'
		| 'speed_coach'
		| 'sport_psych'
		| 'recovery_specialist'
		| 'other'
	name: string
	organization?: string
	email?: string
	phone?: string
	notes?: string
}

export type TrustedContact = {
	role: 'parent_guardian' | 'mentor' | 'advisor' | 'coach' | 'other'
	name: string
	relationship?: string
	email?: string
	phone?: string
}

export type AcademicProfile = {
	schoolName?: string
	level?: 'middle_school' | 'high_school' | 'college_prep' | string
	gpaRange?: 'below_2_5' | '2_5_to_3_0' | '3_0_to_3_5' | '3_5_plus' | 'prefer_not_to_say'
	academicInterests?: string[]
	advisorName?: string
	advisorEmail?: string
}

export type AvailabilityWindow = {
	label: string // e.g. "Weekday evenings", "Sunday afternoons"
	days?: string[] // e.g. ["Mon", "Wed"]
	timeRange?: string // free text like "5–8pm"
}

export type PerformanceStory = {
	keyMilestones: string[] // big games, awards, stats
	currentFocus?: string // e.g. "Off-season speed & route-running"
	futureGoals?: string[] // e.g. "College D1 WR", "National team"
}

export type TrainingLogEntry = {
	date: string // ISO date
	type: 'strength' | 'conditioning' | 'skill' | 'recovery' | 'film' | 'other'
	description: string
	durationMinutes?: number
	perceivedIntensity?: 'easy' | 'moderate' | 'hard'
}

export type TrainingLog = {
	entries: TrainingLogEntry[]
}

export type OpportunityStatus = 'idea' | 'targeted' | 'pitched' | 'in_discussion' | 'launched' | 'archived'

export type OpportunityCategory =
	| 'local_brand_deal'
	| 'regional_brand_deal'
	| 'national_brand_deal'
	| 'camp_clinic'
	| 'appearance'
	| 'digital_product'
	| 'merch_drop'
	| 'charity_event'
	| 'other'

export type Opportunity = {
	id: string
	athleteId: string
	title: string
	category: OpportunityCategory
	description?: string
	targetBrandName?: string
	linkedDealId?: string
	status: OpportunityStatus
	expectedStartDate?: string
	expectedEndDate?: string
	notes?: string
}

export type EventType = 'appearance' | 'signing' | 'charity_event' | 'camp_clinic' | 'other'

export type EventPlan = {
	id: string
	athleteId: string
	type: EventType
	name: string
	date: string
	location: string
	hostOrganization?: string
	expectedAttendees?: number
	sponsors?: string[]
	runOfShowUrl?: string
	waiversUrl?: string
	notes?: string
	linkedDealId?: string
}

export type SecurityChecklist = {
	uniquePasswordsChecked: boolean
	twoFactorEnabled: boolean
	backupEmailsOrPhonesSet: boolean
	accountSharingReviewed: boolean
	lastReviewedAt?: string
}

export type ReputationScan = {
	lastGoogleSearchDate?: string
	platformsChecked?: string[]
	impersonationFound?: boolean
	negativePressFound?: boolean
	notes?: string
}

export type IncidentType =
	| 'harassment'
	| 'account_hacked'
	| 'impersonation'
	| 'inappropriate_post'
	| 'negative_press'
	| 'other'

export type IncidentLogEntry = {
	id: string
	athleteId: string
	date: string
	type: IncidentType
	platformOrLocation?: string
	summary: string
	actionsTaken?: string
	resolved?: boolean
}

export type AthleteRiskProfile = {
	securityChecklist?: SecurityChecklist
	lastReputationScan?: ReputationScan
	incidents?: IncidentLogEntry[]
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
	/**
	 * Optional media kit with visual brand assets and examples.
	 */
	mediaKit?: MediaKit
	/**
	 * Extended support and personal context
	 */
	supportTeam?: SupportContact[]
	trustedCircle?: TrustedContact[]
	academicProfile?: AcademicProfile
	availability?: AvailabilityWindow[]
	internationalFlag?: boolean
	performanceStory?: PerformanceStory
	trainingLog?: TrainingLog
	/**
	 * To be used later for partnership discovery
	 */
	monetizationInterests?: string[]
	/**
	 * NIL-specific compliance and contact info
	 */
	nil?: AthleteNILProfile
	/**
	 * Security, reputation, and incident tracking (private)
	 */
	risk?: AthleteRiskProfile
	createdAt: number
}

export type BusinessLevel = 'LOCAL' | 'REGIONAL' | 'NATIONAL'

export type Business = {
	id: string
	name: string
	location: string
	/**
	 * Optional public review stats if known from external providers.
	 */
	rating?: number
	reviewCount?: number
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

export type OpportunityCostLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export type OpportunityCostEstimate = {
	level: OpportunityCostLevel
	timePerWeekHours: number
	durationWeeks: number
	explanation: string
}

export type CollaborationType = 'content-only' | 'in-person' | 'events' | 'mixed'

export type CompensationType =
	| 'free_product_or_service'
	| 'discount_code'
	| 'referral_bonus'
	| 'flat_fee'
	| 'revenue_share'
	| 'event_ticket_trade'
	| 'custom'

export type StrategyIdea = {
	title: string
	description: string
	suggestedCompensations: CompensationType[]
}

export type MatchStrategy = {
	overview: string
	positioning: string
	ideas: StrategyIdea[]
}

export type ConversationScript = {
	phoneScript: string
	inPersonOutline: string[]
}

/**
 * Lightweight wrapper to align with conversation builder expectations.
 * For now we treat FitAnalysis as the overall rating; can expand later.
 */
export type FitAnalysis = FitRating

export type MatchResult = {
	brandAlignment: number // 0-100
	audienceOverlap: number // 0-100
	practicalIntegration: number // 0-100
	score: number // 0-100
	rating: FitRating
	explanation: string
	/**
	 * Optional detailed reasons behind the rating, if available.
	 */
	reasons?: string[]
	/**
	 * Short, clear positives supporting the match (2–5 items when possible).
	 */
	pros: string[]
	/**
	 * Short, clear cautions or mismatches (2–5 items when possible).
	 */
	cons: string[]
	recommendedLevels: BusinessLevel[]
	/**
	 * Optional estimated opportunity cost to help planning.
	 */
	opportunityCost?: OpportunityCostEstimate
	/**
	 * Optional detailed partnership strategy and ideas tailored to the match.
	 */
	strategy?: MatchStrategy
	/**
	 * Optional conversation aids: phone script and in-person outline.
	 * Generated on view and safe to store (no sensitive info).
	 */
	conversation?: ConversationScript
}

export type OutreachBundle = {
	dm: string
	email: string
}


// ============ Deals, Compliance, Finance (MC 2.0) ============

export type DealStatus = 'idea' | 'pitched' | 'in_discussion' | 'agreed' | 'completed' | 'dropped'

export type DealType =
	| 'brand_sponsorship'
	| 'appearance'
	| 'camp_clinic'
	| 'digital_product'
	| 'merch_ecommerce'
	| 'charity_event'
	| 'other'

export type LicensingUsage = {
	usesSchoolMarks: boolean
	notes?: string
}

export type CollectiveRelationship = {
	name: string
	contactName?: string
	contactEmail?: string
	notes?: string
}

export type PaymentRecord = {
	date: string
	amount: number
	currency: string
	method?: 'cash' | 'check' | 'bank_transfer' | 'platform' | 'other'
	notes?: string
}

export type DealLogEntry = {
	id: string
	athleteId: string
	businessId?: string
	title: string
	dealType: DealType
	brandName: string
	status: DealStatus
	valueEstimate?: number
	currency?: string
	startDate?: string
	endDate?: string
	deliverables?: string[]
	exclusivityNotes?: string
	licensing?: LicensingUsage
	reportedToSchool?: boolean
	reportedToCollective?: boolean
	complianceNotes?: string
	collective?: CollectiveRelationship
	documents?: string[]
	payments?: PaymentRecord[]
}

export type AthleteNILProfile = {
	complianceContactEmail?: string
	schoolNILPolicyUrl?: string
	associatedCollective?: CollectiveRelationship
}

// Extend AthleteProfile with NIL profile (optional)
declare module './types' {}

// Keep extension local (no module augmentation needed); add optional field
export type AthleteProfileWithNIL = AthleteProfile & {
	nil?: AthleteNILProfile
}

