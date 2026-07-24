import clsx from 'clsx'
import { OPPORTUNITIES_SUBNAV } from '../routes/appRoutes'

type Props = {
	currentPath: string
	onNavigate: (path: string) => void
}

/** Lightweight section nav among Opportunities tools (does not merge data models). */
export default function OpportunitiesSubnav({ currentPath, onNavigate }: Props) {
	return (
		<nav
			className="flex flex-wrap gap-2 mb-4"
			aria-label="Opportunities section"
			data-testid="opportunities-subnav"
		>
			{OPPORTUNITIES_SUBNAV.map(item => {
				const active = currentPath === item.path
				return (
					<button
						key={item.path}
						type="button"
						data-testid={`opportunities-subnav-${item.label.toLowerCase()}`}
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
