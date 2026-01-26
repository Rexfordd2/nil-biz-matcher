import { useEffect, useMemo, useState } from 'react'
import Card from './ui/Card'
import Button from './ui/Button'
import { AthleteProfile, AthleteSport, Professionalism, SchoolLevel, SocialHandle, SupportContact, TrustedContact, AcademicProfile, AvailabilityWindow, PerformanceStory, TrainingLogEntry } from '../types'
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
const SUPPORT_ROLES: SupportContact['role'][] = [
	'head_coach',
	'position_coach',
	'strength_coach',
	'athletic_trainer',
	'physical_therapist',
	'skill_trainer',
	'speed_coach',
	'sport_psych',
	'recovery_specialist',
	'other'
]
const TRUSTED_ROLES: TrustedContact['role'][] = ['parent_guardian', 'mentor', 'advisor', 'coach', 'other']
const DAYS: string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TRAINING_TYPES: TrainingLogEntry['type'][] = ['strength', 'conditioning', 'skill', 'recovery', 'film', 'other']
const INTENSITIES: NonNullable<TrainingLogEntry['perceivedIntensity']>[] = ['easy', 'moderate', 'hard']
const MONETIZATION_OPTIONS: string[] = [
	'Local brand partnerships',
	'Regional/national brand deals',
	'Camps/clinics',
	'Appearances/speaking',
	'Digital products (courses, playbooks)',
	'Merch/e-commerce',
	'Charity/impact events'
]

type Props = {
	value?: AthleteProfile
	onSave: (a: AthleteProfile) => void
	onChange?: (a: AthleteProfile) => void
}

export default function AthleteProfileForm({ value, onSave, onChange }: Props) {
	const { show } = useToast()
	const [name, setName] = useState(value?.name || '')
	const [school, setSchool] = useState(value?.school || '')
	const [schoolLevel, setSchoolLevel] = useState<SchoolLevel>(value?.schoolLevel || 'High School')
	// Media kit state
	const [heroImages, setHeroImages] = useState<string[]>(value?.mediaKit?.heroImages || [])
	const [logos, setLogos] = useState<string[]>(value?.mediaKit?.logos || [])
	const [brandColors, setBrandColors] = useState<string[]>(value?.mediaKit?.brandColors || [])
	const [samplePostsText, setSamplePostsText] = useState<string>((value?.mediaKit?.samplePosts || []).join('\n'))
	const [externalDeckUrl, setExternalDeckUrl] = useState<string>(value?.mediaKit?.externalDeckUrl || '')
	const [heroUrl, setHeroUrl] = useState<string>('')
	const [logoUrl, setLogoUrl] = useState<string>('')
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
	const [customStyle, setCustomStyle] = useState<string>('')
	const [personality, setPersonality] = useState(value?.personality || '')
	const [values, setValues] = useState<string>((value?.values || []).join(', '))
	const [timePerWeekHours, setTimePerWeekHours] = useState<number | ''>(value?.timePerWeekHours ?? 3)
	const [professionalism, setProfessionalism] = useState<Professionalism>(value?.professionalism || 'Developing')

	// New sections state
	const [supportTeam, setSupportTeam] = useState<SupportContact[]>(value?.supportTeam || [])
	const [trustedCircle, setTrustedCircle] = useState<TrustedContact[]>(value?.trustedCircle || [])
	const [academic, setAcademic] = useState<AcademicProfile>(
		value?.academicProfile || { schoolName: value?.school || '', level: value?.level, academicInterests: [] }
	)
	const [availability, setAvailability] = useState<AvailabilityWindow[]>(value?.availability || [])
	const [internationalFlag, setInternationalFlag] = useState<boolean>(!!value?.internationalFlag)
	const [performanceStory, setPerformanceStory] = useState<PerformanceStory>(
		value?.performanceStory || { keyMilestones: [], currentFocus: '', futureGoals: [] }
	)
	const [trainingEntries, setTrainingEntries] = useState<TrainingLogEntry[]>(value?.trainingLog?.entries || [])
	const [monetizationInterests, setMonetizationInterests] = useState<string[]>(value?.monetizationInterests || [])
	// NIL compliance/contact
	const [complianceEmail, setComplianceEmail] = useState<string>(value?.nil?.complianceContactEmail || '')
	const [policyUrl, setPolicyUrl] = useState<string>(value?.nil?.schoolNILPolicyUrl || '')
	const [collectiveName, setCollectiveName] = useState<string>(value?.nil?.associatedCollective?.name || '')
	const [collectiveContactName, setCollectiveContactName] = useState<string>(value?.nil?.associatedCollective?.contactName || '')
	const [collectiveContactEmail, setCollectiveContactEmail] = useState<string>(value?.nil?.associatedCollective?.contactEmail || '')
	const [collectiveNotes, setCollectiveNotes] = useState<string>(value?.nil?.associatedCollective?.notes || '')

	// Recruiting Profile state
	const pa = value?.physicalAttributes
	const [heightFeet, setHeightFeet] = useState<number | ''>(pa?.heightInches ? Math.floor(pa.heightInches / 12) : '')
	const [heightInchesPart, setHeightInchesPart] = useState<number | ''>(pa?.heightInches ? pa.heightInches % 12 : '')
	const [weightLbs, setWeightLbs] = useState<number | ''>(pa?.weightLbs ?? '')
	const [wingspanInches, setWingspanInches] = useState<number | ''>(pa?.wingspanInches ?? '')
	const [handSizeInches, setHandSizeInches] = useState<number | ''>(pa?.handSizeInches ?? '')
	const [dominantHand, setDominantHand] = useState<'left' | 'right' | 'both' | ''>(pa?.dominantHand || '')

	type Metric = { sport: string; position?: string; metricName: string; value: string; dateRecorded?: string; verifiedBy?: string }
	const [sportMetrics, setSportMetrics] = useState<Metric[]>(value?.sportMetrics || [])
	type Film = { platform: 'hudl' | 'youtube' | 'vimeo' | 'other'; label: string; url: string }
	const [gameFilm, setGameFilm] = useState<Film[]>(value?.gameFilm || [])

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

	// Support Team handlers
	function addSupport() {
		setSupportTeam(curr => [...curr, { role: 'other', name: '' } as SupportContact])
	}
	function updateSupport(idx: number, next: Partial<SupportContact>) {
		setSupportTeam(curr => curr.map((s, i) => (i === idx ? { ...s, ...next } : s)))
	}
	function removeSupport(idx: number) {
		setSupportTeam(curr => curr.filter((_, i) => i !== idx))
	}

	// Trusted Circle handlers
	function addTrusted() {
		setTrustedCircle(curr => [...curr, { role: 'parent_guardian', name: '' } as TrustedContact])
	}
	function updateTrusted(idx: number, next: Partial<TrustedContact>) {
		setTrustedCircle(curr => curr.map((t, i) => (i === idx ? { ...t, ...next } : t)))
	}
	function removeTrusted(idx: number) {
		setTrustedCircle(curr => curr.filter((_, i) => i !== idx))
	}

	// Academics handlers
	function setAcademicInterestsFromText(text: string) {
		const arr = text.split(',').map(x => x.trim()).filter(Boolean)
		setAcademic(curr => ({ ...curr, academicInterests: arr }))
	}

	// Availability handlers
	function addAvailability() {
		setAvailability(curr => [...curr, { label: '', days: [], timeRange: '' }])
	}
	function updateAvailability(idx: number, next: Partial<AvailabilityWindow>) {
		setAvailability(curr => curr.map((w, i) => (i === idx ? { ...w, ...next } : w)))
	}
	function toggleAvailabilityDay(idx: number, day: string) {
		setAvailability(curr =>
			curr.map((w, i) =>
				i === idx ? { ...w, days: (w.days || []).includes(day) ? (w.days || []).filter(d => d !== day) : [ ...(w.days || []), day ] } : w
			)
		)
	}
	function removeAvailability(idx: number) {
		setAvailability(curr => curr.filter((_, i) => i !== idx))
	}

	// Performance Story handlers
	function setMilestonesFromText(text: string) {
		const arr = text.split('\n').map(x => x.trim()).filter(Boolean)
		setPerformanceStory(curr => ({ ...curr, keyMilestones: arr }))
	}
	function setFutureGoalsFromText(text: string) {
		const arr = text.split(',').map(x => x.trim()).filter(Boolean)
		setPerformanceStory(curr => ({ ...curr, futureGoals: arr }))
	}

	// Training Log handlers
	function addTrainingEntry() {
		setTrainingEntries(curr => [
			...curr,
			{ date: new Date().toISOString().slice(0, 10), type: 'other', description: '' }
		])
	}
	function updateTrainingEntry(idx: number, next: Partial<TrainingLogEntry>) {
		setTrainingEntries(curr => curr.map((e, i) => (i === idx ? { ...e, ...next } : e)))
	}
	function removeTrainingEntry(idx: number) {
		setTrainingEntries(curr => curr.filter((_, i) => i !== idx))
	}

	// Monetization
	function toggleMonetization(tag: string) {
		setMonetizationInterests(curr => (curr.includes(tag) ? curr.filter(t => t !== tag) : [...curr, tag]))
	}

	async function filesToDataUrls(fileList: FileList): Promise<string[]> {
		const files = Array.from(fileList || [])
		const readers = files.map(
			f =>
				new Promise<string>((resolve, reject) => {
					const reader = new FileReader()
					reader.onload = () => resolve(String(reader.result))
					reader.onerror = () => reject(reader.error)
					reader.readAsDataURL(f)
				})
		)
		return Promise.all(readers)
	}

	async function addHeroFiles(list: FileList | null) {
		if (!list || list.length === 0) return
		const urls = await filesToDataUrls(list)
		setHeroImages(curr => [...curr, ...urls])
	}
	function addHeroUrl(url: string) {
		const trimmed = url.trim()
		if (!trimmed) return
		setHeroImages(curr => [...curr, trimmed])
	}
	function removeHero(idx: number) {
		setHeroImages(curr => curr.filter((_, i) => i !== idx))
	}

	async function addLogoFiles(list: FileList | null) {
		if (!list || list.length === 0) return
		const urls = await filesToDataUrls(list)
		setLogos(curr => [...curr, ...urls])
	}
	function addLogoUrl(url: string) {
		const trimmed = url.trim()
		if (!trimmed) return
		setLogos(curr => [...curr, trimmed])
	}
	function removeLogo(idx: number) {
		setLogos(curr => curr.filter((_, i) => i !== idx))
	}

	const [newColor, setNewColor] = useState<string>('')
	function addColor() {
		const c = newColor.trim()
		if (!c) return
		setBrandColors(curr => (curr.includes(c) ? curr : [...curr, c]))
		setNewColor('')
	}
	function removeColor(idx: number) {
		setBrandColors(curr => curr.filter((_, i) => i !== idx))
	}

	// Build current athlete draft from local state
	const currentDraft: AthleteProfile = useMemo(() => {
		const samplePosts = samplePostsText
			.split('\n')
			.map(v => v.trim())
			.filter(Boolean)
		const mediaKit =
			(heroImages.length || logos.length || brandColors.length || samplePosts.length || externalDeckUrl.trim()) ? {
				heroImages,
				logos,
				brandColors,
				samplePosts,
				externalDeckUrl: externalDeckUrl.trim() || undefined
			} : undefined
		const totalInches =
			(heightFeet === '' && heightInchesPart === '') ? undefined :
			((Number(heightFeet || 0) * 12) + Number(heightInchesPart || 0))
		const draft: AthleteProfile = {
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
			mediaKit,
			supportTeam,
			trustedCircle,
			academicProfile: {
				...academic,
				academicInterests: academic.academicInterests || []
			},
			availability,
			internationalFlag: !!internationalFlag,
			performanceStory: (performanceStory.keyMilestones.length || performanceStory.currentFocus || (performanceStory.futureGoals || []).length)
				? {
					keyMilestones: performanceStory.keyMilestones || [],
					currentFocus: performanceStory.currentFocus || undefined,
					futureGoals: performanceStory.futureGoals || []
				}
				: undefined,
			trainingLog: { entries: trainingEntries },
			monetizationInterests,
			physicalAttributes: (
				totalInches || weightLbs !== '' || wingspanInches !== '' || handSizeInches !== '' || dominantHand
			) ? {
				heightInches: totalInches,
				weightLbs: weightLbs === '' ? undefined : Number(weightLbs),
				wingspanInches: wingspanInches === '' ? undefined : Number(wingspanInches),
				handSizeInches: handSizeInches === '' ? undefined : Number(handSizeInches),
				dominantHand: (dominantHand || undefined) as any
			} : undefined,
			sportMetrics: sportMetrics.length ? sportMetrics : undefined,
			gameFilm: gameFilm.length ? gameFilm : undefined,
			nil: {
				complianceContactEmail: complianceEmail || undefined,
				schoolNILPolicyUrl: policyUrl || undefined,
				associatedCollective: collectiveName.trim()
					? {
						name: collectiveName.trim(),
						contactName: collectiveContactName || undefined,
						contactEmail: collectiveContactEmail || undefined,
						notes: collectiveNotes || undefined
					}
					: undefined
			},
			createdAt: value?.createdAt || Date.now()
		}
		return draft
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		value?.id,
		value?.createdAt,
		name,
		school,
		schoolLevel,
		heroImages,
		logos,
		brandColors,
		samplePostsText,
		externalDeckUrl,
		sports,
		location,
		socialHandles,
		followers,
		contentStyles,
		personality,
		values,
		timePerWeekHours,
		professionalism,
		supportTeam,
		trustedCircle,
		academic,
		availability,
		internationalFlag,
		performanceStory,
		trainingEntries,
		monetizationInterests,
		weightLbs,
		wingspanInches,
		handSizeInches,
		dominantHand,
		complianceEmail,
		policyUrl,
		collectiveName,
		collectiveContactName,
		collectiveContactEmail,
		collectiveNotes
	])

	// Notify parent on any change (debounced save handled by parent)
	useEffect(() => {
		if (onChange) onChange(currentDraft)
	}, [onChange, currentDraft])

	function handleSave() {
		if (!name || !school || sports.length === 0 || !sports[0].sportName.trim()) {
			show('Please fill name, school, and at least one sport')
			return
		}
		onSave(currentDraft)
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
						<div className="mt-2 flex gap-2 items-center">
							<input
								value={customStyle}
								onChange={e => setCustomStyle(e.target.value)}
								className="flex-1 bg-mid border border-border rounded-md px-3 py-2 text-white"
								placeholder='Other (write your own)…'
							/>
							<Button variant="ghost" onClick={() => { const t = customStyle.trim(); if (t) { toggleStyle(t); setCustomStyle('') } }}>Add</Button>
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

					{/* Media Kit Section */}
					<div className="md:col-span-2 mt-2">
						<div className="flex items-center justify-between mb-2">
							<span className="subtle text-sm">Media Kit</span>
						</div>
						<div className="space-y-5">
							{/* Hero Images */}
							<div>
								<div className="flex items-center justify-between mb-1">
									<div className="text-gray-300 text-sm">Hero Images</div>
								</div>
								<div className="flex flex-wrap gap-3 mb-2">
									{heroImages.map((src, idx) => (
										<div key={`hero-${idx}`} className="relative w-24 h-16 rounded-md overflow-hidden border border-border bg-surface">
											<img src={src} alt="" className="w-full h-full object-cover" />
											<button type="button" className="absolute top-1 right-1 text-xs bg-mid/80 hover:bg-mid text-white rounded px-1" onClick={() => removeHero(idx)}>Remove</button>
										</div>
									))}
									{heroImages.length === 0 && <div className="subtle text-sm">Add a few standout photos.</div>}
								</div>
								<div className="flex flex-col sm:flex-row gap-2">
									<label className="inline-flex items-center gap-2 text-sm text-gray-300">
										<span className="bg-mid border border-border rounded-md px-3 py-2">Upload</span>
										<input type="file" accept="image/*" multiple onChange={e => addHeroFiles(e.target.files)} className="hidden" />
									</label>
									<div className="flex-1 flex gap-2">
										<input
											value={heroUrl}
											onChange={e => setHeroUrl(e.target.value)}
											placeholder="Add image URL"
											className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-white"
											onKeyDown={e => { if (e.key === 'Enter') { addHeroUrl(heroUrl); setHeroUrl('') } }}
										/>
										<Button variant="ghost" onClick={() => { addHeroUrl(heroUrl); setHeroUrl('') }}>Add</Button>
									</div>
								</div>
							</div>
							{/* Logos */}
							<div>
								<div className="text-gray-300 text-sm mb-1">Logos</div>
								<div className="flex flex-wrap gap-3 mb-2">
									{logos.map((src, idx) => (
										<div key={`logo-${idx}`} className="relative w-16 h-16 rounded-md overflow-hidden border border-border bg-surface">
											<img src={src} alt="" className="w-full h-full object-contain p-1" />
											<button type="button" className="absolute top-1 right-1 text-xs bg-mid/80 hover:bg-mid text-white rounded px-1" onClick={() => removeLogo(idx)}>Remove</button>
										</div>
									))}
									{logos.length === 0 && <div className="subtle text-sm">Add your logo(s).</div>}
								</div>
								<div className="flex flex-col sm:flex-row gap-2">
									<label className="inline-flex items-center gap-2 text-sm text-gray-300">
										<span className="bg-mid border border-border rounded-md px-3 py-2">Upload</span>
										<input type="file" accept="image/*" multiple onChange={e => addLogoFiles(e.target.files)} className="hidden" />
									</label>
									<div className="flex-1 flex gap-2">
										<input
											value={logoUrl}
											onChange={e => setLogoUrl(e.target.value)}
											placeholder="Add logo URL"
											className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-white"
											onKeyDown={e => { if (e.key === 'Enter') { addLogoUrl(logoUrl); setLogoUrl('') } }}
										/>
										<Button variant="ghost" onClick={() => { addLogoUrl(logoUrl); setLogoUrl('') }}>Add</Button>
									</div>
								</div>
							</div>
							{/* Brand Colors */}
							<div>
								<div className="text-gray-300 text-sm mb-1">Brand Colors</div>
								<div className="flex flex-wrap gap-2 mb-2">
									{brandColors.map((c, idx) => (
										<div key={`color-${idx}`} className="flex items-center gap-2 bg-mid border border-border rounded-md px-2 py-1">
											<span className="inline-block w-5 h-5 rounded-md border border-border" style={{ background: c }} />
											<span className="text-white text-sm">{c}</span>
											<button type="button" className="text-xs text-gray-300 hover:text-white" onClick={() => removeColor(idx)}>Remove</button>
										</div>
									))}
									{brandColors.length === 0 && <div className="subtle text-sm">Add brand hex codes (e.g., #FF0000).</div>}
								</div>
								<div className="flex gap-2">
									<input value={newColor} onChange={e => setNewColor(e.target.value)} placeholder="#RRGGBB or CSS color" className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-white" />
									<Button variant="ghost" onClick={addColor}>Add</Button>
								</div>
							</div>
							{/* Sample Posts */}
							<div>
								<div className="text-gray-300 text-sm mb-1">Sample Social Posts / Captions</div>
								<textarea
									value={samplePostsText}
									onChange={e => setSamplePostsText(e.target.value)}
									className="w-full bg-background border border-border rounded-md px-3 py-2 text-white min-h-[100px]"
									placeholder="One caption per line…"
								/>
								<div className="subtle text-xs mt-1">{samplePostsText.split('\n').filter(l => l.trim()).length} samples</div>
							</div>
							{/* External Deck Link */}
							<div>
								<div className="text-gray-300 text-sm mb-1">External Media Kit Link (Google Drive, Notion, PDF, etc.)</div>
								<input
									value={externalDeckUrl}
									onChange={e => setExternalDeckUrl(e.target.value)}
									className="w-full bg-background border border-border rounded-md px-3 py-2 text-white"
									placeholder="https://…"
								/>
							</div>
						</div>
					</div>

					{/* A) Support Team */}
					<div className="md:col-span-2">
						<div className="flex items-center justify-between mb-2">
							<span className="subtle text-sm">Support Team</span>
							<Button variant="ghost" onClick={addSupport}>Add Contact</Button>
						</div>
						<div className="space-y-3">
							{supportTeam.map((s, idx) => (
								<div key={`sup-${idx}`} className="bg-mid border border-border rounded-md p-3">
                                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                                        <select value={s.role} onChange={e => updateSupport(idx, { role: e.target.value as SupportContact['role'] })} className="bg-background border border-border rounded-md px-3 py-2 text-white">
                                            {SUPPORT_ROLES.map(r => <option key={r} value={r}>{r.replaceAll('_',' ')}</option>)}
                                        </select>
                                        <input value={s.name} onChange={e => updateSupport(idx, { name: e.target.value })} className="bg-background border border-border rounded-md px-3 py-2 text-white" placeholder="Name" />
                                        <input value={s.organization || ''} onChange={e => updateSupport(idx, { organization: e.target.value })} className="bg-background border border-border rounded-md px-3 py-2 text-white" placeholder="Organization" />
                                        <input value={s.email || ''} onChange={e => updateSupport(idx, { email: e.target.value })} className="bg-background border border-border rounded-md px-3 py-2 text-white" placeholder="Email" />
                                        <input value={s.phone || ''} onChange={e => updateSupport(idx, { phone: e.target.value })} className="bg-background border border-border rounded-md px-3 py-2 text-white" placeholder="Phone" />
                                        <input value={s.notes || ''} onChange={e => updateSupport(idx, { notes: e.target.value })} className="bg-background border border-border rounded-md px-3 py-2 text-white" placeholder="Notes" />
                                    </div>
									<div className="mt-2 flex justify-end">
										<Button variant="ghost" onClick={() => removeSupport(idx)}>Remove</Button>
									</div>
								</div>
							))}
							{supportTeam.length === 0 && <div className="subtle text-sm">Add coaches, trainers, and specialists who support you.</div>}
						</div>
					</div>

					{/* B) Decision Circle */}
					<div className="md:col-span-2">
						<div className="flex items-center justify-between mb-2">
							<span className="subtle text-sm">Decision Circle</span>
							<Button variant="ghost" onClick={addTrusted}>Add Contact</Button>
						</div>
						<div className="subtle text-xs mb-2">These are the people likely to be involved in partnership decisions.</div>
						<div className="space-y-3">
							{trustedCircle.map((t, idx) => (
								<div key={`tc-${idx}`} className="bg-mid border border-border rounded-md p-3">
									<div className="grid grid-cols-1 md:grid-cols-5 gap-3">
										<select value={t.role} onChange={e => updateTrusted(idx, { role: e.target.value as TrustedContact['role'] })} className="bg-background border border-border rounded-md px-3 py-2 text-white">
											{TRUSTED_ROLES.map(r => <option key={r} value={r}>{r.replaceAll('_',' ')}</option>)}
										</select>
										<input value={t.name} onChange={e => updateTrusted(idx, { name: e.target.value })} className="bg-background border border-border rounded-md px-3 py-2 text-white" placeholder="Name" />
										<input value={t.relationship || ''} onChange={e => updateTrusted(idx, { relationship: e.target.value })} className="bg-background border border-border rounded-md px-3 py-2 text-white" placeholder="Relationship" />
										<input value={t.email || ''} onChange={e => updateTrusted(idx, { email: e.target.value })} className="bg-background border border-border rounded-md px-3 py-2 text-white" placeholder="Email" />
										<input value={t.phone || ''} onChange={e => updateTrusted(idx, { phone: e.target.value })} className="bg-background border border-border rounded-md px-3 py-2 text-white" placeholder="Phone" />
									</div>
									<div className="mt-2 flex justify-end">
										<Button variant="ghost" onClick={() => removeTrusted(idx)}>Remove</Button>
									</div>
								</div>
							))}
							{trustedCircle.length === 0 && <div className="subtle text-sm">Add a parent/guardian, mentor, or advisor.</div>}
						</div>
					</div>

					{/* C) Academics & Life */}
					<div className="md:col-span-2">
						<div className="subtle text-sm mb-2">Academics & Life</div>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
							<input value={academic.schoolName || ''} onChange={e => setAcademic({ ...academic, schoolName: e.target.value })} className="bg-mid border border-border rounded-md px-3 py-2 text-white" placeholder="School name" />
							<input value={academic.level || ''} onChange={e => setAcademic({ ...academic, level: e.target.value })} className="bg-mid border border-border rounded-md px-3 py-2 text-white" placeholder="Level (e.g., high_school)" />
							<select value={academic.gpaRange || ''} onChange={e => setAcademic({ ...academic, gpaRange: (e.target.value || undefined) as any })} className="bg-mid border border-border rounded-md px-3 py-2 text-white">
								<option value="">GPA range (optional)</option>
								<option value="below_2_5">below 2.5</option>
								<option value="2_5_to_3_0">2.5 to 3.0</option>
								<option value="3_0_to_3_5">3.0 to 3.5</option>
								<option value="3_5_plus">3.5+</option>
								<option value="prefer_not_to_say">prefer not to say</option>
							</select>
						</div>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
							<input
								value={(academic.academicInterests || []).join(', ')}
								onChange={e => setAcademicInterestsFromText(e.target.value)}
								className="bg-mid border border-border rounded-md px-3 py-2 text-white"
								placeholder="Academic interests (comma-separated)"
							/>
							<div className="grid grid-cols-2 gap-3">
								<input value={academic.advisorName || ''} onChange={e => setAcademic({ ...academic, advisorName: e.target.value })} className="bg-mid border border-border rounded-md px-3 py-2 text-white" placeholder="Advisor name (optional)" />
								<input value={academic.advisorEmail || ''} onChange={e => setAcademic({ ...academic, advisorEmail: e.target.value })} className="bg-mid border border-border rounded-md px-3 py-2 text-white" placeholder="Advisor email (optional)" />
							</div>
						</div>
					</div>

					{/* D) Availability */}
					<div className="md:col-span-2">
						<div className="flex items-center justify-between mb-2">
							<span className="subtle text-sm">Availability</span>
							<Button variant="ghost" onClick={addAvailability}>Add Window</Button>
						</div>
						<div className="space-y-3">
							{availability.map((w, idx) => (
								<div key={`av-${idx}`} className="bg-mid border border-border rounded-md p-3">
									<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
										<input value={w.label} onChange={e => updateAvailability(idx, { label: e.target.value })} className="bg-background border border-border rounded-md px-3 py-2 text-white" placeholder="Label (e.g., Weekday evenings)" />
										<div className="flex flex-wrap gap-2 items-center">
											{DAYS.map(d => (
												<label key={d} className="inline-flex items-center gap-1 text-xs text-gray-300">
													<input type="checkbox" checked={(w.days || []).includes(d)} onChange={() => toggleAvailabilityDay(idx, d)} />
													<span>{d}</span>
												</label>
											))}
										</div>
										<input value={w.timeRange || ''} onChange={e => updateAvailability(idx, { timeRange: e.target.value })} className="bg-background border border-border rounded-md px-3 py-2 text-white" placeholder="Time range (e.g., 5–8pm)" />
									</div>
									<div className="mt-2 flex justify-end">
										<Button variant="ghost" onClick={() => removeAvailability(idx)}>Remove</Button>
									</div>
								</div>
							))}
							{availability.length === 0 && <div className="subtle text-sm">Add 1–3 windows so businesses can schedule realistically.</div>}
						</div>
						<div className="mt-3">
							<label className="inline-flex items-center gap-2 text-sm text-gray-300">
								<input type="checkbox" checked={internationalFlag} onChange={e => setInternationalFlag(e.target.checked)} />
								<span>International student / special work restrictions</span>
							</label>
						</div>
					</div>

					{/* E) My Story */}
					<div className="md:col-span-2">
						<div className="subtle text-sm mb-2">My Story</div>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
							<textarea
								value={(performanceStory.keyMilestones || []).join('\n')}
								onChange={e => setMilestonesFromText(e.target.value)}
								className="bg-mid border border-border rounded-md px-3 py-2 text-white min-h-[120px]"
								placeholder="Key milestones (one per line)"
							/>
							<div className="grid grid-cols-1 gap-3">
								<input
									value={performanceStory.currentFocus || ''}
									onChange={e => setPerformanceStory({ ...performanceStory, currentFocus: e.target.value })}
									className="bg-mid border border-border rounded-md px-3 py-2 text-white"
									placeholder="Current focus (e.g., Off-season speed & route-running)"
								/>
								<input
									value={(performanceStory.futureGoals || []).join(', ')}
									onChange={e => setFutureGoalsFromText(e.target.value)}
									className="bg-mid border border-border rounded-md px-3 py-2 text-white"
									placeholder="Future goals (comma-separated)"
								/>
							</div>
						</div>
					</div>

					{/* F) Training & Recovery Log moved to Extras */}
					<div className="md:col-span-2">
						<div className="subtle text-sm mb-2">Extras</div>
						<div className="bg-mid border border-border rounded-md p-3 text-gray-300 text-sm">
							Training & Recovery Log has moved to the Extras section.
						</div>
					</div>

					{/* G) Monetization Interests */}
					<div className="md:col-span-2">
						<div className="subtle text-sm mb-2">Monetization Interests</div>
						<div className="flex flex-wrap gap-2">
							{MONETIZATION_OPTIONS.map(tag => (
								<button
									type="button"
									key={tag}
									onClick={() => toggleMonetization(tag)}
									className={`px-3 py-1 rounded-md border ${monetizationInterests.includes(tag) ? 'border-brand-red text-white bg-brand-red/20' : 'border-border text-gray-300 hover:bg-mid'}`}
								>
									{tag}
								</button>
							))}
						</div>
					</div>

					{/* H) Compliance & Contacts (NIL) */}
					<div className="md:col-span-2">
						<div className="subtle text-sm mb-2">Compliance & Contacts (NIL)</div>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
							<input value={complianceEmail} onChange={e => setComplianceEmail(e.target.value)} className="bg-mid border border-border rounded-md px-3 py-2 text-white" placeholder="Compliance contact email (school)" />
							<input value={policyUrl} onChange={e => setPolicyUrl(e.target.value)} className="bg-mid border border-border rounded-md px-3 py-2 text-white" placeholder="School NIL policy URL" />
						</div>
						<div className="mt-3">
							<div className="text-gray-300 text-sm mb-2">Associated Collective (optional)</div>
							<div className="grid grid-cols-1 md:grid-cols-4 gap-3">
								<input value={collectiveName} onChange={e => setCollectiveName(e.target.value)} className="bg-mid border border-border rounded-md px-3 py-2 text-white md:col-span-2" placeholder="Collective name" />
								<input value={collectiveContactName} onChange={e => setCollectiveContactName(e.target.value)} className="bg-mid border border-border rounded-md px-3 py-2 text-white" placeholder="Contact name" />
								<input value={collectiveContactEmail} onChange={e => setCollectiveContactEmail(e.target.value)} className="bg-mid border border-border rounded-md px-3 py-2 text-white" placeholder="Contact email" />
							</div>
							<input value={collectiveNotes} onChange={e => setCollectiveNotes(e.target.value)} className="mt-3 w-full bg-mid border border-border rounded-md px-3 py-2 text-white" placeholder="Notes about the collective" />
						</div>
					</div>

					{/* Recruiting Profile */}
					<div className="md:col-span-2">
						<div className="text-white font-semibold mb-2">Recruiting Profile</div>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="bg-mid border border-border rounded-md p-3">
								<div className="text-gray-300 text-sm mb-2">Physical Attributes</div>
								<div className="grid grid-cols-1 md:grid-cols-4 gap-2">
									<input value={heightFeet} onChange={e => setHeightFeet(e.target.value === '' ? '' : Number(e.target.value))} className="bg-background border border-border rounded-md px-3 py-2 text-white" placeholder="Height ft" />
									<input value={heightInchesPart} onChange={e => setHeightInchesPart(e.target.value === '' ? '' : Number(e.target.value))} className="bg-background border border-border rounded-md px-3 py-2 text-white" placeholder="in" />
									<input value={weightLbs} onChange={e => setWeightLbs(e.target.value === '' ? '' : Number(e.target.value))} className="bg-background border border-border rounded-md px-3 py-2 text-white" placeholder="Weight lbs" />
									<select value={dominantHand} onChange={e => setDominantHand(e.target.value as any)} className="bg-background border border-border rounded-md px-3 py-2 text-white">
										<option value="">Dominant hand</option>
										<option value="left">left</option>
										<option value="right">right</option>
										<option value="both">both</option>
									</select>
								</div>
								<div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
									<input value={wingspanInches} onChange={e => setWingspanInches(e.target.value === '' ? '' : Number(e.target.value))} className="bg-background border border-border rounded-md px-3 py-2 text-white" placeholder="Wingspan (in)" />
									<input value={handSizeInches} onChange={e => setHandSizeInches(e.target.value === '' ? '' : Number(e.target.value))} className="bg-background border border-border rounded-md px-3 py-2 text-white" placeholder="Hand size (in)" />
								</div>
								<div className="text-xs text-gray-400 mt-2">
									Height will be stored as total inches. Example: 6'1&quot; → 73.
								</div>
							</div>

							<div className="bg-mid border border-border rounded-md p-3">
								<div className="flex items-center justify-between mb-2">
									<div className="text-gray-300 text-sm">Sport-Specific Metrics</div>
									<Button variant="ghost" onClick={() => setSportMetrics(curr => [...curr, { sport: '', metricName: '', value: '' }])}>Add metric</Button>
								</div>
								<div className="space-y-2">
									{sportMetrics.map((m, idx) => (
										<div key={`met-${idx}`} className="grid grid-cols-1 md:grid-cols-6 gap-2">
											<input value={m.sport} onChange={e => setSportMetrics(curr => curr.map((x,i) => i===idx ? { ...x, sport: e.target.value } : x))} className="bg-background border border-border rounded-md px-3 py-2 text-white" placeholder="Sport" />
											<input value={m.position || ''} onChange={e => setSportMetrics(curr => curr.map((x,i) => i===idx ? { ...x, position: e.target.value } : x))} className="bg-background border border-border rounded-md px-3 py-2 text-white" placeholder="Position" />
											<input value={m.metricName} onChange={e => setSportMetrics(curr => curr.map((x,i) => i===idx ? { ...x, metricName: e.target.value } : x))} className="bg-background border border-border rounded-md px-3 py-2 text-white" placeholder='Metric (e.g., "40-yard dash")' />
											<input value={m.value} onChange={e => setSportMetrics(curr => curr.map((x,i) => i===idx ? { ...x, value: e.target.value } : x))} className="bg-background border border-border rounded-md px-3 py-2 text-white" placeholder='Value (e.g., "4.55s")' />
											<input type="date" value={m.dateRecorded || ''} onChange={e => setSportMetrics(curr => curr.map((x,i) => i===idx ? { ...x, dateRecorded: e.target.value || undefined } : x))} className="bg-background border border-border rounded-md px-3 py-2 text-white" />
											<div className="flex gap-2">
												<input value={m.verifiedBy || ''} onChange={e => setSportMetrics(curr => curr.map((x,i) => i===idx ? { ...x, verifiedBy: e.target.value || undefined } : x))} className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-white" placeholder='Verified by (e.g., "Coach")' />
												<Button variant="ghost" onClick={() => setSportMetrics(curr => curr.filter((_,i) => i!==idx))}>Remove</Button>
											</div>
										</div>
									))}
									{sportMetrics.length === 0 && <div className="subtle text-sm">Add metrics like 40-yard dash, vertical, bench, etc.</div>}
								</div>
							</div>

							<div className="md:col-span-2 bg-mid border border-border rounded-md p-3">
								<div className="flex items-center justify-between mb-2">
									<div className="text-gray-300 text-sm">Game Film Links</div>
									<Button variant="ghost" onClick={() => setGameFilm(curr => [...curr, { platform: 'hudl', label: '', url: '' }])}>Add link</Button>
								</div>
								<div className="space-y-2">
									{gameFilm.map((g, idx) => (
										<div key={`gf-${idx}`} className="grid grid-cols-1 md:grid-cols-6 gap-2">
											<select value={g.platform} onChange={e => setGameFilm(curr => curr.map((x,i) => i===idx ? { ...x, platform: e.target.value as any } : x))} className="bg-background border border-border rounded-md px-3 py-2 text-white">
												<option value="hudl">Hudl</option>
												<option value="youtube">YouTube</option>
												<option value="vimeo">Vimeo</option>
												<option value="other">Other</option>
											</select>
											<input value={g.label} onChange={e => setGameFilm(curr => curr.map((x,i) => i===idx ? { ...x, label: e.target.value } : x))} className="bg-background border border-border rounded-md px-3 py-2 text-white md:col-span-2" placeholder="Label (e.g., Junior season highlights)" />
											<input value={g.url} onChange={e => setGameFilm(curr => curr.map((x,i) => i===idx ? { ...x, url: e.target.value } : x))} className="bg-background border border-border rounded-md px-3 py-2 text-white md:col-span-3" placeholder="URL" />
											<div className="md:col-span-6 flex justify-end">
												<Button variant="ghost" onClick={() => setGameFilm(curr => curr.filter((_,i) => i!==idx))}>Remove</Button>
											</div>
										</div>
									))}
									{gameFilm.length === 0 && <div className="subtle text-sm">Add Hudl/YouTube links so recruiters can evaluate quickly.</div>}
								</div>
							</div>
						</div>
					</div>
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
			<Card title="Brand & My Story">
				<div className="space-y-4">
					{/* Performance Story */}
					{(performanceStory.keyMilestones.length || performanceStory.currentFocus || (performanceStory.futureGoals || []).length) ? (
						<div>
							<div className="text-white font-semibold mb-1">My Story</div>
							{performanceStory.currentFocus && <div className="text-gray-200 text-sm mb-1">Current focus: {performanceStory.currentFocus}</div>}
							{performanceStory.keyMilestones.length > 0 && (
								<div className="text-gray-300 text-sm">
									<div className="subtle text-xs mb-1">Key milestones</div>
									<ul className="list-disc list-inside space-y-1">
										{performanceStory.keyMilestones.map((m, i) => <li key={`km-${i}`}>{m}</li>)}
									</ul>
								</div>
							)}
							{(performanceStory.futureGoals || []).length > 0 && (
								<div className="text-gray-300 text-sm mt-2">
									<div className="subtle text-xs mb-1">Future goals</div>
									<div>{(performanceStory.futureGoals || []).join(' • ')}</div>
								</div>
							)}
						</div>
					) : <div className="subtle text-sm">Add your performance story to help brands connect with your journey.</div>}

					{/* Support Team snippet */}
					{supportTeam.length > 0 && (
						<div>
							<div className="text-white font-semibold mb-1">Support Team</div>
							<ul className="list-disc list-inside space-y-1 text-gray-200 text-sm">
								{supportTeam.map((s, i) => <li key={`ss-${i}`}>{s.role.replaceAll('_',' ')} — {s.name}</li>)}
							</ul>
						</div>
					)}

					{/* Academics snippet */}
					{(academic.schoolName || (academic.academicInterests || []).length) && (
						<div>
							<div className="text-white font-semibold mb-1">Academic & Life</div>
							<div className="text-gray-200 text-sm">{academic.schoolName || '—'}</div>
							{(academic.academicInterests || []).length > 0 && (
								<div className="text-gray-300 text-xs mt-1">Interests: {(academic.academicInterests || []).join(' • ')}</div>
							)}
						</div>
					)}

					{/* Monetization snippet */}
					{monetizationInterests.length > 0 && (
						<div>
							<div className="text-white font-semibold mb-1">What I’m looking for</div>
							<div className="text-gray-200 text-sm">{monetizationInterests.join(' • ')}</div>
						</div>
					)}
				</div>
			</Card>
			<Card title="Media Kit">
				{heroImages.length === 0 && logos.length === 0 && brandColors.length === 0 && samplePostsText.split('\n').filter(l => l.trim()).length === 0 && !externalDeckUrl.trim() ? (
					<div className="subtle text-sm">Add a media kit to make it easier for businesses to see how you present your brand.</div>
				) : (
					<div className="space-y-5">
						{heroImages.length > 0 && (
							<div>
								<div className="text-white font-semibold mb-2">Hero Images</div>
								<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
									{heroImages.map((src, idx) => (
										<div key={`ph-${idx}`} className="w-full h-28 bg-surface border border-border rounded-md overflow-hidden">
											<img src={src} alt="" className="w-full h-full object-cover" />
										</div>
									))}
								</div>
							</div>
						)}
						{logos.length > 0 && (
							<div>
								<div className="text-white font-semibold mb-2">Logos</div>
								<div className="flex flex-wrap gap-3">
									{logos.map((src, idx) => (
										<div key={`pl-${idx}`} className="w-16 h-16 bg-surface border border-border rounded-md overflow-hidden flex items-center justify-center">
											<img src={src} alt="" className="w-full h-full object-contain p-1" />
										</div>
									))}
								</div>
							</div>
						)}
						{brandColors.length > 0 && (
							<div>
								<div className="text-white font-semibold mb-2">Brand Colors</div>
								<div className="flex flex-wrap gap-2">
									{brandColors.map((c, idx) => (
										<div key={`pc-${idx}`} className="flex items-center gap-2">
											<span className="inline-block w-6 h-6 rounded-md border border-border" style={{ background: c }} />
											<span className="text-gray-300 text-xs">{c}</span>
										</div>
									))}
								</div>
							</div>
						)}
						{samplePostsText.split('\n').filter(l => l.trim()).length > 0 && (
							<div>
								<div className="text-white font-semibold mb-2">Sample Posts</div>
								<ul className="list-disc pl-6 space-y-1 text-gray-200 text-sm">
									{samplePostsText.split('\n').map((line, idx) => line.trim() && <li key={`sp-${idx}`}>{line.trim()}</li>)}
								</ul>
							</div>
						)}
						{externalDeckUrl.trim() && (
							<div>
								<a href={externalDeckUrl} target="_blank" rel="noreferrer" className="inline-block bg-brand-red text-white rounded-md px-3 py-2 hover:opacity-90">
									View External Deck
								</a>
							</div>
						)}
					</div>
				)}
			</Card>
		</div>
	)
}


