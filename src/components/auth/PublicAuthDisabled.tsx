import Button from '../ui/Button'
import Card from '../ui/Card'
import { navigate } from '../../routes/RootRouter'

type Props = {
	kind: 'login' | 'signup' | 'reset'
}

const copy = {
	login: {
		title: 'Login unavailable',
		message: 'Login is not enabled on this public demo surface.',
		detail: 'Use the full NIL Roster app to sign in to your account, or explore the demo.',
	},
	signup: {
		title: 'Create account on NIL Roster',
		message: 'Account creation is not available on this public demo surface.',
		detail: 'Open NIL Roster to create an Athlete, Parent/Guardian, or Coach account, or explore the demo below.',
	},
	reset: {
		title: 'Password reset unavailable',
		message: 'Password reset is not available on this public demo surface.',
		detail: 'Use the full NIL Roster login page when you need to recover your password.',
	},
} as const

export default function PublicAuthDisabled({ kind }: Props) {
	const content = copy[kind]

	return (
		<div className="mx-auto max-w-md px-4 md:px-6 py-10" data-testid="auth-disabled">
			<Card title={content.title}>
				<div className="space-y-4">
					<p className="text-sm text-gray-300" data-testid="auth-disabled-message">
						{content.message}
					</p>
					<p className="text-xs text-gray-400">{content.detail}</p>
					<div className="flex flex-col gap-2">
						{kind === 'signup' && (
							<Button
								data-testid="auth-disabled-go-login"
								onClick={() => navigate('/auth/login')}
								className="red-glow w-full"
							>
								Go to Login
							</Button>
						)}
						<a
							href="https://athletehouze.com"
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center justify-center rounded-md border border-border bg-transparent px-4 py-2 text-sm text-gray-200 hover:text-white"
							data-testid="auth-disabled-athlete-houze"
						>
							Athlete Houze
						</a>
						<Button
							data-testid="auth-disabled-go-demo"
							onClick={() => navigate('/demo')}
							variant="secondary"
							className="w-full"
						>
							NIL Roster demo
						</Button>
						<Button
							data-testid="auth-disabled-go-home"
							onClick={() => navigate('/')}
							variant="ghost"
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
