import { useState } from 'react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import { type CurrentUser } from '../../utils/auth'
import { useToast } from '../ui/Toast'
import { useAuth } from '../../context/AuthContext'

type Props = {
	onLoggedIn: (user: CurrentUser) => void
	onNeedAccount?: () => void
}

export default function Login({ onLoggedIn, onNeedAccount }: Props) {
	const { show } = useToast()
	const { login } = useAuth()
	const [email, setEmail] = useState('')
	const [loading, setLoading] = useState(false)

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		if (!email) {
			show('Enter your email')
			return
		}
		setLoading(true)
		try {
			const user = await login(email)
			onLoggedIn(user)
		} catch (err: any) {
			show(err?.message || 'Login failed')
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="max-w-md mx-auto">
			<Card title="Log in to Athlete Ledger">
				<form className="space-y-4" onSubmit={handleSubmit}>
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
					<div className="flex items-center justify-between">
						<Button className="red-glow" disabled={loading} onClick={() => {}}>{loading ? 'Logging in…' : 'Log in'}</Button>
						{onNeedAccount && (
							<button type="button" onClick={onNeedAccount} className="text-sm text-gray-300 hover:text-white">Need an account? Sign up</button>
						)}
					</div>
				</form>
			</Card>
		</div>
	)
}


