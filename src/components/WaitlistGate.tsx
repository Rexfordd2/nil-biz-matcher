import { useState, useEffect } from 'react'
import { navigate } from '../routes/RootRouter'
import Button from './ui/Button'

const STORAGE_KEY_JOINED = 'al_waitlist_joined'
const STORAGE_KEY_SKIPPED = 'al_waitlist_skipped'

export default function WaitlistGate() {
	const [isOpen, setIsOpen] = useState(false)

	useEffect(() => {
		// Check if user has already joined or skipped
		const hasJoined = localStorage.getItem(STORAGE_KEY_JOINED) === 'true'
		const hasSkipped = localStorage.getItem(STORAGE_KEY_SKIPPED) === 'true'
		
		if (!hasJoined && !hasSkipped) {
			setIsOpen(true)
		}
	}, [])

	const handleJoinWaitlist = () => {
		navigate('/')
		// Small delay to ensure page loads before scrolling
		setTimeout(() => {
			document.getElementById('waitlist-form')?.scrollIntoView({ behavior: 'smooth' })
		}, 100)
		setIsOpen(false)
	}

	const handleAlreadyJoined = () => {
		localStorage.setItem(STORAGE_KEY_JOINED, 'true')
		setIsOpen(false)
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

				<div className="flex flex-col gap-3">
					<Button
						data-testid="join-waitlist-button"
						onClick={handleJoinWaitlist}
						className="w-full red-glow"
					>
						Join the waitlist
					</Button>

					<button
						data-testid="already-joined-button"
						type="button"
						onClick={handleAlreadyJoined}
						className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
					>
						I already joined
					</button>

					<button
						data-testid="skip-waitlist-button"
						type="button"
						onClick={handleSkip}
						className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
					>
						Continue without joining
					</button>
				</div>
			</div>
		</div>
	)
}
