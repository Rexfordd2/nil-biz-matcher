import { useEffect, useState } from 'react'
import Card from './ui/Card'
import Button from './ui/Button'
import Input from './ui/Input'
import Textarea from './ui/Textarea'
import { useToast } from './ui/Toast'
import type { AthleteProfile } from '../types'
import type { CoachOutreach, HighlightClip, OutreachDraft } from '../recruiting/blastTypes'
import { useAuth } from '../context/AuthContext'
import {
	createOutreach,
	deleteClip,
	deleteOutreachDraft,
	getClips,
	getOutreach,
	getOutreachDrafts,
	recordClickByToken,
	recordOpenByToken,
	upsertClip,
	upsertOutreachDraft
} from '../recruiting/blastStorage'
import { supabase } from '../lib/supabaseClient'
import { isMinorAthlete, normalizeProductRole } from '../lib/productRole'

type Props = {
	athlete: AthleteProfile | null
}

type Recipient = { id: string; name: string; email: string; orgId: string; orgName: string }

type SendCapability = { sendEnabled: boolean }

export function personalizeDraftBody(body: string, recipientName: string): string {
	const parts = recipientName.trim().split(/\s+/).filter(Boolean)
	const last = parts.length > 0 ? parts[parts.length - 1] : ''
	return last ? body.split('[Last Name]').join(last) : body
}

async function accessToken(): Promise<string | null> {
	if (!supabase) return null
	try {
		const { data } = await supabase.auth.getSession()
		return data.session?.access_token ?? null
	} catch {
		return null
	}
}

/**
 * Outreach Drafts (formerly Recruiting Blast): draft, review, and copy coach
 * emails. Real sending is only offered when the server reports that this
 * account is permitted; the server enforces the same policy on every send.
 */
export default function OutreachDrafts({ athlete }: Props) {
	const { show } = useToast()
	const { user } = useAuth()
	const role = normalizeProductRole(user?.role)
	const minor = isMinorAthlete(role)
	const draftOwnerId = athlete?.id || 'anonymous'

	const [recipients, setRecipients] = useState<Recipient[]>([])
	const [clips, setClips] = useState<HighlightClip[]>([])
	const [outreach, setOutreach] = useState<CoachOutreach[]>([])
	const [drafts, setDrafts] = useState<OutreachDraft[]>([])
	const [capability, setCapability] = useState<SendCapability>({ sendEnabled: false })

	const [clipForm, setClipForm] = useState<Omit<HighlightClip, 'id' | 'createdAt'>>({
		athleteId: athlete?.id || '',
		title: '',
		videoUrl: '',
		description: ''
	})

	const [draftId, setDraftId] = useState<string | undefined>(undefined)
	const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([])
	const [selectedClipId, setSelectedClipId] = useState<string>('')
	const [subject, setSubject] = useState<string>('')
	const [body, setBody] = useState<string>('')
	const [sendingTo, setSendingTo] = useState<string | null>(null)

	function generateTemplate() {
		const name = user?.fullName || '[Your Name]'
		return [
			'Hi Coach [Last Name],',
			'',
			`My name is ${name}, a [Position] in the class of [Grad Year].`,
			'Quick highlights: [Key stats/accolades].',
			'',
			'Why I’m reaching out:',
			'- Briefly share fit/interest in your program (1–2 sentences).',
			'',
			'Links:',
			'- HUDL: [HUDL link]',
			'- Highlights: [Highlights video link]',
			'- Profile: [Profile/Resume link]',
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

	useEffect(() => {
		if (!body) setBody(generateTemplate())
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		setClips(getClips(athlete?.id))
		setOutreach(getOutreach(athlete?.id))
		setDrafts(getOutreachDrafts(draftOwnerId))
	}, [athlete?.id, draftOwnerId])

	useEffect(() => {
		setClipForm(prev => ({ ...prev, athleteId: athlete?.id || '' }))
	}, [athlete?.id])

	// Load recipients from My Targets' org contacts (with email)
	useEffect(() => {
		let cancelled = false
		async function loadRecipients() {
			if (!supabase || !user) {
				if (!cancelled) setRecipients([])
				return
			}
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
			const { data: orgsData } = await supabase
				.from('orgs')
				.select('id, name')
				.in('id', orgIds)
				.eq('user_id', user.id)
			const orgNameById = new Map<string, string>((orgsData || []).map((o: any) => [String(o.id), String(o.name || 'Org')]))
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
		void loadRecipients()
		return () => { cancelled = true }
	}, [user])

	// Real sending is never offered to minor athletes, regardless of server config.
	useEffect(() => {
		let cancelled = false
		async function loadCapability() {
			if (minor || !user) {
				setCapability({ sendEnabled: false })
				return
			}
			try {
				const token = await accessToken()
				const res = await fetch('/api/recruiting/send', {
					method: 'GET',
					headers: token ? { Authorization: `Bearer ${token}` } : undefined
				})
				const data = res.ok ? await res.json().catch(() => null) : null
				if (!cancelled) setCapability({ sendEnabled: data?.sendEnabled === true })
			} catch {
				if (!cancelled) setCapability({ sendEnabled: false })
			}
		}
		void loadCapability()
		return () => { cancelled = true }
	}, [minor, user])

	const selectedRecipients = recipients.filter(r => selectedRecipientIds.includes(r.id))
	const selectedClip = clips.find(c => c.id === selectedClipId)

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

	function onSaveDraft() {
		if (!subject.trim() || !body.trim()) {
			show('Add a subject and body to save a draft')
			return
		}
		const saved = upsertOutreachDraft({
			id: draftId,
			athleteId: draftOwnerId,
			subject,
			body,
			clipId: selectedClipId || undefined,
			recipientIds: selectedRecipientIds
		})
		setDraftId(saved.id)
		setDrafts(getOutreachDrafts(draftOwnerId))
		show('Draft saved')
	}

	function onLoadDraft(d: OutreachDraft) {
		setDraftId(d.id)
		setSubject(d.subject)
		setBody(d.body)
		setSelectedClipId(d.clipId || '')
		setSelectedRecipientIds(d.recipientIds || [])
	}

	function onDeleteDraft(id: string) {
		deleteOutreachDraft(id)
		setDrafts(getOutreachDrafts(draftOwnerId))
		if (draftId === id) setDraftId(undefined)
	}

	async function copyText(text: string, label: string) {
		try {
			await navigator.clipboard.writeText(text)
			show(`${label} copied`)
		} catch {
			show('Copy failed — select the text and copy it manually')
		}
	}

	function draftTextFor(recipient: Recipient | null): string {
		const clipLine = selectedClip?.videoUrl ? `\n\nHighlight: ${selectedClip.videoUrl}` : ''
		const personalized = recipient ? personalizeDraftBody(body, recipient.name) : body
		const header = recipient ? `To: ${recipient.email}\n` : ''
		return `${header}Subject: ${subject}\n\n${personalized}${clipLine}`
	}

	async function onSendOne(recipient: Recipient) {
		if (minor || !capability.sendEnabled) return
		if (!user) {
			show('Please log in to send emails')
			return
		}
		if (!selectedClip?.videoUrl) {
			show('Select a clip with a video URL')
			return
		}
		if (!subject || !body) {
			show('Subject and body are required')
			return
		}
		const confirmed = window.confirm(
			`Send this email to ${recipient.name} <${recipient.email}> now?\n\nThis sends one real email. Review it first.`
		)
		if (!confirmed) return
		setSendingTo(recipient.id)
		try {
			const token = await accessToken()
			const res = await fetch('/api/recruiting/send', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(token ? { Authorization: `Bearer ${token}` } : {})
				},
				body: JSON.stringify({
					athlete: { fullName: user.fullName },
					clipUrl: selectedClip.videoUrl,
					coach: { name: recipient.name || recipient.orgName, email: recipient.email },
					confirmRecipientEmail: recipient.email,
					subject,
					body: personalizeDraftBody(body, recipient.name)
				})
			})
			const data = await res.json().catch(() => ({}))
			if (!res.ok) {
				show(data?.error || 'Email was not sent')
				return
			}
			if (athlete?.id) {
				createOutreach({ athleteId: athlete.id, coachId: recipient.id, clipId: selectedClipId, subject, body })
				setOutreach(getOutreach(athlete.id))
			}
			show(`Sent to ${recipient.email}${data?.audit?.auditId ? ` (record ${String(data.audit.auditId).slice(0, 8)})` : ''}`)
		} catch {
			show('Email service unavailable. Your draft is still saved here.')
		} finally {
			setSendingTo(null)
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
		<div className="space-y-5" data-testid="outreach-drafts">
			<div>
				<h2 className="headline text-2xl">Outreach Drafts</h2>
				<p className="text-sm text-gray-400 mt-1" data-testid="outreach-drafts-mode">
					Write, review, and copy coach emails. NIL Roster does not send these for you — copy a reviewed draft into
					your own email when you are ready.
				</p>
				{minor && (
					<div
						className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
						data-testid="outreach-minor-notice"
					>
						Because you are under 18, review every draft with a parent or guardian before you send it from your own email.
					</div>
				)}
			</div>

			<div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
				<Card title="Recipients (from My Targets)">
					<div className="space-y-3">
						{recipients.length === 0 ? (
							<div className="subtle text-sm">No contacts found in My Targets.</div>
						) : (
							<ul className="space-y-2" data-testid="outreach-recipients">
								{recipients.map(r => (
									<li key={r.id} className="bg-surface border border-border rounded-md p-3">
										<label className="flex items-center gap-2">
											<input
												type="checkbox"
												checked={selectedRecipientIds.includes(r.id)}
												onChange={(e) => {
													if (e.target.checked) setSelectedRecipientIds(prev => [...prev, r.id])
													else setSelectedRecipientIds(prev => prev.filter(id => id !== r.id))
												}}
											/>
											<div className="min-w-0">
												<div className="text-white font-semibold">{r.name || 'Coach'}</div>
												<div className="text-xs text-gray-400 break-all">{[r.email, r.orgName].filter(Boolean).join(' • ')}</div>
											</div>
										</label>
									</li>
								))}
							</ul>
						)}
						<p className="text-xs text-gray-500">Choose who to review a personalized draft for.</p>
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
											<label className="flex items-center gap-2 min-w-0">
												<input type="radio" name="clip" checked={selectedClipId === c.id} onChange={() => setSelectedClipId(c.id)} />
												<div className="min-w-0">
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

				<Card title="Compose draft">
					<div className="space-y-3">
						<div className="flex flex-col sm:flex-row sm:items-center gap-2">
							<Input placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} data-testid="outreach-subject" />
							<Button variant="ghost" className="whitespace-nowrap" onClick={() => setBody(generateTemplate())}>Insert Template</Button>
						</div>
						<Textarea className="min-h-[200px]" placeholder="Body" value={body} onChange={e => setBody(e.target.value)} data-testid="outreach-body" />
						<div className="flex flex-wrap justify-end gap-2">
							<Button variant="ghost" onClick={() => copyText(draftTextFor(null), 'Draft')} data-testid="outreach-copy-draft">Copy draft</Button>
							<Button onClick={onSaveDraft} data-testid="outreach-save-draft">Save draft</Button>
						</div>
						<div>
							<div className="text-white font-semibold mb-2">Saved drafts</div>
							{drafts.length === 0 ? (
								<div className="subtle text-sm">No saved drafts yet.</div>
							) : (
								<ul className="space-y-2" data-testid="outreach-saved-drafts">
									{drafts.map(d => (
										<li key={d.id} className="bg-surface border border-border rounded-md p-3 flex items-center justify-between gap-2">
											<div className="min-w-0">
												<div className="text-white font-semibold truncate">{d.subject}</div>
												<div className="text-xs text-gray-500">{new Date(d.updatedAt).toLocaleString()}</div>
											</div>
											<div className="flex gap-1">
												<Button variant="ghost" onClick={() => onLoadDraft(d)}>Open</Button>
												<Button variant="ghost" onClick={() => onDeleteDraft(d.id)}>Delete</Button>
											</div>
										</li>
									))}
								</ul>
							)}
						</div>
					</div>
				</Card>
			</div>

			<Card title="Review before you send">
				<div className="space-y-3" data-testid="outreach-review">
					{selectedRecipients.length === 0 ? (
						<div className="subtle text-sm">Select recipients above to review a personalized draft for each coach.</div>
					) : (
						<ul className="space-y-3">
							{selectedRecipients.map(r => (
								<li key={r.id} className="bg-surface border border-border rounded-md p-3 space-y-2" data-testid={`outreach-review-${r.id}`}>
									<div className="text-sm text-gray-300 break-all">To: {r.name} &lt;{r.email}&gt;</div>
									<pre className="whitespace-pre-wrap text-sm text-gray-100 bg-mid border border-border rounded-md p-3">{draftTextFor(r)}</pre>
									<div className="flex flex-wrap justify-end gap-2">
										<Button variant="ghost" onClick={() => copyText(r.email, 'Email address')}>Copy address</Button>
										<Button variant="ghost" onClick={() => copyText(draftTextFor(r), 'Draft')}>Copy for this coach</Button>
										{!minor && capability.sendEnabled && (
											<Button
												onClick={() => onSendOne(r)}
												disabled={sendingTo !== null}
												data-testid={`outreach-send-one-${r.id}`}
											>
												{sendingTo === r.id ? 'Sending…' : 'Send to this coach'}
											</Button>
										)}
									</div>
								</li>
							))}
						</ul>
					)}
				</div>
			</Card>

			{outreach.length > 0 && (
				<Card title="Recent Outreach">
					<ul className="space-y-2">
						{outreach.slice(0, 10).map(o => {
							const coach = recipients.find(c => c.id === o.coachId)
							const clip = clips.find(c => c.id === o.clipId)
							return (
								<li key={o.id} className="bg-surface border border-border rounded-md p-3">
									<div className="flex flex-wrap items-center justify-between gap-3">
										<div className="min-w-0">
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
				</Card>
			)}
		</div>
	)
}
