type Props = {
	className?: string
}

export default function DisclaimerBanner({ className }: Props) {
	return (
		<div className={`bg-amber-900/30 border border-amber-700 rounded-md p-3 text-amber-200 text-sm ${className || ''}`}>
			Athlete Ledger provides general educational information and is not legal, financial, or tax advice. Do your own due diligence. Listings are not endorsements.
		</div>
	)
}


