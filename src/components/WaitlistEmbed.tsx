import { useState } from 'react'
import Button from './ui/Button'
import { navigate } from '../routes/RootRouter'
import { PUBLIC_MODE } from '../config/publicMode'

type Props = {
	source?: string
}

export default function WaitlistEmbed({ source = 'landing' }: Props) {
	const [showSuccess, setShowSuccess] = useState(false)
	
	// Mailchimp embed HTML (preferred)
	const embedHtml = import.meta.env.VITE_WAITLIST_EMBED_HTML
	
	// Fallback: iframe/link to external form (Google Form, etc.)
	const embedUrl = import.meta.env.VITE_WAITLIST_EMBED_URL
	const embedTitle = import.meta.env.VITE_WAITLIST_EMBED_TITLE || 'Waitlist signup form'

	// If HTML embed is provided, use it (Mailchimp, ConvertKit, etc.)
	if (embedHtml) {
		return (
			<div className="space-y-4">
				<div
					dangerouslySetInnerHTML={{ __html: embedHtml }}
					data-testid="waitlist-embed-html"
				/>
				<p className="text-xs text-gray-500 text-center">
					By joining, you agree to receive early access updates.
				</p>
			</div>
		)
	}

	// If URL embed is provided, show iframe or link
	if (embedUrl) {
		const isExternalForm = embedUrl.includes('google.com/forms') || 
		                       embedUrl.includes('forms.gle') ||
		                       embedUrl.includes('typeform.com') ||
		                       embedUrl.includes('airtable.com')

		if (isExternalForm) {
			// For external forms, open in new tab instead of iframe
			return (
				<div className="text-center space-y-4">
					<p className="text-sm text-gray-600">
						Join our waitlist to get early access and save your progress.
					</p>
					<Button
						onClick={() => {
							window.open(embedUrl, '_blank', 'noopener,noreferrer')
							setShowSuccess(true)
						}}
						className="w-full red-glow"
						data-testid="waitlist-embed-button"
					>
						Join Waitlist
					</Button>
					{showSuccess && (
						<p className="text-sm text-green-600">
							✓ Form opened! After submitting, check your email to confirm.
						</p>
					)}
					<p className="text-xs text-gray-500">
						By joining, you agree to receive early access updates.
					</p>
				</div>
			)
		}

		// For embeddable forms, use iframe
		return (
			<div className="space-y-4">
				<iframe
					src={embedUrl}
					title={embedTitle}
					className="w-full h-[400px] border border-border rounded-lg"
					frameBorder={0}
					data-testid="waitlist-embed-iframe"
				/>
				<p className="text-xs text-gray-500 text-center">
					By joining, you agree to receive early access updates.
				</p>
			</div>
		)
	}

	return (
		<div className="text-center space-y-4 p-6 border border-border rounded-lg bg-mid/30" data-testid="waitlist-unavailable">
			<p className="text-gray-700 text-sm">
				Early-access signups are not being collected here right now.
			</p>
			{!PUBLIC_MODE && (
				<>
					<p className="text-gray-600 text-sm">You can create a free account to open NIL Roster instead.</p>
					<Button
						onClick={() => navigate('/auth/signup')}
						className="w-full red-glow"
						data-testid="waitlist-unavailable-signup"
					>
						Create a free account
					</Button>
				</>
			)}
		</div>
	)
}

export function isWaitlistEmbedConfigured(): boolean {
	return Boolean(import.meta.env.VITE_WAITLIST_EMBED_HTML || import.meta.env.VITE_WAITLIST_EMBED_URL)
}
