import clsx from 'clsx'
import { RECRUITING_SUBNAV } from '../routes/appRoutes'

type Props = {
	currentPath: string
	onNavigate: (path: string) => void
}

export default function RecruitingSubnav({ currentPath, onNavigate }: Props) {
	return (
		<nav className="flex flex-wrap gap-2 mb-4" aria-label="Recruiting section" data-testid="recruiting-subnav">
			{RECRUITING_SUBNAV.map(item => {
				const active = currentPath === item.path
				return (
					<button
						key={item.path}
						type="button"
						data-testid={`recruiting-subnav-${item.testId}`}
						onClick={() => onNavigate(item.path)}
						className={clsx(
							'px-3 py-1.5 rounded-md text-sm',
							active ? 'bg-mid text-white font-semibold' : 'bg-surface text-gray-300 hover:bg-mid/60'
						)}
						aria-current={active ? 'page' : undefined}
					>
						{item.label}
					</button>
				)
			})}
		</nav>
	)
}
