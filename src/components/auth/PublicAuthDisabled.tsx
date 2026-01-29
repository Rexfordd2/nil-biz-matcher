import Button from '../ui/Button'
import Card from '../ui/Card'
import { navigate } from '../../routes/RootRouter'

type Props = {
	kind: 'login' | 'signup' | 'reset'
}

export default function PublicAuthDisabled({ kind }: Props) {
	const titles = {
		login: 'Login disabled',
		signup: 'Sign up disabled',
		reset: 'Password reset disabled'
	}

	return (
		<div className="mx-auto max-w-md px-4 md:px-6 py-10" data-testid="auth-disabled">
			<Card title={titles[kind]}>
				<div className="space-y-4">
					<p className="text-sm text-gray-300" data-testid="auth-disabled-message">
						Login disabled in public release
					</p>
					<p className="text-xs text-gray-400">
						This is a public demo. Authentication features are not available.
					</p>
					<div className="flex flex-col gap-2">
						<Button
							data-testid="auth-disabled-go-app"
							onClick={() => navigate('/app')}
							className="red-glow w-full"
						>
							Go to App
						</Button>
						<Button
							data-testid="auth-disabled-go-home"
							onClick={() => navigate('/')}
							variant="secondary"
							className="w-full"
						>
							Back to Home
						</Button>
					</div>
				</div>
			</Card>
		</div>
	)
}
