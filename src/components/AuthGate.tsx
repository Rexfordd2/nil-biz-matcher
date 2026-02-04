import { navigate } from '../routes/RootRouter'
import Button from './ui/Button'
import { isDemoMode } from '../config/appMode'
import { goToLogin } from '../lib/auth/navigation'

type Props = {
	returnTo?: string
	mode?: 'home' | 'demo'
}

export default function AuthGate({ returnTo = '/app', mode }: Props) {
	const effectiveMode = mode || (isDemoMode() ? 'demo' : 'home')
	
	return (
		<div className="min-h-screen bg-background flex items-center justify-center px-4">
			<div className="max-w-md w-full">
				<div className="card p-6 space-y-6">
					<div className="text-center space-y-2">
						<h2 className="headline text-2xl">Welcome to Athlete Ledger</h2>
						<p className="text-gray-300 text-sm">
							Sign in to access your full account, or continue exploring.
						</p>
					</div>

					<div className="space-y-3">
						<Button
							data-testid="auth-gate-login"
							onClick={() => goToLogin(returnTo)}
							className="w-full red-glow"
						>
							Log In
						</Button>

						<Button
							data-testid="auth-gate-signup"
							onClick={() => navigate(`/auth/signup?returnTo=${encodeURIComponent(returnTo)}`)}
							variant="secondary"
							className="w-full"
						>
							Sign Up
						</Button>

						<Button
							data-testid="auth-gate-waitlist"
							onClick={() => navigate('/waitlist')}
							variant="secondary"
							className="w-full"
						>
							Join Waitlist
						</Button>

						<Button
							data-testid="auth-gate-back-home"
							onClick={() => navigate(effectiveMode === 'demo' ? '/demo' : '/')}
							variant="ghost"
							className="w-full"
						>
							{effectiveMode === 'demo' ? 'Back to Demo' : 'Back Home'}
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}
