import { AthleteProfile, Business, OutreachBundle } from '../types'

function firstName(full: string): string {
	return full.split(' ')[0] || full
}

export function buildOutreach(ath: AthleteProfile, biz: Business, ideas: string[]): OutreachBundle {
	const firstSport = ath.sports?.[0]
	const sportLabel = firstSport ? `${firstSport.sportName}${firstSport.positions?.length ? ' - ' + firstSport.positions.join('/') : ''}` : 'Student-Athlete'
	const who = `${ath.name}, ${sportLabel} at ${ath.school} (${ath.schoolLevel})`
	const followers = ath.social?.followers ? ` • ${ath.social.followers.toLocaleString()} followers` : ''
	const idea1 = ideas[0] || 'Simple content collab'
	const idea2 = ideas[1] || 'Discount-code test for two weeks'

	const dm = [
		`Hey ${biz.name} team — I’m ${who}.${followers}`,
		`I think we’re a good fit. I like what you’re doing and a lot of my audience is local.`,
		`Two easy ideas:`,
		`• ${idea1}`,
		`• ${idea2}`,
		`Open to a quick chat this week? No pressure — would love to support what you’re building.`
	].join('\n')

	const email = [
		`Subject: ${ath.name} x ${biz.name} — quick collab idea`,
		``,
		`Hi ${biz.name} team,`,
		``,
		`I’m ${who}. I create ${(ath.contentStyles || []).join('/').toLowerCase()} content and keep things respectful and parent-friendly.`,
		`From what I can tell, we’re aligned and there’s audience overlap locally.`,
		`Here are two specific ideas that could work right away:`,
		`1) ${idea1}`,
		`2) ${idea2}`,
		``,
		`If helpful, I can send a quick plan or jump on a brief call. No rush and no pressure — just excited to see if this could help ${biz.name}.`,
		``,
		`Thanks for your time,`,
		`${ath.name}`,
		`${ath.social?.link || (ath.socialHandles?.[0]?.url || '')}`
	].join('\n')

	return { dm, email }
}


