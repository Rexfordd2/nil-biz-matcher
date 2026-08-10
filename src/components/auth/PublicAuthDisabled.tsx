import Button from '../ui/Button'
import Card from '../ui/Card'
import { navigate } from '../../routes/RootRouter'

type Props = {
	kind: 'login' | 'signup' | 'reset'
}

const copy = {
	login: {
		title: 'Login unavailable',
		message: 'Existing-member login is not enabled for this release.',
		detail: 'NIL Roster is currently in private beta. If you already have an account, check back soon or contact Athlete Houze for access.',
	},
	signup: {
		title: 'Private beta',
		message: 'NIL Roster is currently in private beta. New accounts are opened by invitation.',
		detail: 'Existing beta members can sign in from the login page when access is enabled.',
	},
	reset: {
		title: 'Password reset unavailable',
		message: 'Password reset is not available in this release.',
		detail: 'If you need help accessing your beta account, contact Athlete Houze support.',
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
