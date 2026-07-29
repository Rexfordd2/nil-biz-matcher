import type { AthleteProfile } from '../types'

/**
 * Sensitive values that must never appear on the default public/printable profile.
 * Used for display containment (PR-1) and regression tests.
 */
export function collectForbiddenPublicProfileValues(athlete: AthleteProfile): string[] {
	const values: string[] = []

	const push = (v?: string | null) => {
		const t = typeof v === 'string' ? v.trim() : ''
		if (t) values.push(t)
	}

	push(athlete.nil?.complianceContactEmail)
	push(athlete.nil?.associatedCollective?.contactName)
	push(athlete.nil?.associatedCollective?.contactEmail)
	push(athlete.nil?.associatedCollective?.notes)
	push(athlete.academicProfile?.gpaRange)
	push(athlete.academicProfile?.advisorEmail)
	push(athlete.academicProfile?.advisorName)

	for (const s of athlete.supportTeam || []) {
		push(s.email)
		push(s.phone)
		push(s.name)
	}

	for (const t of athlete.trustedCircle || []) {
		push(t.name)
		push(t.email)
		push(t.phone)
		push(t.relationship)
	}

	for (const incident of athlete.risk?.incidents || []) {
		push(incident.summary)
		push(incident.actionsTaken)
		push(incident.platformOrLocation)
	}
	push(athlete.risk?.lastReputationScan?.notes)

	return values
}

/** Availability may expose only general labels — not days or time ranges. */
export function getPublicAvailabilityLabels(athlete: AthleteProfile): string[] {
	return (athlete.availability || [])
		.map((w) => (w.label || '').trim())
		.filter(Boolean)
}
