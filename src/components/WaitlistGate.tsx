import { useState, useEffect } from 'react'
import { submitWaitlistEmail } from '../lib/waitlist'
import Button from './ui/Button'
import Input from './ui/Input'

const STORAGE_KEY_JOINED = 'al_waitlist_joined'
const STORAGE_KEY_SKIPPED = 'al_waitlist_skipped'

export default function WaitlistGate() {
	const [isOpen, setIsOpen] = useState(false)
	const [email, setEmail] = useState('')
	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		// Check if user has already joined or skipped
		const hasJoined = localStorage.getItem(STORAGE_KEY_JOINED) === 'true'
		const hasSkipped = localStorage.getItem(STORAGE_KEY_SKIPPED) === 'true'
		
		if (!hasJoined && !hasSkipped) {
			setIsOpen(true)
		}
	}, [])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)

		const trimmedEmail = email.trim()
		if (!trimmedEmail) {
			setError('Email is required')
			return
		}

		// Basic email validation
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
			setError('Please enter a valid email address')
			return
		}

		setSubmitting(true)

		try {
			const result = await submitWaitlistEmail(trimmedEmail, {
				source: 'waitlist_gate'
			})

			if (!result.ok) {
				setError(result.error || 'Failed to join waitlist')
				setSubmitting(false)
				return
			}

			// Success (including duplicate emails)
			localStorage.setItem(STORAGE_KEY_JOINED, 'true')
			setIsOpen(false)
		} catch (err: any) {
			setError(err.message || 'An unexpected error occurred')
			setSubmitting(false)
		}
	}

	const handleSkip = () => {
		localStorage.setItem(STORAGE_KEY_SKIPPED, 'true')
		setIsOpen(false)
	}

	if (!isOpen) {
		return null
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			{/* Backdrop */}
			<div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
			
			{/* Modal Card */}
			<div className="relative bg-background border border-border rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
				<h2 className="headline text-2xl mb-2">Join the waitlist</h2>
				<p className="text-gray-300 text-sm mb-6">
					Get early access and save your progress across devices when we launch.
				</p>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<Input
							type="email"
							placeholder="your@email.com"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							disabled={submitting}
							autoFocus
						/>
					</div>

					{error && (
						<div className="text-red-400 text-sm">
							{error}
						</div>
					)}

					<div className="flex flex-col gap-3">
						<Button
							type="submit"
							disabled={submitting}
							className="w-full red-glow"
						>
							{submitting ? 'Joining...' : 'Join & Continue'}
						</Button>

						<button
							type="button"
							onClick={handleSkip}
							disabled={submitting}
							className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
						>
							Continue without joining
						</button>
					</div>
				</form>
			</div>
		</div>
	)
}
