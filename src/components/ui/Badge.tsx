import { clsx } from 'clsx'

export function FitBadge({ rating }: { rating: 'PERFECT FIT' | 'GOOD FIT' | 'STRETCH FIT' | 'POOR FIT' }) {
	const map = {
		'PERFECT FIT': 'badge badge-perfect',
		'GOOD FIT': 'badge badge-good',
		'STRETCH FIT': 'badge badge-stretch',
		'POOR FIT': 'badge badge-poor'
	}
	return <span className={clsx(map[rating])}>{rating}</span>
}

export function LevelBadge({ level }: { level: 'LOCAL' | 'REGIONAL' | 'NATIONAL' }) {
	const map = {
		LOCAL: 'badge level-local',
		REGIONAL: 'badge level-regional',
		NATIONAL: 'badge level-national'
	}
	return <span className={clsx(map[level])}>{level}</span>
}


