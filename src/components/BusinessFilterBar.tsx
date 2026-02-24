import Select from './ui/Select'
import Input from './ui/Input'
import type { Business } from '../types'
import type { BusinessFilters } from '../hooks/useBusinessFilters'
import { getAllTags } from '../hooks/useBusinessFilters'

const STATUS_OPTIONS: Array<Business['status']> = ['Not Contacted', 'Pending', 'In Discussion', 'Partnered']

type Props = {
	businesses: Business[]
	filters: BusinessFilters
	onFiltersChange: (next: BusinessFilters) => void
	/** Show only status dropdown (e.g. Dashboard). */
	statusOnly?: boolean
}

export default function BusinessFilterBar({ businesses, filters, onFiltersChange, statusOnly }: Props) {
	const allTags = getAllTags(businesses)

	const setStatus = (status: BusinessFilters['status']) => {
		onFiltersChange({ ...filters, status })
	}
	const setLocation = (location: string) => {
		onFiltersChange({ ...filters, location })
	}
	const toggleTag = (tag: string) => {
		const next = filters.tags.includes(tag)
			? filters.tags.filter(t => t !== tag)
			: [...filters.tags, tag]
		onFiltersChange({ ...filters, tags: next })
	}

	return (
		<div className="flex flex-wrap items-center gap-3">
			<Select
				value={filters.status}
				onChange={e => setStatus(e.target.value as BusinessFilters['status'])}
			>
				<option value="">All statuses</option>
				{STATUS_OPTIONS.map(s => (
					<option key={s} value={s}>{s}</option>
				))}
			</Select>
			{!statusOnly && (
				<>
					<Input
						value={filters.location}
						onChange={e => setLocation(e.target.value)}
						placeholder="Search location or name..."
						className="min-w-[180px]"
					/>
					{allTags.length > 0 && (
						<div className="flex flex-wrap gap-2">
							{allTags.map(tag => (
								<button
									key={tag}
									type="button"
									onClick={() => toggleTag(tag)}
									className={`px-2 py-1 rounded text-sm border ${
										filters.tags.includes(tag)
											? 'bg-red-600 border-red-500 text-white'
											: 'bg-mid border-border text-gray-300 hover:border-gray-500'
									}`}
								>
									{tag}
								</button>
							))}
						</div>
					)}
				</>
			)}
		</div>
	)
}
