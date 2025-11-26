import { PropsWithChildren } from 'react'
import { clsx } from 'clsx'

type Props = PropsWithChildren<{
	title?: string
	actions?: React.ReactNode
	className?: string
}>

export default function Card({ title, actions, className, children }: Props) {
	return (
		<section className={clsx('card p-5', className)}>
			{(title || actions) && (
				<header className="mb-4 flex items-center justify-between">
					{title && <h3 className="headline text-xl">{title}</h3>}
					{actions}
				</header>
			)}
			{children}
		</section>
	)
}


