export type SuggestionType = 'local_brand_idea' | 'event_idea' | 'content_idea' | 'training_resource'

export type ProfileSuggestion = {
	id: string
	type: SuggestionType
	title: string
	description: string
	conditions: {
		sports?: string[]
		positions?: string[]
		regions?: string[]
		minFollowers?: number
		contentStyles?: string[]
		monetizationInterests?: string[]
	}
}


