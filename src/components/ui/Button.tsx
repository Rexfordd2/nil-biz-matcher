import { ButtonHTMLAttributes } from 'react'
import { clsx } from 'clsx'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: 'primary' | 'secondary' | 'ghost'
}

export default function Button({ className, variant = 'primary', type, ...props }: Props) {
	return (
		<button
			{...props}
			type={type ?? 'button'}
			className={clsx(
				'btn',
				variant === 'primary' ? 'btn-primary' : variant === 'secondary' ? 'btn-secondary' : 'btn-ghost',
				'focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
				className
			)}
		/>
	)
}


