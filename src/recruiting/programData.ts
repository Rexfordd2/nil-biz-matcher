import { CollegeProgram } from './programTypes'

export const SAMPLE_PROGRAMS: CollegeProgram[] = [
	{
		id: 'prog-1',
		name: 'Central State University Football',
		sport: 'Football',
		level: 'NCAA_D2',
		type: 'college',
		conference: 'G-MAC',
		location: { city: 'Wilberforce', stateOrRegion: 'OH', country: 'USA', latitude: 39.7082, longitude: -83.8777 },
		academic: { minGpaRange: '2.5+', typicalMajors: ['Business', 'Kinesiology'] },
		playstyle: { playstyleTags: ['Pro-style', 'Balanced'], personalityTags: ['Development-focused', 'Blue-collar'] },
		recruiters: [{ name: 'J. Smith', role: 'Recruiting Coordinator', email: 'recruit@csu.edu' }],
		teamSiteUrl: 'https://centralstateathletics.com',
		recruitingPageUrl: 'https://forms.csu.edu/recruiting',
		socialHandles: ['@CSUFootball']
	},
	{
		id: 'prog-2',
		name: 'Metro City University Basketball',
		sport: 'Basketball',
		level: 'NCAA_D1',
		type: 'college',
		conference: 'Metro Conference',
		location: { city: 'Metro City', stateOrRegion: 'CA', country: 'USA', latitude: 34.0522, longitude: -118.2437 },
		academic: { minGpaRange: '3.0+', typicalMajors: ['Communications', 'Computer Science'] },
		playstyle: { playstyleTags: ['Tempo'], personalityTags: ['High-upside', 'Detail-oriented'] },
		recruiters: [{ name: 'A. Johnson', role: 'Assistant Coach', email: 'mbb@metrocity.edu' }],
		teamSiteUrl: 'https://mcubears.com',
		recruitingPageUrl: 'https://mcubears.com/recruit',
		socialHandles: ['@MCUBasketball']
	},
	{
		id: 'prog-3',
		name: 'River Valley CC Baseball',
		sport: 'Baseball',
		level: 'JUCO',
		type: 'college',
		location: { city: 'River Valley', stateOrRegion: 'TX', country: 'USA', latitude: 29.7604, longitude: -95.3698 },
		academic: { minGpaRange: '2.0+' },
		playstyle: { playstyleTags: ['Development'], personalityTags: ['High-upside'] },
		recruiters: [{ name: 'Coach Rivera', role: 'Head Coach', email: 'baseball@rvcc.edu' }],
		teamSiteUrl: 'https://rvccathletics.edu/baseball'
	},
	{
		id: 'prog-4',
		name: 'Northside Wolves Football',
		sport: 'Football',
		level: 'NCAA_D3',
		type: 'college',
		conference: 'North Coast',
		location: { city: 'Madison', stateOrRegion: 'WI', country: 'USA', latitude: 43.0731, longitude: -89.4012 },
		academic: { minGpaRange: '3.0+', typicalMajors: ['Biology', 'Engineering'] },
		playstyle: { playstyleTags: ['Run-heavy'], personalityTags: ['Blue-collar'] },
		recruiters: [{ name: 'K. Lee', role: 'WR Coach', email: 'recruiting@northside.edu' }]
	},
	{
		id: 'prog-5',
		name: 'City United FC',
		sport: 'Soccer',
		level: 'SEMI_PRO',
		type: 'semi_pro',
		location: { city: 'Austin', stateOrRegion: 'TX', country: 'USA', latitude: 30.2672, longitude: -97.7431 },
		playstyle: { playstyleTags: ['Possession'], personalityTags: ['Detail-oriented'] },
		recruiters: [{ name: 'Recruiting Desk', role: 'Coordinator', email: 'scout@cityunitedfc.com', website: 'https://cityunitedfc.com/trials' }],
		socialHandles: ['@CityUnitedFC']
	}
]

