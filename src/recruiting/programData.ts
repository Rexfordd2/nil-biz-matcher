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
	},
	{
		id: 'prog-6',
		name: 'Bay State Spartans Football',
		sport: 'Football',
		level: 'NCAA_D1',
		type: 'college',
		conference: 'Independent',
		location: { city: 'Boston', stateOrRegion: 'MA', country: 'USA', latitude: 42.3601, longitude: -71.0589 },
		academic: { minGpaRange: '2.8+' },
		playstyle: { playstyleTags: ['Spread'], personalityTags: ['High-upside'] },
		recruiters: [{ name: 'Coach Wright', role: 'Recruiting', email: 'football@bss.edu' }]
	},
	{
		id: 'prog-7',
		name: 'Lone Star Tech Football',
		sport: 'Football',
		level: 'NCAA_D2',
		type: 'college',
		conference: 'Lone Star',
		location: { city: 'Dallas', stateOrRegion: 'TX', country: 'USA', latitude: 32.7767, longitude: -96.7970 },
		academic: { minGpaRange: '2.5+' },
		playstyle: { playstyleTags: ['Air Raid'], personalityTags: ['Tempo'] },
		recruiters: [{ name: 'S. Alvarez', role: 'OC', email: 'recruit@lst.edu' }]
	},
	{
		id: 'prog-8',
		name: 'Pacific Northwest University Football',
		sport: 'Football',
		level: 'NCAA_D3',
		type: 'college',
		conference: 'Cascade',
		location: { city: 'Portland', stateOrRegion: 'OR', country: 'USA', latitude: 45.5152, longitude: -122.6784 },
		academic: { minGpaRange: '3.2+' },
		playstyle: { playstyleTags: ['Balanced'], personalityTags: ['Development-focused'] },
		recruiters: [{ name: 'Coach Kim', role: 'DC', email: 'recruit@pnwu.edu' }]
	},
	{
		id: 'prog-9',
		name: 'Desert City Raptors (Semi-Pro)',
		sport: 'Football',
		level: 'SEMI_PRO',
		type: 'semi_pro',
		location: { city: 'Phoenix', stateOrRegion: 'AZ', country: 'USA', latitude: 33.4484, longitude: -112.0740 },
		playstyle: { playstyleTags: ['Physical'], personalityTags: ['Blue-collar'] },
		recruiters: [{ name: 'Front Office', role: 'Ops', email: 'ops@raptorsfp.com', website: 'https://raptorsfp.com/tryouts' }]
	},
	{
		id: 'prog-10',
		name: 'Great Lakes University Football',
		sport: 'Football',
		level: 'NCAA_D1',
		type: 'college',
		conference: 'Great Lakes',
		location: { city: 'Cleveland', stateOrRegion: 'OH', country: 'USA', latitude: 41.4993, longitude: -81.6944 },
		academic: { minGpaRange: '3.0+' },
		playstyle: { playstyleTags: ['Pro-style'], personalityTags: ['Detail-oriented'] },
		recruiters: [{ name: 'Coach Harris', role: 'Recruiting', email: 'football@glu.edu' }]
	},
	{
		id: 'prog-11',
		name: 'Sun Coast College Football',
		sport: 'Football',
		level: 'NAIA',
		type: 'college',
		location: { city: 'Tampa', stateOrRegion: 'FL', country: 'USA', latitude: 27.9506, longitude: -82.4572 },
		academic: { minGpaRange: '2.5+' },
		playstyle: { playstyleTags: ['Run-pass option'], personalityTags: ['Tempo'] },
		recruiters: [{ name: 'T. Benson', role: 'RC', email: 'recruit@suncoast.edu' }]
	},
	{
		id: 'prog-12',
		name: 'Northern Plains CC Football',
		sport: 'Football',
		level: 'JUCO',
		type: 'college',
		location: { city: 'Fargo', stateOrRegion: 'ND', country: 'USA', latitude: 46.8772, longitude: -96.7898 },
		academic: { minGpaRange: '2.0+' },
		playstyle: { playstyleTags: ['Development'], personalityTags: ['High-upside'] },
		recruiters: [{ name: 'Coach Daly', role: 'HC', email: 'football@npcc.edu' }]
	},
	{
		id: 'prog-13',
		name: 'SoCal Sharks (Semi-Pro)',
		sport: 'Football',
		level: 'SEMI_PRO',
		type: 'semi_pro',
		location: { city: 'Los Angeles', stateOrRegion: 'CA', country: 'USA', latitude: 34.0522, longitude: -118.2437 },
		playstyle: { playstyleTags: ['Speed'], personalityTags: ['High-upside'] },
		recruiters: [{ name: 'Team Admin', role: 'Admin', email: 'contact@socalsharks.org', website: 'https://socalsharks.org/join' }]
	},
	{
		id: 'prog-14',
		name: 'Heartland University Football',
		sport: 'Football',
		level: 'NCAA_D2',
		type: 'college',
		conference: 'Heartland',
		location: { city: 'Kansas City', stateOrRegion: 'MO', country: 'USA', latitude: 39.0997, longitude: -94.5786 },
		academic: { minGpaRange: '2.7+' },
		playstyle: { playstyleTags: ['Balanced'], personalityTags: ['Detail-oriented'] },
		recruiters: [{ name: 'Coach Lang', role: 'Recruiting', email: 'recruit@heartland.edu' }]
	},
	{
		id: 'prog-15',
		name: 'Gulf Coast Gators (Semi-Pro)',
		sport: 'Football',
		level: 'SEMI_PRO',
		type: 'semi_pro',
		location: { city: 'Mobile', stateOrRegion: 'AL', country: 'USA', latitude: 30.6954, longitude: -88.0399 },
		playstyle: { playstyleTags: ['Physical'], personalityTags: ['Blue-collar'] },
		recruiters: [{ name: 'GM Office', role: 'GM', email: 'tryouts@gatorssp.com', website: 'https://gatorssp.com/tryouts' }]
	}
]

