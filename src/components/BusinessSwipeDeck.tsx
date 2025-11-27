import { useMemo } from 'react'
import TinderCard from 'react-tinder-card'
import { Business } from '../types'
import Button from './ui/Button'

type Props = {
	businesses: Business[]
	currentIndex: number
	onIndexChange: (idx: number) => void
	onSwipeDecision: (id: string, decision: 'approve' | 'skip') => void
}

export default function BusinessSwipeDeck({ businesses, currentIndex, onIndexChange, onSwipeDecision }: Props) {
	const ordered = useMemo(() => businesses, [businesses])

	function handleSwipe(dir: string, idx: number) {
		const biz = ordered[idx]
		if (!biz) return
		if (dir === 'right') {
			onSwipeDecision(biz.id, 'approve')
		} else if (dir === 'left') {
			onSwipeDecision(biz.id, 'skip')
		}
		const next = Math.min(idx + 1, ordered.length - 1)
		onIndexChange(next)
	}

	function manual(decision: 'approve' | 'skip') {
		const biz = ordered[currentIndex]
		if (!biz) return
		onSwipeDecision(biz.id, decision)
		const next = Math.min(currentIndex + 1, ordered.length - 1)
		onIndexChange(next)
	}

	const active = ordered[currentIndex]

	return (
		<div className="w-full">
			<div className="relative h-[360px]">
				{ordered.map((b, idx) => (
					<div
						key={b.id}
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
									<div className="text-white font-semibold text-lg truncate">{b.name}</div>
									<div className="text-gray-400 text-sm truncate">{b.location}</div>
								</header>
								<div className="text-sm text-gray-300 space-y-1">
									{typeof b.rating === 'number' && (
										<div>Rating: {b.rating} {typeof b.reviewCount === 'number' ? `(${b.reviewCount})` : ''}</div>
									)}
									{b.category && <div>Category: {b.category}</div>}
									{b.url && (
										<div className="truncate">
											<a href={b.url} target="_blank" rel="noreferrer" className="text-blue-300 hover:underline">{b.url}</a>
										</div>
									)}
								</div>
							</div>
						</TinderCard>
					</div>
				))}
			</div>
			<div className="mt-3 flex items-center justify-center gap-3">
				<Button variant="ghost" onClick={() => manual('skip')}>Skip</Button>
				<Button onClick={() => manual('approve')} className="red-glow">Pursue</Button>
			</div>
			{active && (
				<div className="mt-2 text-center text-xs text-gray-400">
					{currentIndex + 1} / {ordered.length}
				</div>
			)}
		</div>
	)
}


