/**
 * Display/product role helpers. Roles come from user-writable metadata and only
 * shape the UI — they are never an authorization claim.
 */

export type ProductRole =
	| 'athlete_18_plus'
	| 'athlete_under_18'
	| 'parent_guardian'
	| 'agent_rep'
	| 'coach_staff'
	| 'business_brand'

export function normalizeProductRole(raw: unknown): ProductRole | null {
	const r = String(raw ?? '').trim().toLowerCase()
	if (r === 'athlete_under_18') return 'athlete_under_18'
	if (r === 'athlete' || r === 'athlete_18_plus') return 'athlete_18_plus'
	if (r === 'parent' || r === 'parent_guardian') return 'parent_guardian'
	if (r === 'agent' || r === 'agent_rep') return 'agent_rep'
	if (r === 'coach' || r === 'coach_staff') return 'coach_staff'
	if (r === 'business' || r === 'business_brand') return 'business_brand'
	return null
}

/** Unknown/unset roles get the athlete experience (the beta audience). */
export function isAthleteExperience(role: ProductRole | null): boolean {
	return role === null || role === 'athlete_18_plus' || role === 'athlete_under_18'
}

export function isMinorAthlete(role: ProductRole | null): boolean {
	return role === 'athlete_under_18'
}
