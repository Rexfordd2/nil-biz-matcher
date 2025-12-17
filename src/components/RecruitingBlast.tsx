import { useEffect, useMemo, useState } from 'react'
import Card from './ui/Card'
import Button from './ui/Button'
import Input from './ui/Input'
import Textarea from './ui/Textarea'
import { useToast } from './ui/Toast'
import type { AthleteProfile } from '../types'
import type { CoachOutreach, HighlightClip, RecruitingCoach } from '../recruiting/blastTypes'
import { useAuth } from '../context/AuthContext'
import {
	createOutreach,
	deleteCoach,
	deleteClip,
	getClips,
	getCoaches,
	getOutreach,
	recordClickByToken,
	recordOpenByToken,
	upsertCoach,
	upsertClip
} from '../recruiting/blastStorage'

type Props = {
	athlete: AthleteProfile | null
}

export default function RecruitingBlast({ athlete }: Props) {
	const { show } = useToast()
	const { user } = useAuth()
	const [coaches, setCoaches] = useState<RecruitingCoach[]>([])
	const [clips, setClips] = useState<HighlightClip[]>([])
	const [outreach, setOutreach] = useState<CoachOutreach[]>([])

	const [coachForm, setCoachForm] = useState<Omit<RecruitingCoach, 'id' | 'createdAt' | 'updatedAt'>>({
		name: '',
		email: '',
		school: '',
		sport: '',
		level: ''
	})
	const [clipForm, setClipForm] = useState<Omit<HighlightClip, 'id' | 'createdAt'>>({
		athleteId: athlete?.id || '',
		title: '',
		videoUrl: '',
		description: ''
	})

	const [selectedCoachIds, setSelectedCoachIds] = useState<string[]>([])
	const [selectedClipId, setSelectedClipId] = useState<string>('')
	const [subject, setSubject] = useState<string>('')
	const [body, setBody] = useState<string>('')

	useEffect(() => {
		setCoaches(getCoaches())
		setClips(getClips(athlete?.id))
		setOutreach(getOutreach(athlete?.id))
	}, [athlete?.id])

	useEffect(() => {
		// Keep athleteId in clip form in sync
		setClipForm(prev => ({ ...prev, athleteId: athlete?.id || '' }))
	}, [athlete?.id])

	const allSelected = useMemo(() => selectedCoachIds.length > 0 && selectedCoachIds.length === coaches.length, [selectedCoachIds, coaches.length])

	function toggleAllCoaches() {
		if (allSelected) {
			setSelectedCoachIds([])
		} else {
			setSelectedCoachIds(coaches.map(c => c.id))
		}
	}

	function onAddCoach() {
		if (!coachForm.name || !coachForm.email) {
			show('Name and email are required')
			return
		}
		const created = upsertCoach(coachForm)
		setCoaches(getCoaches())
		setCoachForm({ name: '', email: '', school: '', sport: '', level: '' })
		show(`Added ${created.name}`)
	}

	function onDeleteCoach(id: string) {
		deleteCoach(id)
		setCoaches(getCoaches())
		setSelectedCoachIds(curr => curr.filter(cid => cid !== id))
	}

	function onAddClip() {
		if (!athlete?.id) {
			show('Create your Athlete Profile first')
			return
		}
		if (!clipForm.title || !clipForm.videoUrl) {
			show('Title and video URL are required')
			return
		}
		const created = upsertClip(clipForm)
		setClips(getClips(athlete.id))
		setClipForm({ athleteId: athlete.id, title: '', videoUrl: '', description: '' })
		if (!selectedClipId) setSelectedClipId(created.id)
		show('Clip saved')
	}

	function onDeleteClip(id: string) {
		deleteClip(id)
		setClips(getClips(athlete?.id))
		if (selectedClipId === id) setSelectedClipId('')
	}

	async function onSendBlast() {
		if (!user) {
			show('Please log in to send emails')
			return
		}
		if (!athlete?.id) {
			show('Create your Athlete Profile first')
			return
		}
		if (!selectedClipId) {
			show('Select a clip')
			return
		}
		if (!subject || !body) {
			show('Subject and body are required')
			return
		}
		if (selectedCoachIds.length === 0) {
			show('Select at least one coach')
			return
		}
		const selectedCoaches = coaches.filter(c => selectedCoachIds.includes(c.id) && !!c.email)
		if (selectedCoaches.length === 0) {
			show('Selected coaches have no emails')
			return
		}
		const clip = clips.find(c => c.id === selectedClipId)
		if (!clip?.videoUrl) {
			show('Clip is missing a video URL')
			return
		}

		try {
			const res = await fetch('/api/recruiting/send', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					athlete: { fullName: user.fullName, email: user.email, id: user.id },
					clipUrl: clip.videoUrl,
					coaches: selectedCoaches.map(c => ({ name: c.name, email: c.email })),
					subject,
					body
				})
			})
			if (res.status === 503) {
				show('Email sending is not configured yet. Ask an admin to set SMTP.')
				return
			}
			if (res.status === 404) {
				// Local dev without API server
				show('Email service unavailable in local dev. Configure SMTP/server to send.')
				return
			}
			if (!res.ok) {
				const err = await res.json().catch(() => ({}))
				show(err?.error || 'Failed to send emails')
				return
			}

			// Mirror locally for user-facing history
			for (const coachId of selectedCoachIds) {
				createOutreach({
					athleteId: athlete.id,
					coachId,
					clipId: selectedClipId,
					subject,
					body
				})
			}
			setOutreach(getOutreach(athlete.id))
			show(`Sent to ${selectedCoachIds.length} coach${selectedCoachIds.length > 1 ? 'es' : ''}`)
		} catch {
			show('Email service unavailable in local dev. Configure SMTP/server to send.')
		}
	}

	function simulateOpen(o: CoachOutreach) {
		recordOpenByToken(o.trackToken)
		setOutreach(getOutreach(athlete?.id))
	}

	function simulateClick(o: CoachOutreach) {
		recordClickByToken(o.trackToken)
		setOutreach(getOutreach(athlete?.id))
	}

	return (
		<div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
			<Card title="Coaches">
				<div className="space-y-3">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
						<Input placeholder="Name" value={coachForm.name} onChange={e => setCoachForm({ ...coachForm, name: e.target.value })} />
						<Input placeholder="Email" value={coachForm.email} onChange={e => setCoachForm({ ...coachForm, email: e.target.value })} />
						<Input placeholder="School" value={coachForm.school} onChange={e => setCoachForm({ ...coachForm, school: e.target.value })} />
						<Input placeholder="Sport" value={coachForm.sport} onChange={e => setCoachForm({ ...coachForm, sport: e.target.value })} />
						<Input placeholder="Level (e.g., D1, NAIA)" value={coachForm.level} onChange={e => setCoachForm({ ...coachForm, level: e.target.value })} />
					</div>
					<div className="flex justify-end">
						<Button onClick={onAddCoach}>Add Coach</Button>
					</div>
					{coaches.length === 0 ? (
						<div className="subtle text-sm">No coaches yet.</div>
					) : (
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<label className="flex items-center gap-2 text-sm text-gray-200">
									<input type="checkbox" checked={allSelected} onChange={toggleAllCoaches} />
									<span>Select all</span>
								</label>
							</div>
							<ul className="space-y-2">
								{coaches.map(c => (
									<li key={c.id} className="bg-surface border border-border rounded-md p-3">
										<div className="flex items-center justify-between gap-3">
											<label className="flex items-center gap-2">
												<input
													type="checkbox"
													checked={selectedCoachIds.includes(c.id)}
													onChange={(e) => {
														if (e.target.checked) setSelectedCoachIds(prev => [...prev, c.id])
														else setSelectedCoachIds(prev => prev.filter(id => id !== c.id))
													}}
												/>
												<div>
													<div className="text-white font-semibold">{c.name}</div>
													<div className="text-xs text-gray-400">{[c.email, c.school, c.level].filter(Boolean).join(' • ')}</div>
												</div>
											</label>
											<Button variant="ghost" onClick={() => onDeleteCoach(c.id)}>Remove</Button>
										</div>
									</li>
								))}
							</ul>
						</div>
					)}
				</div>
			</Card>

			<Card title="Highlight Clips">
				<div className="space-y-3">
					<div className="grid grid-cols-1 gap-2">
						<Input placeholder="Title" value={clipForm.title} onChange={e => setClipForm({ ...clipForm, title: e.target.value })} />
						<Input placeholder="Video URL (Hudl/YouTube)" value={clipForm.videoUrl} onChange={e => setClipForm({ ...clipForm, videoUrl: e.target.value })} />
						<Textarea placeholder="Description (optional)" value={clipForm.description || ''} onChange={e => setClipForm({ ...clipForm, description: e.target.value })} />
					</div>
					<div className="flex justify-end">
						<Button onClick={onAddClip}>Save Clip</Button>
					</div>
					{clips.length === 0 ? (
						<div className="subtle text-sm">No clips yet.</div>
					) : (
						<ul className="space-y-2">
							{clips.map(c => (
								<li key={c.id} className="bg-surface border border-border rounded-md p-3">
									<div className="flex items-center justify-between gap-3">
										<label className="flex items-center gap-2">
											<input type="radio" name="clip" checked={selectedClipId === c.id} onChange={() => setSelectedClipId(c.id)} />
											<div>
												<div className="text-white font-semibold">{c.title}</div>
												<div className="text-xs text-blue-300 truncate">{c.videoUrl}</div>
											</div>
										</label>
										<Button variant="ghost" onClick={() => onDeleteClip(c.id)}>Remove</Button>
									</div>
								</li>
							))}
						</ul>
					)}
				</div>
			</Card>

			<Card title="Compose & Send">
				<div className="space-y-3">
					<Input placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
					<Textarea className="min-h-[160px]" placeholder="Body" value={body} onChange={e => setBody(e.target.value)} />
					<div className="flex justify-end">
						<Button onClick={onSendBlast}>Send Blast</Button>
					</div>
					<div className="mt-4">
						<div className="text-white font-semibold mb-2">Recent Outreach</div>
						{outreach.length === 0 ? (
							<div className="subtle text-sm">No outreach records yet.</div>
						) : (
							<ul className="space-y-2">
								{outreach.slice(0, 10).map(o => {
									const coach = coaches.find(c => c.id === o.coachId)
									const clip = clips.find(c => c.id === o.clipId)
									return (
										<li key={o.id} className="bg-surface border border-border rounded-md p-3">
											<div className="flex items-center justify-between gap-3">
												<div>
													<div className="text-white font-semibold">{coach?.name || 'Coach'} — <span className="text-xs text-gray-300">{o.status}</span></div>
													<div className="text-xs text-gray-400 truncate">{o.subject}</div>
													<div className="text-xs text-gray-500 truncate">{clip?.title}</div>
												</div>
												<div className="flex items-center gap-2">
													<div className="text-xs text-gray-300">Opens: {o.openCount} • Clicks: {o.clickCount}</div>
													<Button variant="ghost" onClick={() => simulateOpen(o)}>Sim Open</Button>
													<Button variant="ghost" onClick={() => simulateClick(o)}>Sim Click</Button>
												</div>
											</div>
										</li>
									)
								})}
							</ul>
						)}
					</div>
				</div>
			</Card>
		</div>
	)
}


