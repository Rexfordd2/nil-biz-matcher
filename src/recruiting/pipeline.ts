import { load, save } from '../utils/storage'

export type RecruitingStatus =
	| 'not_contacted'
	| 'researching'
	| 'contacted'
	| 'in_conversation'
	| 'offer_received'
	| 'committed'
	| 'archived'

export type RecruitingTarget = {
	id: string
	athleteId: string
	programId: string
	status: RecruitingStatus
	interestLevel?: 'pursue' | 'maybe' | 'low'
	notes?: string
	lastContactDate?: string
}

const STORAGE_KEY = 'recruiting.targets'

export function getTargets(): RecruitingTarget[] {
	return load<RecruitingTarget[]>(STORAGE_KEY, [])
}

export function upsertTarget(next: RecruitingTarget) {
	const all = getTargets()
	const idx = all.findIndex(t => t.id === next.id)
	const updated = idx === -1 ? [next, ...all] : Object.assign([], all, { [idx]: next })
	save(STORAGE_KEY, updated)
}

export function upsertByProgram(athleteId: string, programId: string, updates: Partial<RecruitingTarget>) {
	const all = getTargets()
	const existing = all.find(t => t.athleteId === athleteId && t.programId === programId)
	const next: RecruitingTarget = existing
		? { ...existing, ...updates }
		: {
			id: `rt-${Date.now()}`,
			athleteId,
			programId,
			status: updates.status || 'researching',
			interestLevel: updates.interestLevel
		}
	upsertTarget(next)
	return next
}


