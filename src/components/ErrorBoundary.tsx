import { Component, ReactNode } from 'react'
import Card from './ui/Card'

type ErrorBoundaryState = {
	hasError: boolean
	errorMessage: string | null
	errorStack: string | null
}

type ErrorBoundaryProps = {
	children: ReactNode
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: ErrorBoundaryProps) {
		super(props)
		this.state = {
			hasError: false,
			errorMessage: null,
			errorStack: null
		}
	}

	static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
		return {
			hasError: true,
			errorMessage: error instanceof Error ? error.message : String(error ?? 'Unknown error')
		}
	}

	override componentDidCatch(error: unknown, errorInfo: any) {
		// eslint-disable-next-line no-console
		console.error('ErrorBoundary:', error, errorInfo)
		this.setState({
			errorStack:
				error instanceof Error
					? error.stack || String(errorInfo?.componentStack || '')
					: String(errorInfo?.componentStack || '')
		})
	}

	override render() {
		if (this.state.hasError) {
			return (
				<Card title="Something went wrong">
					<div className="space-y-3">
						<p className="text-gray-200">
							We hit a problem rendering this section. Please take a screenshot or copy the details
							below and share them with the developer so we can fix it quickly.
						</p>
						{this.state.errorMessage && (
							<>
								<div className="text-sm text-foreground/60">Error message</div>
								<pre className="bg-mid border border-border rounded-md p-3 text-xs overflow-auto whitespace-pre-wrap">
									{this.state.errorMessage}
								</pre>
							</>
						)}
						{this.state.errorStack && (
							<>
								<div className="text-sm text-foreground/60">Stack trace</div>
								<pre className="bg-mid border border-border rounded-md p-3 text-xs overflow-auto whitespace-pre-wrap">
									{this.state.errorStack}
								</pre>
							</>
						)}
					</div>
				</Card>
			)
		}
		return this.props.children
	}
}


