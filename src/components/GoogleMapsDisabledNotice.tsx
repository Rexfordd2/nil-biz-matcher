/**
 * Shared UI component for displaying Google Maps API key configuration notice
 * Single source of truth for "Search Disabled" messaging
 */

import { useMemo } from 'react'
import { getGoogleMapsSetupInstructions } from '../config/env'

type GoogleMapsDisabledNoticeProps = {
	/** Optional custom className for the container */
	className?: string
}

/**
 * Displays a warning notice when Google Maps API key is not configured
 * Shows detailed setup instructions in dev mode, generic message in production
 */
export default function GoogleMapsDisabledNotice({ className }: GoogleMapsDisabledNoticeProps) {
	const setupInstructions = useMemo(() => getGoogleMapsSetupInstructions(), [])
	const isDev = import.meta.env.DEV

	return (
		<div className={`p-3 rounded-md border border-amber-500 bg-amber-900/20 text-amber-200 text-sm ${className || ''}`}>
			<div className="font-semibold mb-2">
				⚠️ Search disabled until Google Maps key is configured
			</div>
			{isDev ? (
				<div className="space-y-1">
					<div className="font-medium">Setup steps:</div>
					{setupInstructions.local.map((step, i) => (
						<div key={i} className="text-xs">{step}</div>
					))}
					<div className="mt-2 text-xs">
						<a 
							href="https://console.cloud.google.com" 
							target="_blank" 
							rel="noopener noreferrer"
							className="underline hover:text-amber-100"
						>
							Get API key at Google Cloud Console →
						</a>
					</div>
				</div>
			) : (
				<div className="text-xs">
					Google Maps is not configured. Contact your administrator.
				</div>
			)}
		</div>
	)
}
