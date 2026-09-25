import { useEffect, useState } from 'react'
import clsx from 'clsx'

type Item = {
	key: string
	label: string
	path?: string
}

type Section = {
	title: string
	collapsible?: boolean
	items: Item[]
}

export type SidebarProps = {
	/** Active parent destination id (highlights for all child routes). */
	current: string
	onSelect: (key: string, path?: string) => void
	sections: Section[]
}

function sectionSlug(title: string): string {
	return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function CollapsibleSection({ section, current, children }: { section: Section; current: string; children: React.ReactNode }) {
	const containsActive = section.items.some(it => it.key === current)
	const [open, setOpen] = useState(containsActive)
	useEffect(() => {
		if (containsActive) setOpen(true)
	}, [containsActive])
	const slug = sectionSlug(section.title)
	return (
		<div data-testid={`nav-section-${slug}`}>
			<button
				type="button"
				data-testid={`nav-section-toggle-${slug}`}
				aria-expanded={open}
				onClick={() => setOpen(v => !v)}
				className="w-full flex items-center justify-between text-xs uppercase tracking-wide text-foreground/60 mb-2"
			>
				<span>{section.title}</span>
				<span aria-hidden="true">{open ? '−' : '+'}</span>
			</button>
			{open && children}
		</div>
	)
}

export default function Sidebar({ current, onSelect, sections }: SidebarProps) {
	return (
		<aside className="bg-surface border border-border rounded-xl p-3 md:p-4 h-full" data-testid="app-sidebar">
			<nav className="space-y-5">
				{sections.map((section, si) => {
					const list = (
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
					)
					if (section.collapsible) {
						return (
							<CollapsibleSection key={`sec-${si}`} section={section} current={current}>
								{list}
							</CollapsibleSection>
						)
					}
					return (
						<div key={`sec-${si}`}>
							<div className="text-xs uppercase tracking-wide text-foreground/60 mb-2">{section.title}</div>
							{list}
						</div>
					)
				})}
			</nav>
		</aside>
	)
}
