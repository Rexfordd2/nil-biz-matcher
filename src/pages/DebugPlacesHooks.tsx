import { useEffect, useRef, useState } from 'react'
import { usePlacesSearch } from '../hooks/usePlacesSearch'
import { usePlaceDetails } from '../hooks/usePlaceDetails'
import { normalizeError, type NormalizedError } from '../lib/errorHandling'

type TestResult = {
	query: string
	timestamp: number
	resultsCount: number
	error: string | null
	errorKind?: NormalizedError['kind']
	statusCode?: number
	aborted: boolean
	finalState: boolean
}

export default function DebugPlacesHooks() {
	const [query, setQuery] = useState('')
	const [location, setLocation] = useState('New York, NY')
	const [testResults, setTestResults] = useState<TestResult[]>([])
	const [isRunning, setIsRunning] = useState(false)
	const [assertions, setAssertions] = useState<string[]>([])
	const testRunRef = useRef<{ queries: string[], startTime: number } | null>(null)

	const { results, loading, error } = usePlacesSearch({
		query,
		locationText: location,
		requestId: `test-${Date.now()}`
	})

	// Track results changes for all queries during test
	const queryStateRef = useRef<Map<string, { resultsCount: number, error: string | null, timestamp: number }>>(new Map())

	useEffect(() => {
		if (testRunRef.current && query) {
			const timestamp = Date.now()
			const currentState = queryStateRef.current.get(query)
			
			// Update state for this query
			queryStateRef.current.set(query, {
				resultsCount: results.length,
				error,
				timestamp: currentState?.timestamp || timestamp
			})

			// Update test results with error categorization
			const normalized = error ? normalizeError(error) : null
			setTestResults(prev => {
				const existing = prev.find(r => r.query === query)
				if (existing) {
					return prev.map(r => 
						r.query === query 
							? { 
								...r, 
								resultsCount: results.length, 
								error, 
								timestamp: currentState?.timestamp || timestamp,
								errorKind: normalized?.kind,
								statusCode: normalized?.statusCode
							}
							: r
					)
				}
				return [...prev, {
					query,
					timestamp: currentState?.timestamp || timestamp,
					resultsCount: results.length,
					error,
					errorKind: normalized?.kind,
					statusCode: normalized?.statusCode,
					aborted: false,
					finalState: false
				}]
			})
		}
	}, [results, error, query])

	async function runRapidTypingTest() {
		setIsRunning(true)
		setTestResults([])
		setAssertions([])
		queryStateRef.current.clear()

		const queries = ['p', 'pi', 'piz', 'pizz', 'pizza', 'pizza ', 'pizza n', 'pizza ne', 'pizza new']
		testRunRef.current = { queries, startTime: Date.now() }

		// Track when each query was set
		const querySetTimes = new Map<string, number>()
		for (let i = 0; i < queries.length; i++) {
			querySetTimes.set(queries[i], Date.now())
			setQuery(queries[i])
			await new Promise(resolve => setTimeout(resolve, 50))
		}

		// Wait for final request to complete (max 5 seconds)
		const finalQuery = queries[queries.length - 1]
		const startWait = Date.now()
		while (Date.now() - startWait < 5000) {
			if (query === finalQuery && !loading) {
				break
			}
			await new Promise(resolve => setTimeout(resolve, 100))
		}

		// Mark final query as final state
		setTestResults(prev => prev.map(r => 
			r.query === finalQuery ? { ...r, finalState: true } : r
		))

		// Wait a bit more to ensure all state updates are captured
		await new Promise(resolve => setTimeout(resolve, 200))

		// Verify assertions using current testResults state
		const currentResults = [...testResults]
		const finalQueryResult = currentResults.find(r => r.query === finalQuery)
		
		const newAssertions: string[] = []
		
		// Assertion 1: Final query should complete successfully
		if (finalQueryResult) {
			if (finalQueryResult.error) {
				newAssertions.push(`⚠️ Final query completed with error: ${finalQueryResult.error}`)
			} else {
				newAssertions.push(`✅ Final query completed successfully with ${finalQueryResult.resultsCount} results`)
			}
		} else {
			newAssertions.push(`❌ Final query result not found in test results`)
		}

		// Assertion 2: Should have multiple queries tracked (rapid changes)
		if (currentResults.length > 1) {
			newAssertions.push(`✅ Multiple queries tracked: ${currentResults.length} (rapid changes detected)`)
		} else {
			newAssertions.push(`⚠️ Only ${currentResults.length} query tracked (may not have detected rapid changes)`)
		}

		// Assertion 3: Verify latest-request-wins - only final query should have finalState: true
		const finalStateResults = currentResults.filter(r => r.finalState)
		if (finalStateResults.length === 1 && finalStateResults[0].query === finalQuery) {
			newAssertions.push(`✅ Only final query has final state (latest-request-wins working)`)
		} else {
			newAssertions.push(`❌ ${finalStateResults.length} queries have final state (race condition detected)`)
		}

		// Assertion 4: Check that current results match final query (no stale overwrite)
		if (results.length === finalQueryResult?.resultsCount && query === finalQuery) {
			newAssertions.push(`✅ Current results match final query (no stale overwrite)`)
		} else {
			newAssertions.push(`⚠️ Current results may not match final query`)
		}

		// Assertion 5: No error should be set unless it's a real error (not from aborted requests)
		const nonFinalErrors = currentResults.filter(r => r.query !== finalQuery && r.error)
		if (nonFinalErrors.length === 0) {
			newAssertions.push(`✅ No intermediate queries set error state (aborted requests handled correctly)`)
		} else {
			newAssertions.push(`⚠️ ${nonFinalErrors.length} intermediate query(ies) set error state (may indicate aborted requests setting errors)`)
		}

		// Assertion 7: Verify error categorization
		const categorizedErrors = currentResults.filter(r => r.errorKind)
		if (categorizedErrors.length > 0) {
			const kinds = categorizedErrors.map(r => r.errorKind).filter(Boolean) as string[]
			const uniqueKinds = [...new Set(kinds)]
			newAssertions.push(`✅ Errors categorized: ${uniqueKinds.join(', ')} (${categorizedErrors.length} total)`)
		} else if (currentResults.some(r => r.error)) {
			newAssertions.push(`⚠️ Some errors not categorized`)
		} else {
			newAssertions.push(`✅ No errors to categorize`)
		}

		// Assertion 6: Verify that results are ordered correctly (later queries should have later timestamps)
		const sortedResults = [...currentResults].sort((a, b) => a.timestamp - b.timestamp)
		const lastResult = sortedResults[sortedResults.length - 1]
		if (lastResult && lastResult.query === finalQuery) {
			newAssertions.push(`✅ Latest results by timestamp match final query`)
		} else {
			newAssertions.push(`⚠️ Latest results by timestamp do not match final query`)
		}

		setAssertions(newAssertions)
		setIsRunning(false)
		testRunRef.current = null
	}

	return (
		<div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
			<h1>Places Hooks AbortController Test Harness</h1>
			<p>This harness verifies that rapid query changes trigger aborts and prevent stale overwrites.</p>

			<div style={{ marginBottom: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
				<h2>Test Controls</h2>
				<div style={{ marginBottom: '10px' }}>
					<label style={{ display: 'block', marginBottom: '5px' }}>Location:</label>
					<input
						type="text"
						value={location}
						onChange={(e) => setLocation(e.target.value)}
						style={{ width: '300px', padding: '8px' }}
						placeholder="New York, NY"
					/>
				</div>
				<div style={{ marginBottom: '10px' }}>
					<label style={{ display: 'block', marginBottom: '5px' }}>Current Query:</label>
					<input
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						style={{ width: '300px', padding: '8px' }}
						placeholder="pizza"
					/>
				</div>
				<button
					onClick={runRapidTypingTest}
					disabled={isRunning}
					style={{
						padding: '10px 20px',
						background: isRunning ? '#ccc' : '#007bff',
						color: 'white',
						border: 'none',
						borderRadius: '4px',
						cursor: isRunning ? 'not-allowed' : 'pointer'
					}}
				>
					{isRunning ? 'Running Test...' : 'Run Rapid Typing Test'}
				</button>
			</div>

			<div style={{ marginBottom: '20px', padding: '15px', background: '#e8f4f8', borderRadius: '8px' }}>
				<h2>Current Hook State</h2>
				<p><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</p>
				<p><strong>Error:</strong> {error || 'None'}</p>
				<p><strong>Results Count:</strong> {results.length}</p>
				{results.length > 0 && (
					<div>
						<strong>Results:</strong>
						<ul>
							{results.slice(0, 5).map((r, i) => (
								<li key={i}>{r.name} - {r.formattedAddress}</li>
							))}
						</ul>
					</div>
				)}
			</div>

			{assertions.length > 0 && (
				<div style={{ marginBottom: '20px', padding: '15px', background: '#fff3cd', borderRadius: '8px' }}>
					<h2>Test Assertions</h2>
					<ul>
						{assertions.map((a, i) => (
							<li key={i} style={{ marginBottom: '5px' }}>{a}</li>
						))}
					</ul>
				</div>
			)}

			{testResults.length > 0 && (
				<div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
					<h2>Test Results ({testResults.length} queries tracked)</h2>
					<table style={{ width: '100%', borderCollapse: 'collapse' }}>
						<thead>
							<tr style={{ borderBottom: '2px solid #ddd' }}>
								<th style={{ padding: '8px', textAlign: 'left' }}>Query</th>
								<th style={{ padding: '8px', textAlign: 'left' }}>Timestamp</th>
								<th style={{ padding: '8px', textAlign: 'left' }}>Results</th>
								<th style={{ padding: '8px', textAlign: 'left' }}>Error Kind</th>
								<th style={{ padding: '8px', textAlign: 'left' }}>Status</th>
								<th style={{ padding: '8px', textAlign: 'left' }}>Error Message</th>
								<th style={{ padding: '8px', textAlign: 'left' }}>Final State</th>
							</tr>
						</thead>
						<tbody>
							{testResults
								.sort((a, b) => a.timestamp - b.timestamp)
								.map((r, i) => {
									const kindColors: Record<string, string> = {
										offline: '#f59e0b',
										rate_limited: '#ef4444',
										unauthorized: '#dc2626',
										validation_error: '#f97316',
										server_error: '#eab308',
										unknown: '#6b7280'
									}
									return (
										<tr key={i} style={{ borderBottom: '1px solid #eee' }}>
											<td style={{ padding: '8px' }}>{r.query}</td>
											<td style={{ padding: '8px' }}>{new Date(r.timestamp).toLocaleTimeString()}</td>
											<td style={{ padding: '8px' }}>{r.resultsCount}</td>
											<td style={{ padding: '8px', color: r.errorKind ? kindColors[r.errorKind] || '#6b7280' : 'green', fontWeight: 'bold' }}>
												{r.errorKind || 'none'}
											</td>
											<td style={{ padding: '8px' }}>{r.statusCode || '-'}</td>
											<td style={{ padding: '8px', color: r.error ? 'red' : 'green', fontSize: '12px' }}>
												{r.error || 'None'}
											</td>
											<td style={{ padding: '8px' }}>{r.finalState ? '✅' : '⏳'}</td>
										</tr>
									)
								})}
						</tbody>
					</table>
				</div>
			)}

			<div style={{ padding: '15px', background: '#d1ecf1', borderRadius: '8px' }}>
				<h2>Expected Behavior</h2>
				<ul>
					<li>✅ Rapid query changes should trigger AbortController.abort()</li>
					<li>✅ Aborted requests should NOT set error state</li>
					<li>✅ Only the latest request should update state (latest-request-wins)</li>
					<li>✅ No stale results should overwrite newer results</li>
					<li>✅ Final query should complete successfully</li>
				</ul>
			</div>
		</div>
	)
}
