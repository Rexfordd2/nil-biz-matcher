import { AthleteProfile } from '../types'
import { CollegeProgram, ProgramFitAnalysis } from '../recruiting/programTypes'

export function buildRecruitingScript(params: {
	athlete: AthleteProfile
	program: CollegeProgram
	fitAnalysis: ProgramFitAnalysis
}): { email: string } {
	const { athlete, program, fitAnalysis } = params
	const firstSport = athlete.sports?.[0]
	const sportLabel = firstSport ? `${firstSport.sportName}${firstSport.positions?.length ? ' - ' + firstSport.positions.join('/') : ''}` : 'Student-Athlete'
	const who = `${athlete.name}, ${sportLabel} at ${athlete.school}`
	const gpa = athlete.academicProfile?.gpaRange ? ` | GPA band: ${athlete.academicProfile.gpaRange.replaceAll('_',' ')}` : ''
	const height = athlete.physicalAttributes?.heightInches
	const weight = athlete.physicalAttributes?.weightLbs
	const phys = height || weight ? ` | Physical: ${height ? `${Math.floor(height/12)}'${height%12}"` : ''}${height && weight ? ', ' : ''}${weight ? `${weight} lbs` : ''}` : ''
	const film = (athlete.gameFilm || [])[0]?.url ? ` | Film: ${(athlete.gameFilm || [])[0]?.url}` : ''

	const pros = (fitAnalysis.pros || []).map(p => `• ${p}`).join('\n')
	const cons = (fitAnalysis.cons || []).map(c => `• ${c}`).join('\n')

	const email = [
		`Subject: ${athlete.name} — interest in ${program.name}`,
		``,
		`Coach ${program.recruiters?.[0]?.name || ''},`,
		``,
		`I’m ${who}.${gpa}${phys}${film}`,
		`I’m interested in ${program.name} and believe I could be a fit.`,
		``,
		`Quick notes:`,
		`${pros ? pros : '• Positive alignment with your program’s style and academics.'}`,
		``,
		`Things I’m working on:`,
		`${cons ? cons : '• Continuing to develop my game and academics.'}`,
		``,
		`If helpful, I can share more film or get on a brief call. Thank you for your time.`,
		``,
		`Best,`,
		`${athlete.name}`
	].join('\n')

	return { email }
}


