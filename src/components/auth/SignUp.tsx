import { useState } from 'react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import { authRegister, type CurrentUser } from '../../utils/auth'
import { useToast } from '../ui/Toast'

type Props = {
	onSignedIn: (user: CurrentUser) => void
}

export default function SignUp({ onSignedIn }: Props) {
	const { show } = useToast()
	const [fullName, setFullName] = useState('')
	const [email, setEmail] = useState('')
	const [phone, setPhone] = useState('')
	const [marketingConsent, setMarketingConsent] = useState(false)
	const [loading, setLoading] = useState(false)

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		if (!email || !fullName) {
			show('Please enter your name and email')
			return
		}
		setLoading(true)
		try {
			const user = await authRegister({ email, fullName, phone: phone || undefined, marketingConsent })
			onSignedIn(user)
		} catch (err: any) {
			show(err?.message || 'Sign up failed')
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="max-w-lg mx-auto">
			<Card title="Create your Athlete Ledger account">
				<form className="space-y-4" onSubmit={handleSubmit}>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Full name</span>
						<input
							type="text"
							value={fullName}
							onChange={e => setFullName(e.target.value)}
							placeholder="Your full name"
							className="bg-mid border border-border rounded-md px-3 py-2 text-white"
						/>
					</label>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Email</span>
						<input
							type="email"
							value={email}
							onChange={e => setEmail(e.target.value)}
							placeholder="you@example.com"
							className="bg-mid border border-border rounded-md px-3 py-2 text-white"
						/>
					</label>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Phone (optional)</span>
						<input
							type="tel"
							value={phone}
							onChange={e => setPhone(e.target.value)}
							placeholder="(555) 123-4567"
							className="bg-mid border border-border rounded-md px-3 py-2 text-white"
						/>
					</label>
					<label className="inline-flex items-center gap-2 text-sm text-gray-300">
						<input type="checkbox" checked={marketingConsent} onChange={e => setMarketingConsent(e.target.checked)} />
						<span>I consent to receive educational messages and offers related to Athlete Ledger and NIL opportunities.</span>
					</label>
					<div className="pt-2">
						<Button type="submit" className="red-glow" disabled={loading}>{loading ? 'Creating…' : 'Create my Athlete Ledger account'}</Button>
					</div>
				</form>
			</Card>
		</div>
	)
}


