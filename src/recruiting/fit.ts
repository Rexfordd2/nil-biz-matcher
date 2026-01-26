import { AthleteProfile, GameFilmLink, PhysicalAttributes, SportMetricEntry } from '../types'
import { CollegeProgram, ProgramFitAnalysis, ProgramFitRating } from './programTypes'

function normalizeGpaBand(band?: string): number | null {
	if (!band) return null
	const m = String(band).match(/(\d\.\d|\d)(?=\+?)/)
	return m ? Number(m[1]) : null
}

function athleteApproxGpa(ath?: AthleteProfile['academicProfile']): number | null {
	if (!ath?.gpaRange) return null
	switch (ath.gpaRange) {
		case 'below_2_5': return 2.3
		case '2_5_to_3_0': return 2.7
		case '3_0_to_3_5': return 3.2
		case '3_5_plus': return 3.6
		default: return null
	}
}

function hasTape(gameFilm?: GameFilmLink[]): boolean {
	return Array.isArray(gameFilm) && gameFilm.length > 0
}

function sizeHint(attrs?: PhysicalAttributes): 'plus' | 'avg' | 'undersized' | 'unknown' {
	if (!attrs?.heightInches || !attrs.weightLbs) return 'unknown'
	// Very rough heuristic: football/basketball assumptions
	if (attrs.heightInches >= 75 || attrs.weightLbs >= 200) return 'plus'
	if (attrs.heightInches >= 70 && attrs.weightLbs >= 170) return 'avg'
	return 'undersized'
}

function metricHint(metrics?: SportMetricEntry[], sport?: string): 'plus' | 'avg' | 'developing' | 'unknown' {
	if (!metrics || !metrics.length) return 'unknown'
	const text = metrics.map(m => `${m.metricName}:${m.value}`).join(' ').toLowerCase()
	if (/4\.4|4\.5|sub-4\.6|vertical.*(35|36|37|38|39|40)/.test(text)) return 'plus'
	if (/4\.6|4\.7|vertical.*(30|31|32|33|34)/.test(text)) return 'avg'
	return 'developing'
}

export function analyzeProgramFit(params: { athlete: AthleteProfile; program: CollegeProgram }): ProgramFitAnalysis {
	const { athlete, program } = params
	const pros: string[] = []
	const cons: string[] = []

	// Academics
	const programMin = normalizeGpaBand(program.academic?.minGpaRange)
	const athleteGpa = athleteApproxGpa(athlete.academicProfile)
	if (programMin != null && athleteGpa != null) {
		if (athleteGpa >= programMin) {
			pros.push('Your grades meet or exceed this program’s typical minimum.')
		} else {
			cons.push('Your current GPA appears below the program’s typical minimum.')
		}
	}

	// Physical profile and metrics
	const size = sizeHint(athlete.physicalAttributes)
	const perf = metricHint(athlete.sportMetrics, program.sport)
	if (size === 'plus') pros.push('Physical profile matches common benchmarks at this level.')
	if (size === 'undersized') cons.push('You may be undersized for this level; development path needed.')
	if (perf === 'plus') pros.push('Performance metrics suggest strong athletic traits for this level.')
	if (perf === 'developing') cons.push('Performance metrics indicate room for development versus typical recruits.')

	// Tape
	if (hasTape(athlete.gameFilm)) {
		pros.push('You have game film available to share with recruiters.')
	} else {
		cons.push('No game film links found; add Hudl/YouTube for better evaluation.')
	}

	// Simple level alignment based on athlete goals in performanceStory
	const goals = (athlete.performanceStory?.futureGoals || []).join(' ').toLowerCase()
	if (program.level === 'NCAA_D1' && /d1|division 1|division i/.test(goals)) {
		pros.push('Program level matches your stated D1 goal.')
	}
	if (program.level === 'NCAA_D2' && /d2|division 2|division ii/.test(goals)) {
		pros.push('Program level matches your stated D2 goal.')
	}
	if ((program.level === 'NAIA' || program.level === 'NCAA_D3') && /(naia|d3|division 3|division iii)/.test(goals)) {
		pros.push('Program level aligns with your stated competitive target.')
	}

	// Playstyle/personality quick match with athlete content styles/personality
	const playTags = (program.playstyle?.playstyleTags || []).concat(program.playstyle?.personalityTags || []).map(s => s.toLowerCase())
	const styleText = (athlete.contentStyles || []).join(' ').toLowerCase()
	const personalityText = (athlete.personality || '').toLowerCase()
	if (playTags.some(t => styleText.includes('training') && /development|blue-collar|high-upside/.test(t))) {
		pros.push('Their development emphasis matches your training-focused content/style.')
	}
	if (playTags.some(t => /tempo|air raid|pro-style|run-heavy|possession/.test(t)) && personalityText.includes('detail')) {
		pros.push('Your detail-oriented approach aligns with their playstyle/philosophy.')
	}

	// Geography nudge if athlete and program are far apart (best-effort using state text only)
	const athleteLoc = (athlete.location || '').toLowerCase()
	const progState = (program.location?.stateOrRegion || '').toLowerCase()
	if (athleteLoc && progState && !athleteLoc.includes(progState)) {
		cons.push('Geography may require long-distance recruiting or relocation.')
	}

	// Rating heuristic
	let rating: ProgramFitRating = 'POSSIBLE'
	let score = 0
	if (pros.length) score += pros.length * 10
	if (cons.length) score -= cons.length * 8
	if (athleteGpa != null && programMin != null) {
		if (athleteGpa >= programMin) score += 15
		else score -= 20
	}
	if (size === 'plus') score += 10
	if (size === 'undersized') score -= 10
	if (perf === 'plus') score += 12
	if (perf === 'developing') score -= 8
	if (hasTape(athlete.gameFilm)) score += 6

	if (score >= 35) rating = 'EXCELLENT'
	else if (score >= 15) rating = 'GOOD'
	else if (score >= -10) rating = 'POSSIBLE'
	else rating = 'UNLIKELY'

	return {
		rating,
		pros: pros.slice(0, 4),
		cons: cons.slice(0, 4)
	}
}


