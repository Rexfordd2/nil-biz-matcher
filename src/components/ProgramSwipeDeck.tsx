import { useMemo } from 'react'
import TinderCard from 'react-tinder-card'
import Button from './ui/Button'
import { CollegeProgram } from '../recruiting/programTypes'

type Props = {
	programs: CollegeProgram[]
	currentIndex: number
	onIndexChange: (idx: number) => void
	onSwipeDecision: (id: string, decision: 'pursue' | 'maybe' | 'skip') => void
	summaryById?: Record<string, { rating?: string; note?: string; tags?: string[]; gpa?: string }>
	disabled?: boolean
}

export default function ProgramSwipeDeck({ programs, currentIndex, onIndexChange, onSwipeDecision, summaryById, disabled }: Props) {
	const ordered = useMemo(() => programs, [programs])

	function handleSwipe(dir: string, idx: number) {
		if (disabled) return
		const prog = ordered[idx]
		if (!prog) return
		if (dir === 'right') {
			onSwipeDecision(prog.id, 'pursue')
		} else if (dir === 'left') {
			onSwipeDecision(prog.id, 'skip')
		}
		const next = Math.min(idx + 1, ordered.length - 1)
		onIndexChange(next)
	}

	function manual(decision: 'pursue' | 'maybe' | 'skip') {
		if (disabled) return
		const prog = ordered[currentIndex]
		if (!prog) return
		onSwipeDecision(prog.id, decision)
		const next = Math.min(currentIndex + 1, ordered.length - 1)
		onIndexChange(next)
	}

	const active = ordered[currentIndex]

	return (
		<div className="w-full">
			<div className="relative h-[360px]">
				{ordered.map((p, idx) => {
					const s = summaryById?.[p.id]
					return (
						<div
							key={p.id}
							className="absolute inset-0 flex items-center justify-center"
							style={{ zIndex: ordered.length - idx, visibility: idx < currentIndex - 1 ? 'hidden' : 'visible' }}
						>
							<TinderCard
								className="w-full max-w-md"
								onSwipe={(dir) => handleSwipe(dir, idx)}
								preventSwipe={['up', 'down']}
							>
								<div className={`card p-5 ${idx === currentIndex ? 'shadow-lg' : 'opacity-70'}`}>
									<header className="mb-3">
										<div className="text-white font-semibold text-lg truncate">{p.name}</div>
										<div className="text-gray-400 text-sm truncate">{[p.sport, p.level, p.conference].filter(Boolean).join(' • ')}</div>
										<div className="text-gray-400 text-sm truncate">{[p.location?.city, p.location?.stateOrRegion].filter(Boolean).join(', ')}</div>
									</header>
									<div className="text-sm text-gray-300 space-y-2">
										{s?.gpa && <div>GPA: {s.gpa}</div>}
										{(p.playstyle?.playstyleTags || []).length > 0 && (
											<div className="truncate">
												<span className="text-gray-400">Style: </span>{p.playstyle?.playstyleTags?.slice(0, 3).join(' • ')}
											</div>
										)}
										{(p.playstyle?.personalityTags || []).length > 0 && (
											<div className="truncate">
												<span className="text-gray-400">Identity: </span>{p.playstyle?.personalityTags?.slice(0, 3).join(' • ')}
											</div>
										)}
										{s?.rating && (
											<div className="text-xs">
												<span className="px-2 py-0.5 rounded-md border border-border bg-mid text-white">{s.rating}</span>
												{s?.note && <span className="ml-2 text-gray-400">{s.note}</span>}
											</div>
										)}
									</div>
								</div>
							</TinderCard>
						</div>
					)
				})}
			</div>
			<div className="mt-3 flex items-center justify-center gap-3">
				<Button variant="ghost" onClick={() => manual('skip')}>Skip</Button>
				<Button variant="ghost" onClick={() => manual('maybe')}>Maybe</Button>
				<Button onClick={() => manual('pursue')} className="red-glow">Pursue</Button>
			</div>
			{active && (
				<div className="mt-2 text-center text-xs text-gray-400">
					{currentIndex + 1} / {ordered.length}
				</div>
			)}
		</div>
	)
}


