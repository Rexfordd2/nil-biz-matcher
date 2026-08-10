import { useState } from 'react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import { updatePassword } from '../../lib/authSupabase'
import { validateNewPassword } from '../../lib/auth/passwordReset'
import { friendlyAuthErrorMessage } from '../../lib/supabaseErrors'

export default function ChangePasswordForm() {
	const [password, setPassword] = useState('')
	const [confirm, setConfirm] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [loading, setLoading] = useState(false)
	const [err, setErr] = useState<string | null>(null)
	const [success, setSuccess] = useState(false)

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		if (loading) return
		setErr(null)
		setSuccess(false)
		const validationError = validateNewPassword(password, confirm)
		if (validationError) {
			setErr(validationError)
			return
		}
		setLoading(true)
		try {
			const { error } = await updatePassword(password)
			if (error) {
				setErr(friendlyAuthErrorMessage(error, { context: 'reset' }))
				return
			}
			setPassword('')
			setConfirm('')
			setSuccess(true)
		} catch (e: any) {
			setErr(friendlyAuthErrorMessage(e, { context: 'reset' }))
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="space-y-3" data-testid="change-password-section">
			<div className="text-sm text-gray-400 mb-1">Security</div>
			<h3 className="text-white font-semibold">Change password</h3>
			<p className="text-sm text-gray-400">
				Set a new password for this account. You will stay signed in after a successful update.
			</p>
			<form className="space-y-3 max-w-md" data-testid="change-password-form" onSubmit={handleSubmit}>
				<label className="flex flex-col gap-2">
					<span className="subtle text-sm">New password</span>
					<div className="flex gap-2">
						<Input
							data-testid="change-password-new"
							type={showPassword ? 'text' : 'password'}
							autoComplete="new-password"
							value={password}
							onChange={e => setPassword(e.target.value)}
							placeholder="At least 8 characters"
							disabled={loading}
						/>
						<button
							type="button"
							className="text-xs text-gray-300 hover:text-white px-2"
							onClick={() => setShowPassword(v => !v)}
							disabled={loading}
						>
							{showPassword ? 'Hide' : 'Show'}
						</button>
					</div>
				</label>
				<label className="flex flex-col gap-2">
					<span className="subtle text-sm">Confirm new password</span>
					<Input
						data-testid="change-password-confirm"
						type={showPassword ? 'text' : 'password'}
						autoComplete="new-password"
						value={confirm}
						onChange={e => setConfirm(e.target.value)}
						placeholder="••••••••"
						disabled={loading}
					/>
				</label>
				{err && (
					<div className="text-red-400 text-sm" data-testid="change-password-error" aria-live="polite">
						{err}
					</div>
				)}
				{success && (
					<div className="text-green-300 text-sm" data-testid="change-password-success" aria-live="polite">
						Password updated successfully.
					</div>
				)}
				<Button type="submit" className="red-glow" data-testid="change-password-submit" disabled={loading}>
					{loading ? <span data-testid="change-password-loading">Updating…</span> : 'Update password'}
				</Button>
			</form>
		</div>
	)
}
