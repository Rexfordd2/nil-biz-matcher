import clsx from 'clsx'

type Item = {
	key: string
	label: string
}

type Section = {
	title: string
	items: Item[]
}

export type SidebarProps = {
	current: string
	onSelect: (key: string) => void
	sections: Section[]
}

export default function Sidebar({ current, onSelect, sections }: SidebarProps) {
	return (
		<aside className="bg-surface border border-border rounded-xl p-3 md:p-4 h-full">
			<nav className="space-y-5">
				{sections.map((section, si) => (
					<div key={`sec-${si}`}>
						<div className="text-xs uppercase tracking-wide text-foreground/60 mb-2">{section.title}</div>
						<ul className="space-y-1">
							{section.items.map(it => (
								<li key={it.key}>
									<button
										type="button"
										onClick={() => onSelect(it.key)}
										className={clsx(
											'w-full text-left px-3 py-2 rounded-md text-sm',
											current === it.key
												? 'bg-mid text-foreground font-semibold'
												: 'text-foreground/80 hover:bg-mid'
										)}
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


