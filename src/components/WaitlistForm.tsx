import { useState, FormEvent } from 'react'
import Button from './ui/Button'
import Input from './ui/Input'
import { submitWaitlistEmail } from '../lib/waitlist'
import Observability from '../lib/obs'
import { MIN_FORM_INTERACTION_TIME } from '../config/honeypot'
import { markWaitlistJoined } from '../lib/waitlistState'
import { navigate } from '../routes/RootRouter'
import { isDemoMode } from '../config/appMode'

type Props = {
	onSuccess?: () => void
	source?: string
}

export default function WaitlistForm({ onSuccess, source = 'landing' }: Props) {
	const [email, setEmail] = useState('')
	const [website, setWebsite] = useState('') // Honeypot field
	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState(false)
	const [startTime] = useState(() => Date.now())

	async function handleSubmit(e: FormEvent) {
		e.preventDefault()
		
		// Honeypot check: if website field is filled, it's likely a bot
		if (website.trim() !== '') {
			Observability.log({
				feature: 'ui',
				route: 'landing.waitlist.honeypot',
				status: 'error',
				meta: { source, reason: 'honeypot_filled' }
			})
			// Silent rejection - show success to bot but don't submit
			setSuccess(true)
			return
		}

		// Timing check: if submitted too quickly, might be a bot
		const elapsed = Date.now() - startTime
		if (elapsed < MIN_FORM_INTERACTION_TIME) {
			Observability.log({
				feature: 'ui',
				route: 'landing.waitlist.timing_suspicious',
				status: 'ui_action',
				meta: { elapsed, threshold: MIN_FORM_INTERACTION_TIME, source }
			})
			// Continue but log suspicious timing
		}

		setSubmitting(true)
		setError(null)

		try {
			// Extract UTM params from URL
			const params = new URLSearchParams(window.location.search)
			const meta = {
				source,
				utm_source: params.get('utm_source') || undefined,
				utm_medium: params.get('utm_medium') || undefined,
				utm_campaign: params.get('utm_campaign') || undefined,
				utm_term: params.get('utm_term') || undefined,
				utm_content: params.get('utm_content') || undefined
			}

			const result = await submitWaitlistEmail(email, meta)

			if (result.ok) {
				setSuccess(true)
				markWaitlistJoined() // Persist joined state
				Observability.log({
					feature: 'ui',
					route: 'landing.waitlist.submit',
					status: 'ok',
					meta: { source }
				})
				onSuccess?.()
			} else {
				setError(result.error)
				Observability.log({
					feature: 'ui',
					route: 'landing.waitlist.submit',
					status: 'error',
					meta: { error: result.error, source }
				})
			}
		} catch (err: any) {
			setError(err?.message || 'Failed to join waitlist')
			Observability.log({
				feature: 'ui',
				route: 'landing.waitlist.submit',
				status: 'error',
				meta: { error: err?.message, source }
			})
		} finally {
			setSubmitting(false)
		}
	}

	if (success) {
		const isDemo = isDemoMode()
		return (
			<div className="text-center space-y-4">
				<p className="text-green-600 font-medium text-lg">✓ You're on the list</p>
				<p className="text-sm text-gray-600">We'll notify you when Athlete Ledger launches.</p>
				<div className="flex flex-col gap-2">
					<Button
						onClick={() => navigate('/auth/login?returnTo=/app')}
						className="w-full red-glow"
						data-testid="waitlist-success-login"
					>
						Log In
					</Button>
					<Button
						onClick={() => navigate(isDemo ? '/demo' : '/')}
						variant="secondary"
						className="w-full"
						data-testid="waitlist-success-back"
					>
						{isDemo ? 'Back to Demo' : 'Back Home'}
					</Button>
				</div>
			</div>
		)
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div>
				<Input
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					placeholder="your@email.com"
					required
					disabled={submitting}
					data-testid="waitlist-email-input"
				/>
			</div>

		{/* Honeypot field - hidden from users, visible to bots */}
		<input
			type="text"
			name="website"
			value={website}
			onChange={(e) => setWebsite(e.target.value)}
			tabIndex={-1}
			aria-hidden="true"
			autoComplete="off"
			style={{
				position: 'absolute',
				left: '-9999px',
				height: '0',
				width: '0',
				overflow: 'hidden'
			}}
			data-testid="waitlist-honeypot"
		/>

			{error && (
				<div className="text-sm text-red-600" data-testid="waitlist-error">
					{error}
				</div>
			)}

			<Button
				type="submit"
				disabled={submitting || !email}
				className="w-full red-glow"
				data-testid="waitlist-submit-button"
			>
				{submitting ? 'Joining...' : 'Join Waitlist'}
			</Button>

			<p className="text-xs text-gray-500 text-center">
				By joining, you agree to receive early access updates.
			</p>
		</form>
	)
}
