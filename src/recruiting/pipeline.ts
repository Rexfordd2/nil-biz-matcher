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

function storageKeyForAthlete(athleteId: string | undefined | null): string {
	const id = (athleteId || 'anon').trim() || 'anon'
	return `athleteLedger:recruitingTargets:${id}`
}

export function getTargetsFor(athleteId?: string | null): RecruitingTarget[] {
	return load<RecruitingTarget[]>(storageKeyForAthlete(athleteId), [])
}

export function upsertTarget(next: RecruitingTarget) {
	const all = getTargetsFor(next.athleteId)
	const idx = all.findIndex(t => t.id === next.id)
	const updated = idx === -1 ? [next, ...all] : Object.assign([], all, { [idx]: next })
	save(storageKeyForAthlete(next.athleteId), updated)
}

export function upsertByProgram(athleteId: string, programId: string, updates: Partial<RecruitingTarget>) {
	const all = getTargetsFor(athleteId)
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


