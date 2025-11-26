import { useMemo, useState } from 'react'
import Card from './ui/Card'
import Button from './ui/Button'
import { AthleteProfile, AthleteSport, Professionalism, SchoolLevel, SocialHandle } from '../types'
import { useToast } from './ui/Toast'

const STYLE_OPTIONS: string[] = [
	'Game highlights',
	'Training clips',
	'Mic’d up moments',
	'Day-in-the-life vlogs',
	'Behind-the-scenes (locker room / travel)',
	'Motivational / inspirational',
	'Educational / tips & tutorials',
	'Film breakdown / analysis',
	'Comedy / skits',
	'Challenges & trends',
	'Collaboration / duets',
	'Reaction videos',
	'Live stream highlights',
	'Transformation / before-after',
	'Q&A / Ask me anything',
	'POV / first-person perspective',
	'Product / gear reviews',
	'Recovery & wellness content',
	'Faith / mindset content',
	'Family & community moments'
]
const LEVELS: SchoolLevel[] = ['Middle School', 'High School', 'College', 'Post-Grad']
const PROS: Professionalism[] = ['Emerging', 'Developing', 'Polished']

type Props = {
	value?: AthleteProfile
	onSave: (a: AthleteProfile) => void
}

export default function AthleteProfileForm({ value, onSave }: Props) {
	const { show } = useToast()
	const [name, setName] = useState(value?.name || '')
	const [school, setSchool] = useState(value?.school || '')
	const [schoolLevel, setSchoolLevel] = useState<SchoolLevel>(value?.schoolLevel || 'High School')
	// migrate legacy single sport/position to new structure
	const initialSports: AthleteSport[] =
		value?.sports && value.sports.length
			? value.sports
			: value && (value as any).sport
			? [{ sportName: (value as any).sport, positions: ((value as any).position ? [(value as any).position] : []) }]
			: []
	const [sports, setSports] = useState<AthleteSport[]>(initialSports)
	const [location, setLocation] = useState(value?.location || '')
	const [socialHandles, setSocialHandles] = useState<SocialHandle[]>(
		value?.socialHandles && value.socialHandles.length
			? value.socialHandles
			: value?.social
			? [{ platform: 'Other', handle: value.social.handle || '', url: value.social.link || undefined }]
			: []
	)
	const [followers, setFollowers] = useState<number | ''>(value?.social?.followers ?? '')
	const [contentStyles, setContentStyles] = useState<string[]>(value?.contentStyles || [])
	const [personality, setPersonality] = useState(value?.personality || '')
	const [values, setValues] = useState<string>((value?.values || []).join(', '))
	const [timePerWeekHours, setTimePerWeekHours] = useState<number | ''>(value?.timePerWeekHours ?? 3)
	const [professionalism, setProfessionalism] = useState<Professionalism>(value?.professionalism || 'Developing')

	const snapshot = useMemo(
		() => ({
			name,
			sports,
			school,
			level: schoolLevel,
			styles: contentStyles.join(' / '),
			values: values
		}),
		[name, sports, school, schoolLevel, contentStyles, values]
	)

	function toggleStyle(s: string) {
		setContentStyles(curr => (curr.includes(s) ? curr.filter(x => x !== s) : [...curr, s]))
	}

	function addSport() {
		setSports(curr => [...curr, { sportName: '', positions: [] }])
	}
	function removeSport(idx: number) {
		setSports(curr => curr.filter((_, i) => i !== idx))
	}
	function updateSport(idx: number, next: Partial<AthleteSport>) {
		setSports(curr => curr.map((s, i) => (i === idx ? { ...s, ...next } : s)))
	}
	function updateSportPositions(idx: number, text: string) {
		const parts = text.split(',').map(t => t.trim()).filter(Boolean)
		setSports(curr => curr.map((s, i) => (i === idx ? { ...s, positions: parts } : s)))
	}

	function addSocial() {
		setSocialHandles(curr => [...curr, { platform: 'Instagram', handle: '' }])
	}
	function removeSocial(idx: number) {
		setSocialHandles(curr => curr.filter((_, i) => i !== idx))
	}
	function updateSocial(idx: number, next: Partial<SocialHandle>) {
		setSocialHandles(curr => curr.map((s, i) => (i === idx ? { ...s, ...next } : s)))
	}

	function handleSave() {
		if (!name || !school || sports.length === 0 || !sports[0].sportName.trim()) {
			show('Please fill name, school, and at least one sport')
			return
		}
		const athlete: AthleteProfile = {
			id: value?.id || `ath-${Date.now()}`,
			name,
			school,
			schoolLevel,
			level: schoolLevel.toLowerCase(),
			sports: sports.map(s => ({ sportName: s.sportName.trim(), positions: (s.positions || []).map(p => p.trim()).filter(Boolean) })),
			location: location || undefined,
			social: {
				handle: socialHandles[0]?.handle || undefined,
				link: socialHandles[0]?.url || undefined,
				followers: followers === '' ? undefined : followers
			},
			socialHandles: socialHandles.map(s => ({ platform: s.platform, handle: s.handle, url: s.url || undefined })),
			contentStyles,
			personality,
			values: values
				.split(',')
				.map(v => v.trim())
				.filter(Boolean),
			timePerWeekHours: timePerWeekHours === '' ? 0 : timePerWeekHours,
			professionalism,
			createdAt: value?.createdAt || Date.now()
		}
		onSave(athlete)
		show('Athlete profile saved')
	}

	return (
		<div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
			<Card title="Athlete Profile Builder">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Name</span>
						<input value={name} onChange={e => setName(e.target.value)} className="bg-mid border border-border rounded-md px-3 py-2 text-white" placeholder="Full name" />
					</label>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">School</span>
						<input value={school} onChange={e => setSchool(e.target.value)} className="bg-mid border border-border rounded-md px-3 py-2 text-white" placeholder="School name" />
					</label>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Level</span>
						<select value={schoolLevel} onChange={e => setSchoolLevel(e.target.value as SchoolLevel)} className="bg-mid border border-border rounded-md px-3 py-2 text-white">
							{LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
						</select>
					</label>
					<div className="md:col-span-2">
						<div className="flex items-center justify-between mb-2">
							<span className="subtle text-sm">Sports & Positions</span>
							<Button variant="ghost" onClick={addSport}>Add Sport</Button>
						</div>
						<div className="subtle text-xs mb-2">You can add more than one sport and multiple positions per sport.</div>
						<div className="space-y-3">
							{sports.map((s, idx) => (
								<div key={idx} className="bg-mid border border-border rounded-md p-3">
									<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
										<input
											value={s.sportName}
											onChange={e => updateSport(idx, { sportName: e.target.value })}
											className="bg-background border border-border rounded-md px-3 py-2 text-white"
											placeholder="Sport (e.g., Football)"
										/>
										<input
											value={(s.positions || []).join(', ')}
											onChange={e => updateSportPositions(idx, e.target.value)}
											className="bg-background border border-border rounded-md px-3 py-2 text-white md:col-span-2"
											placeholder="Positions (comma-separated, e.g., WR, KR)"
										/>
									</div>
									<div className="mt-2 flex justify-end">
										<Button variant="ghost" onClick={() => removeSport(idx)}>Remove</Button>
									</div>
								</div>
							))}
							{sports.length === 0 && <div className="subtle text-sm">Add your primary sport and positions.</div>}
						</div>
					</div>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Location (city/state)</span>
						<input value={location} onChange={e => setLocation(e.target.value)} className="bg-mid border border-border rounded-md px-3 py-2 text-white" placeholder="City, ST" />
					</label>
					<div className="md:col-span-2">
						<div className="flex items-center justify-between mb-2">
							<span className="subtle text-sm">Social Handles</span>
							<Button variant="ghost" onClick={addSocial}>Add another account</Button>
						</div>
						<div className="subtle text-xs mb-2">Add Instagram, TikTok, YouTube, etc. Adding at least one account helps with matching.</div>
						<div className="space-y-3">
							{socialHandles.map((s, idx) => (
								<div key={idx} className="bg-mid border border-border rounded-md p-3">
									<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
										<select
											value={s.platform}
											onChange={e => updateSocial(idx, { platform: e.target.value })}
											className="bg-background border border-border rounded-md px-3 py-2 text-white"
										>
											{['Instagram','TikTok','YouTube','Twitter/X','Twitch','Snapchat','Facebook','Other'].map(p => <option key={p} value={p}>{p}</option>)}
										</select>
										<input
											value={s.handle}
											onChange={e => updateSocial(idx, { handle: e.target.value })}
											className="bg-background border border-border rounded-md px-3 py-2 text-white"
											placeholder="@yourhandle"
										/>
										<input
											value={s.url || ''}
											onChange={e => updateSocial(idx, { url: e.target.value })}
											className="bg-background border border-border rounded-md px-3 py-2 text-white"
											placeholder="Full profile URL (optional)"
										/>
									</div>
									<div className="mt-2 flex justify-end">
										<Button variant="ghost" onClick={() => removeSocial(idx)}>Remove</Button>
									</div>
								</div>
							))}
							{socialHandles.length === 0 && <div className="subtle text-sm">Add at least one social account.</div>}
						</div>
					</div>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Followers (optional)</span>
						<input value={followers} onChange={e => setFollowers(e.target.value === '' ? '' : Number(e.target.value))} className="bg-mid border border-border rounded-md px-3 py-2 text-white" placeholder="Total across platforms (e.g., 5000)" />
					</label>
					<label className="md:col-span-2 flex flex-col gap-2">
						<span className="subtle text-sm">Content Styles (pick a few)</span>
						<div className="flex flex-wrap gap-2">
							{STYLE_OPTIONS.map(s => (
								<button
									type="button"
									key={s}
									onClick={() => toggleStyle(s)}
									className={`px-3 py-1 rounded-md border ${contentStyles.includes(s) ? 'border-brand-red text-white bg-brand-red/20' : 'border-border text-gray-300 hover:bg-mid'}`}
								>
									{s}
								</button>
							))}
						</div>
					</label>
					<label className="md:col-span-2 flex flex-col gap-2">
						<span className="subtle text-sm">Personality & Values</span>
						<input value={personality} onChange={e => setPersonality(e.target.value)} className="bg-mid border border-border rounded-md px-3 py-2 text-white" placeholder="Positive, hardworking, faith-driven…" />
						<input value={values} onChange={e => setValues(e.target.value)} className="bg-mid border border-border rounded-md px-3 py-2 text-white" placeholder="Comma-separated values (e.g. grit, faith, family)" />
					</label>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Time Capacity (hrs/week)</span>
						<input value={timePerWeekHours} onChange={e => setTimePerWeekHours(e.target.value === '' ? '' : Number(e.target.value))} className="bg-mid border border-border rounded-md px-3 py-2 text-white" placeholder="3" />
					</label>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Professionalism</span>
						<select value={professionalism} onChange={e => setProfessionalism(e.target.value as Professionalism)} className="bg-mid border border-border rounded-md px-3 py-2 text-white">
							{PROS.map(p => <option key={p} value={p}>{p}</option>)}
						</select>
					</label>
				</div>
				<div className="mt-5 flex justify-end">
					<Button onClick={handleSave} className="red-glow">Save Profile</Button>
				</div>
			</Card>
			<Card title="Athlete Snapshot">
				<div className="space-y-3">
					<div className="text-2xl headline">{snapshot.name || 'Your Name'}</div>
					<div className="text-gray-300">
						{snapshot.sports.length
							? snapshot.sports.map(s => `${s.sportName}${s.positions.length ? ' — ' + s.positions.join('/') : ''}`).join(' • ')
							: 'Your Sports'}
					</div>
					<div className="text-gray-400">{snapshot.school} • {snapshot.level}</div>
					<div className="text-gray-300">Styles: <span className="text-white">{snapshot.styles || '—'}</span></div>
					<div className="text-gray-300">Values: <span className="text-white">{snapshot.values || '—'}</span></div>
					<p className="subtle">Share this snapshot when pitching new partners.</p>
				</div>
			</Card>
		</div>
	)
}


