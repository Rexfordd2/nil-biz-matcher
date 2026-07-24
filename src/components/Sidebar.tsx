import clsx from 'clsx'

type Item = {
	key: string
	label: string
	path?: string
}

type Section = {
	title: string
	items: Item[]
}

export type SidebarProps = {
	/** Active parent destination id (highlights for all child routes). */
	current: string
	onSelect: (key: string, path?: string) => void
	sections: Section[]
}

export default function Sidebar({ current, onSelect, sections }: SidebarProps) {
	return (
		<aside className="bg-surface border border-border rounded-xl p-3 md:p-4 h-full" data-testid="app-sidebar">
			<nav className="space-y-5">
				{sections.map((section, si) => (
					<div key={`sec-${si}`}>
						<div className="text-xs uppercase tracking-wide text-foreground/60 mb-2">{section.title}</div>
						<ul className="space-y-1">
							{section.items.map(it => (
								<li key={it.key}>
									<button
										type="button"
										data-testid={`nav-${it.key}`}
										onClick={() => onSelect(it.key, it.path)}
										className={clsx(
											'w-full text-left px-3 py-2 rounded-md text-sm',
											current === it.key
												? 'bg-mid text-foreground font-semibold'
												: 'text-foreground/80 hover:bg-mid'
										)}
										aria-current={current === it.key ? 'page' : undefined}
									>
										{it.label}
									</button>
								</li>
							))}
						</ul>
					</div>
				))}
			</nav>
		</aside>
	)
}
