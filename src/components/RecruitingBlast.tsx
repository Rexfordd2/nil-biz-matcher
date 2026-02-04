import { useEffect, useMemo, useState } from 'react'
import Card from './ui/Card'
import Button from './ui/Button'
import Input from './ui/Input'
import Textarea from './ui/Textarea'
import { useToast } from './ui/Toast'
import type { AthleteProfile } from '../types'
import type { CoachOutreach, HighlightClip } from '../recruiting/blastTypes'
import { useAuth } from '../context/AuthContext'
import {
	createOutreach,
	deleteClip,
	getClips,
	getOutreach,
	recordClickByToken,
	recordOpenByToken,
	upsertClip
} from '../recruiting/blastStorage'
import { supabase } from '../lib/supabaseClient'

type Props = {
	athlete: AthleteProfile | null
}

export default function RecruitingBlast({ athlete }: Props) {
	const { show } = useToast()
	const { user } = useAuth()

	type Recipient = { id: string; name: string; email: string; orgId: string; orgName: string }
	const [recipients, setRecipients] = useState<Recipient[]>([])
	const [clips, setClips] = useState<HighlightClip[]>([])
	const [outreach, setOutreach] = useState<CoachOutreach[]>([])

	const [clipForm, setClipForm] = useState<Omit<HighlightClip, 'id' | 'createdAt'>>({
		athleteId: athlete?.id || '',
		title: '',
		videoUrl: '',
		description: ''
	})

	const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([])
	const [selectedClipId, setSelectedClipId] = useState<string>('')
	const [subject, setSubject] = useState<string>('')
	const [body, setBody] = useState<string>('')

	function generateTemplate() {
		const name = (user as any)?.fullName || '[Your Name]'
		const position = '[Position]'
		const grad = '[Grad Year]'
		const stats = '[Key stats/accolades]'
		const hudl = '[HUDL link]'
		const highlights = '[Highlights video link]'
		const profile = '[Profile/Resume link]'
		return [
			'Hi Coach [Last Name],',
			'',
			`My name is ${name}, a ${position} in the class of ${grad}.`,
			`Quick highlights: ${stats}.`,
			'',
			'Why I’m reaching out:',
			'- Briefly share fit/interest in your program (1–2 sentences).',
			'',
			'Links:',
			`- HUDL: ${hudl}`,
			`- Highlights: ${highlights}`,
			`- Profile: ${profile}`,
			'',
			'Next step:',
			'- I’d appreciate any feedback and the chance to connect.',
			'- Happy to share transcripts, schedule, and references upon request.',
			'',
			'Thank you for your time,',
			`${name}`,
			'[High School / Club]',
			'[City, State]',
			'[Phone] • [Email]'
		].join('\n')
	}

	// Insert default template on first load if body is empty
	useEffect(() => {
		if (!body) {
			setBody(generateTemplate())
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		setClips(getClips(athlete?.id))
		setOutreach(getOutreach(athlete?.id))
	}, [athlete?.id])

	// Load recipients from My Targets' org contacts (with email)
	useEffect(() => {
		let cancelled = false
		async function loadRecipients() {
			if (!supabase || !user) {
				if (!cancelled) setRecipients([])
				return
			}
			// 1) Get user's target org IDs
			const { data: targets, error: tErr } = await supabase
				.from('user_targets')
				.select('org_id')
				.eq('user_id', user.id)
			if (cancelled) return
			if (tErr || !Array.isArray(targets) || targets.length === 0) {
				setRecipients([])
				return
			}
			const orgIds = Array.from(new Set((targets as any[]).map(r => r.org_id as string))).filter(Boolean)
			// 2) Map org_id -> org_name
			const { data: orgsData } = await supabase
				.from('orgs')
				.select('id, name')
				.in('id', orgIds)
				.eq('user_id', user.id)
			const orgNameById = new Map<string, string>((orgsData || []).map((o: any) => [String(o.id), String(o.name || 'Org')]))
			// 3) Load contacts with emails
			const { data: contactsData } = await supabase
				.from('org_contacts')
				.select('id, org_id, name, email')
				.in('org_id', orgIds)
				.eq('user_id', user.id)
			const next: Recipient[] = (contactsData || [])
				.filter((c: any) => typeof c?.email === 'string' && c.email.trim())
				.map((c: any) => ({
					id: String(c.id),
					name: String(c.name || 'Coach'),
					email: String(c.email),
					orgId: String(c.org_id),
					orgName: orgNameById.get(String(c.org_id)) || 'Org'
				}))
			if (!cancelled) setRecipients(next)
		}
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		loadRecipients()
		return () => { cancelled = true }
	}, [user])

	useEffect(() => {
		// Keep athleteId in clip form in sync
		setClipForm(prev => ({ ...prev, athleteId: athlete?.id || '' }))
	}, [athlete?.id])

	const allSelected = useMemo(
		() => selectedRecipientIds.length > 0 && selectedRecipientIds.length === recipients.length,
		[selectedRecipientIds, recipients.length]
	)

	function toggleAllCoaches() {
		if (allSelected) {
			setSelectedRecipientIds([])
		} else {
			setSelectedRecipientIds(recipients.map(r => r.id))
		}
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
		if (selectedRecipientIds.length === 0) {
			show('Select at least one coach')
			return
		}
		const selected = recipients.filter(r => selectedRecipientIds.includes(r.id) && !!r.email)
		if (selected.length === 0) {
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
					coaches: selected.map(r => ({ name: r.name || r.orgName, email: r.email })),
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
			for (const recipientId of selectedRecipientIds) {
				createOutreach({
					athleteId: athlete.id,
					coachId: recipientId,
					clipId: selectedClipId,
					subject,
					body
				})
			}
			setOutreach(getOutreach(athlete.id))
			show(`Sent to ${selectedRecipientIds.length} recipient${selectedRecipientIds.length > 1 ? 's' : ''}`)
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
			<Card title="Recipients (from My Targets)">
				<div className="space-y-3">
					{recipients.length === 0 ? (
						<div className="subtle text-sm">No contacts found in My Targets.</div>
					) : (
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<label className="flex items-center gap-2 text-sm text-gray-200">
									<input type="checkbox" checked={allSelected} onChange={toggleAllCoaches} />
									<span>Select all</span>
								</label>
							</div>
							<ul className="space-y-2">
								{recipients.map(r => (
									<li key={r.id} className="bg-surface border border-border rounded-md p-3">
										<div className="flex items-center justify-between gap-3">
											<label className="flex items-center gap-2">
												<input
													type="checkbox"
													checked={selectedRecipientIds.includes(r.id)}
													onChange={(e) => {
														if (e.target.checked) setSelectedRecipientIds(prev => [...prev, r.id])
														else setSelectedRecipientIds(prev => prev.filter(id => id !== r.id))
													}}
												/>
												<div>
													<div className="text-white font-semibold">{r.name || 'Coach'}</div>
													<div className="text-xs text-gray-400">{[r.email, r.orgName].filter(Boolean).join(' • ')}</div>
												</div>
											</label>
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
					<div className="flex items-center gap-2">
						<Input placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
						<Button variant="ghost" className="whitespace-nowrap" onClick={() => setBody(generateTemplate())}>Insert Template</Button>
					</div>
					<Textarea className="min-h-[200px]" placeholder="Body" value={body} onChange={e => setBody(e.target.value)} />
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
									const coach = recipients.find(c => c.id === o.coachId)
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


