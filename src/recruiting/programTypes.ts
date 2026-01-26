export type ProgramLevel =
	| 'NCAA_D1'
	| 'NCAA_D2'
	| 'NCAA_D3'
	| 'NAIA'
	| 'JUCO'
	| 'SEMI_PRO'
	| 'OTHER'

export type ProgramType = 'college' | 'semi_pro'

export type ProgramRecruiterContact = {
	name: string
	role?: string
	email?: string
	phone?: string
	website?: string
	notes?: string
}

export type ProgramAcademicProfile = {
	minGpaRange?: string // e.g. "2.5+", "3.0+"
	typicalMajors?: string[]
}

export type ProgramPlaystyleProfile = {
	playstyleTags?: string[]
	personalityTags?: string[]
}

export type ProgramLocation = {
	city?: string
	stateOrRegion?: string
	country?: string
	latitude?: number
	longitude?: number
}

export type CollegeProgram = {
	id: string
	name: string
	sport: string
	level: ProgramLevel
	type: ProgramType
	conference?: string
	location?: ProgramLocation
	academic?: ProgramAcademicProfile
	playstyle?: ProgramPlaystyleProfile
	recruiters?: ProgramRecruiterContact[]
	teamSiteUrl?: string
	recruitingPageUrl?: string
	socialHandles?: string[]
}

export type ProgramFitRating = 'EXCELLENT' | 'GOOD' | 'POSSIBLE' | 'UNLIKELY'

export type ProgramFitAnalysis = {
	rating: ProgramFitRating
	pros: string[]
	cons: string[]
	notes?: string
}


