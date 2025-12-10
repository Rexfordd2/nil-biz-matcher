export type RecruitingCoach = {
	id: string
	name: string
	email: string
	school: string
	sport: string
	level: string
	createdAt: number
	updatedAt: number
}

export type HighlightClip = {
	id: string
	athleteId: string
	title: string
	videoUrl: string
	description?: string
	createdAt: number
}

export type CoachOutreachStatus = 'sent' | 'bounced' | 'opened' | 'clicked'

export type CoachOutreach = {
	id: string
	athleteId: string
	coachId: string
	clipId: string
	subject: string
	body: string
	sentAt: number
	status: CoachOutreachStatus
	openCount: number
	clickCount: number
	trackToken: string
}


