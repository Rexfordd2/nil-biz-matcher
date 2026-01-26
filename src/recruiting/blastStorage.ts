import { load, save } from '../utils/storage'
import type { CoachOutreach, CoachOutreachStatus, HighlightClip, RecruitingCoach } from './blastTypes'

const COACHES_KEY = 'recruiting.coaches'
const CLIPS_KEY = 'recruiting.clips'
const OUTREACH_KEY = 'recruiting.outreach'

function generateId(prefix: string): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function generateToken(): string {
	return `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
}

// Coaches
export function getCoaches(): RecruitingCoach[] {
	return load<RecruitingCoach[]>(COACHES_KEY, [])
}

export function upsertCoach(next: Omit<RecruitingCoach, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): RecruitingCoach {
	const all = getCoaches()
	const now = Date.now()
	const id = next.id || generateId('coach')
	const existingIndex = all.findIndex(c => c.id === id)
	const record: RecruitingCoach = existingIndex === -1
		? { ...next, id, createdAt: now, updatedAt: now }
		: { ...all[existingIndex], ...next, id, updatedAt: now }
	const updated = existingIndex === -1
		? [record, ...all]
		: Object.assign([], all, { [existingIndex]: record })
	save(COACHES_KEY, updated)
	return record
}

export function deleteCoach(id: string) {
	const all = getCoaches().filter(c => c.id !== id)
	save(COACHES_KEY, all)
}

// Highlight clips
export function getClips(athleteId?: string): HighlightClip[] {
	const all = load<HighlightClip[]>(CLIPS_KEY, [])
	return athleteId ? all.filter(c => c.athleteId === athleteId) : all
}

export function upsertClip(next: Omit<HighlightClip, 'id' | 'createdAt'> & { id?: string }): HighlightClip {
	const all = getClips()
	const id = next.id || generateId('clip')
	const existingIndex = all.findIndex(c => c.id === id)
	const record: HighlightClip = existingIndex === -1
		? { ...next, id, createdAt: Date.now() }
		: { ...all[existingIndex], ...next, id }
	const updated = existingIndex === -1
		? [record, ...all]
		: Object.assign([], all, { [existingIndex]: record })
	save(CLIPS_KEY, updated)
	return record
}

export function deleteClip(id: string) {
	const all = getClips().filter(c => c.id !== id)
	save(CLIPS_KEY, all)
}

// Outreach
export function getOutreach(athleteId?: string): CoachOutreach[] {
	const all = load<CoachOutreach[]>(OUTREACH_KEY, [])
	return athleteId ? all.filter(o => o.athleteId === athleteId) : all
}

export function createOutreach(params: {
	athleteId: string
	coachId: string
	clipId: string
	subject: string
	body: string
}): CoachOutreach {
	const all = getOutreach()
	const record: CoachOutreach = {
		id: generateId('out'),
		athleteId: params.athleteId,
		coachId: params.coachId,
		clipId: params.clipId,
		subject: params.subject,
		body: params.body,
		sentAt: Date.now(),
		status: 'sent',
		openCount: 0,
		clickCount: 0,
		trackToken: generateToken()
	}
	save(OUTREACH_KEY, [record, ...all])
	return record
}

export function updateOutreachStatus(outreachId: string, status: CoachOutreachStatus) {
	const all = getOutreach()
	const idx = all.findIndex(o => o.id === outreachId)
	if (idx === -1) return
	const updated = Object.assign([], all, { [idx]: { ...all[idx], status } })
	save(OUTREACH_KEY, updated)
}

export function recordOpenByToken(token: string) {
	const all = getOutreach()
	const idx = all.findIndex(o => o.trackToken === token)
	if (idx === -1) return
	const next = { ...all[idx], status: 'opened' as CoachOutreachStatus, openCount: (all[idx].openCount || 0) + 1 }
	const updated = Object.assign([], all, { [idx]: next })
	save(OUTREACH_KEY, updated)
}

export function recordClickByToken(token: string) {
	const all = getOutreach()
	const idx = all.findIndex(o => o.trackToken === token)
	if (idx === -1) return
	const next = { ...all[idx], status: 'clicked' as CoachOutreachStatus, clickCount: (all[idx].clickCount || 0) + 1 }
	const updated = Object.assign([], all, { [idx]: next })
	save(OUTREACH_KEY, updated)
}


