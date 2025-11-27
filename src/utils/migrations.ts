import { AthleteProfile } from '../types'

export function migrateAthleteProfile(input: any): AthleteProfile | null {
	if (!input) return null
	const a = { ...input }
	// Ensure sports array exists
	if (!Array.isArray(a.sports)) {
		const sportName = a.sport || ''
		const position = a.position ? [a.position] : []
		a.sports = sportName ? [{ sportName, positions: position }] : []
	}
	// Ensure socialHandles array exists
	if (!Array.isArray(a.socialHandles)) {
		const sh = []
		if (a.social?.handle || a.social?.link) {
			sh.push({ platform: 'Other', handle: a.social?.handle || '', url: a.social?.link || undefined })
		}
		a.socialHandles = sh
	}
	// Normalize contentStyles to string[]
	if (!Array.isArray(a.contentStyles)) a.contentStyles = []
	a.contentStyles = a.contentStyles.map((x: any) => String(x))

	// Normalize mediaKit if present
	if (a.mediaKit) {
		const mk = { ...a.mediaKit }
		if (!Array.isArray(mk.heroImages)) mk.heroImages = []
		if (!Array.isArray(mk.logos)) mk.logos = []
		if (!Array.isArray(mk.brandColors)) mk.brandColors = []
		if (!Array.isArray(mk.samplePosts)) mk.samplePosts = []
		if (mk.externalDeckUrl != null && mk.externalDeckUrl !== undefined) {
			mk.externalDeckUrl = String(mk.externalDeckUrl)
		}
		a.mediaKit = mk
	}
	// Ensure level string
	if (!a.level && a.schoolLevel) {
		a.level = String(a.schoolLevel).toLowerCase()
	}

	// New fields safe defaults for MC 2.0
	if (!Array.isArray(a.supportTeam)) a.supportTeam = []
	if (!Array.isArray(a.trustedCircle)) a.trustedCircle = []
	if (a.academicProfile && typeof a.academicProfile === 'object') {
		const ap = { ...a.academicProfile }
		if (!Array.isArray(ap.academicInterests)) ap.academicInterests = []
		a.academicProfile = ap
	}
	if (!Array.isArray(a.availability)) a.availability = []
	if (a.performanceStory && typeof a.performanceStory === 'object') {
		const ps = { ...a.performanceStory }
		if (!Array.isArray(ps.keyMilestones)) ps.keyMilestones = []
		if (!Array.isArray(ps.futureGoals)) ps.futureGoals = []
		a.performanceStory = ps
	}
	if (!a.trainingLog || typeof a.trainingLog !== 'object') {
		a.trainingLog = { entries: [] }
	} else {
		if (!Array.isArray(a.trainingLog.entries)) a.trainingLog.entries = []
	}
	if (!Array.isArray(a.monetizationInterests)) a.monetizationInterests = []
	if (typeof a.internationalFlag !== 'boolean') a.internationalFlag = false
	if (typeof a.createdAt !== 'number') a.createdAt = Date.now()
	// Ensure NIL profile shape
	if (!a.nil || typeof a.nil !== 'object') {
		a.nil = {}
	} else {
		const nil = { ...a.nil }
		if (nil.complianceContactEmail != null && typeof nil.complianceContactEmail !== 'string') nil.complianceContactEmail = String(nil.complianceContactEmail)
		if (nil.schoolNILPolicyUrl != null && typeof nil.schoolNILPolicyUrl !== 'string') nil.schoolNILPolicyUrl = String(nil.schoolNILPolicyUrl)
		if (nil.associatedCollective && typeof nil.associatedCollective === 'object') {
			const col = { ...nil.associatedCollective }
			if (col.name != null && typeof col.name !== 'string') col.name = String(col.name)
			if (col.contactName != null && typeof col.contactName !== 'string') col.contactName = String(col.contactName)
			if (col.contactEmail != null && typeof col.contactEmail !== 'string') col.contactEmail = String(col.contactEmail)
			if (col.notes != null && typeof col.notes !== 'string') col.notes = String(col.notes)
			nil.associatedCollective = col
		}
		a.nil = nil
	}
	return a as AthleteProfile
}


