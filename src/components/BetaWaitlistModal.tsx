import { useState, FormEvent } from 'react'
import Button from './ui/Button'
import Input from './ui/Input'
import { submitWaitlistEmail } from '../lib/waitlist'
import { markWaitlistJoined } from '../lib/waitlistState'
import { navigate } from '../routes/RootRouter'
import { goToLogin } from '../lib/auth/navigation'

type Props = {
	open: boolean
	onClose: () => void
}

export default function BetaWaitlistModal({ open, onClose }: Props) {
	const [email, setEmail] = useState('')
	const [submitting, setSubmitting] = useState(false)
	const [success, setSuccess] = useState(false)
	const [error, setError] = useState<string | null>(null)

	if (!open) {
		return null
	}

	async function handleSubmit(e: FormEvent) {
		e.preventDefault()
		
		if (!email.trim()) {
			setError('Email is required')
			return
		}

		setSubmitting(true)
		setError(null)

		try {
			const result = await submitWaitlistEmail(email, { source: 'beta' })

			if (result.ok) {
				setSuccess(true)
				markWaitlistJoined() // Persist joined state
			} else {
				setError(result.error)
			}
		} catch (err: any) {
			setError(err?.message || 'Something went wrong.')
		} finally {
			setSubmitting(false)
		}
	}

	function handleClose() {
		// Reset state when closing
		setEmail('')
		setSuccess(false)
		setError(null)
		onClose()
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === 'Escape') {
			handleClose()
		}
	}

	return (
		<div 
			className="fixed inset-0 z-50 flex items-center justify-center"
			role="dialog"
			aria-modal="true"
			aria-labelledby="waitlist-modal-title"
			onKeyDown={handleKeyDown}
		>
			{/* Backdrop */}
			<div 
				className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
				onClick={handleClose}
			/>
			
			{/* Modal Card */}
			<div className="relative bg-background border border-border rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
				<div className="flex items-center justify-between mb-4">
					<h2 id="waitlist-modal-title" className="headline text-2xl">Join the waitlist</h2>
					<button
						type="button"
						onClick={handleClose}
						className="text-gray-400 hover:text-gray-200 transition-colors"
						aria-label="Close modal"
					>
						<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				{success ? (
					<div className="text-center space-y-4 py-4">
						<p className="text-green-300 font-medium text-lg">✓ You're on the list</p>
						<p className="text-sm text-gray-300">We'll notify you with updates.</p>
						<div className="flex flex-col gap-2">
							<Button
								onClick={() => {
									handleClose()
									goToLogin('/app')
								}}
								className="w-full red-glow"
								data-testid="beta-waitlist-success-login"
							>
								Log In
							</Button>
							<Button
								onClick={() => {
									handleClose()
									navigate('/')
								}}
								variant="secondary"
								className="w-full"
								data-testid="beta-waitlist-success-back"
							>
								Back Home
							</Button>
						</div>
					</div>
				) : (
					<>
						<p className="text-gray-300 text-sm mb-6">
							Get early access and updates when new features launch.
						</p>

						<form onSubmit={handleSubmit} className="space-y-4">
							<div>
								<label htmlFor="beta-waitlist-email" className="sr-only">
									Email address
								</label>
								<Input
									id="beta-waitlist-email"
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="your@email.com"
									required
									disabled={submitting}
									data-testid="beta-waitlist-email-input"
									aria-describedby={error ? "beta-waitlist-error" : undefined}
								/>
							</div>

							{error && (
								<div 
									id="beta-waitlist-error"
									className="text-sm text-red-400" 
									data-testid="beta-waitlist-error"
									role="alert"
								>
									{error}
								</div>
							)}

							<Button
								type="submit"
								disabled={submitting || !email.trim()}
								className="w-full red-glow"
								data-testid="beta-waitlist-submit-button"
							>
								{submitting ? 'Joining...' : 'Join Waitlist'}
							</Button>

							<p className="text-xs text-gray-500 text-center">
								By joining, you agree to receive early access updates.
							</p>
						</form>
					</>
				)}
			</div>
		</div>
	)
}
