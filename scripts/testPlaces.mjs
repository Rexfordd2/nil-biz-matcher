async function main() {
	const key = process.env.GOOGLE_MAPS_API_KEY
	if (!key) {
		console.error('GOOGLE_MAPS_API_KEY is not set')
		process.exit(1)
	}
	const params = {
		term: process.argv[2] || 'pizza',
		location: process.argv[3] || 'Huntington Beach, CA',
		limit: Number(process.argv[4] || 5)
	}
	const qs = new URLSearchParams()
	const query = [params.term, params.location].filter(Boolean).join(' ')
	qs.set('query', query)
	const region = process.env.GOOGLE_MAPS_REGION_BIAS
	if (region) qs.set('region', region)
	qs.set('key', key)
	const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${qs.toString()}`
	const res = await fetch(url, { method: 'GET' })
	if (!res.ok) {
		console.error('HTTP error from Places API:', res.status, res.statusText)
		process.exit(1)
	}
	const data = await res.json()
	const results = Array.isArray(data.results) ? data.results : []
	console.log(`Query: ${query} → ${results.length} results (status=${data.status || 'OK'})`)
	results.slice(0, params.limit).forEach((place, idx) => {
		console.log(`${idx + 1}. ${place.name} — ${place.formatted_address || ''}`)
	})
}

main().catch(err => {
	console.error(err)
	process.exit(1)
})


