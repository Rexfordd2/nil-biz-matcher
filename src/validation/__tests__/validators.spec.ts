import { describe, expect, test } from 'vitest'
import { validateBusinessResponse, validateProgramsResponse } from '../validators'

// Business response
describe('Business validator', () => {
	test('valid response object', () => {
		const raw = { businesses: [{ name: 'A', coordinates: { latitude: 1, longitude: 2 } }] }
		const res = validateBusinessResponse(raw)
		expect(res.ok).toBe(true)
		if (res.ok) expect(res.businesses.length).toBe(1)
	})
	test('valid bare array', () => {
		const raw = [{ name: 'B' }]
		const res = validateBusinessResponse(raw)
		expect(res.ok).toBe(true)
		if (res.ok) expect(res.businesses.length).toBe(1)
	})
	test('missing field', () => {
		const raw = { nope: [] }
		const res = validateBusinessResponse(raw)
		expect(res.ok).toBe(false)
	})
	test('wrong type in nested', () => {
		const raw = { businesses: [{ name: 123 }] }
		const res = validateBusinessResponse(raw)
		expect(res.ok).toBe(false)
	})
})

// Programs response
describe('Programs validator', () => {
	test('valid response', () => {
		const raw = { programs: [{ id: 'p1', name: 'Prog' }] }
		const res = validateProgramsResponse(raw)
		expect(res.ok).toBe(true)
		if (res.ok) expect(res.programs.length).toBe(1)
	})
	test('missing programs array', () => {
		const raw = { foo: [] }
		const res = validateProgramsResponse(raw)
		expect(res.ok).toBe(false)
	})
	test('wrong type', () => {
		const raw = { programs: [{ id: 1 }] }
		const res = validateProgramsResponse(raw)
		expect(res.ok).toBe(false)
	})
})

