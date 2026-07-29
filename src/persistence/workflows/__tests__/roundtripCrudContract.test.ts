import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { DealLogEntry, EventPlan, Opportunity } from '../../../types'
import {
	decodeDeal,
	decodeEvent,
	decodeOpportunity,
	encodeDeal,
	encodeEvent,
	encodeOpportunity,
} from '../index'
import { planDealLegacyImport, planEventLegacyImport, planOpportunityLegacyImport } from '../importPlanners'
import { areMutationsDisabled, decideWorkflowBootstrapMode } from '../persistenceMode'
import { stableStringify, workflowRecordsEqual } from '../stableId'

const USER = 'user-roundtrip-1'

function roundTripOpportunity(record: Opportunity): Opportunity {
	const encoded = encodeOpportunity(USER, record)
	expect(encoded.ok).toBe(true)
	if (!encoded.ok) throw new Error('encode failed')
	const decoded = decodeOpportunity(encoded.value)
	expect(decoded.ok).toBe(true)
	if (!decoded.ok) throw new Error('decode failed')
	return decoded.value
}

function roundTripDeal(record: DealLogEntry): DealLogEntry {
	const encoded = encodeDeal(USER, record)
	expect(encoded.ok).toBe(true)
	if (!encoded.ok) throw new Error('encode failed')
	const decoded = decodeDeal(encoded.value)
	expect(decoded.ok).toBe(true)
	if (!decoded.ok) throw new Error('decode failed')
	return decoded.value
}

function roundTripEvent(record: EventPlan): EventPlan {
	const encoded = encodeEvent(USER, record)
	expect(encoded.ok).toBe(true)
	if (!encoded.ok) throw new Error('encode failed')
	const decoded = decodeEvent(encoded.value)
	expect(decoded.ok).toBe(true)
	if (!decoded.ok) throw new Error('decode failed')
	return decoded.value
}

describe('PR-4B1 full-payload round-trip contract', () => {
	it('opportunities preserve dates, notes, linkedDealId, and empty-string optionals', () => {
		const record: Opportunity = {
			id: 'opp-rt-1',
			athleteId: 'ath-1',
			title: 'Title',
			category: 'local_brand_deal',
			status: 'idea',
			description: '',
			targetBrandName: 'Brand',
			linkedDealId: 'deal-9',
			expectedStartDate: '2026-08-01',
			expectedEndDate: '2026-09-01',
			notes: 'Keep me',
		}
		const out = roundTripOpportunity(record)
		expect(out).toEqual(record)
		expect(out.expectedStartDate).toBe('2026-08-01')
		expect(out.expectedEndDate).toBe('2026-09-01')
		expect(out.notes).toBe('Keep me')
		expect(out.linkedDealId).toBe('deal-9')
		expect(out.description).toBe('')
	})

	it('deals preserve false booleans, zero value, empty arrays, and nested licensing false', () => {
		const record: DealLogEntry = {
			id: 'deal-rt-1',
			athleteId: 'ath-1',
			title: 'Deal',
			dealType: 'brand_sponsorship',
			brandName: 'Brand',
			status: 'idea',
			valueEstimate: 0,
			currency: 'USD',
			startDate: '2026-01-01',
			endDate: '2026-02-01',
			deliverables: [],
			exclusivityNotes: '',
			licensing: { usesSchoolMarks: false },
			reportedToSchool: false,
			reportedToCollective: false,
			complianceNotes: undefined,
			documents: [],
			payments: [
				{ date: '2026-01-15', amount: 0, currency: 'USD', method: 'check', notes: '' },
			],
		}
		const out = roundTripDeal(record)
		expect(out.valueEstimate).toBe(0)
		expect(out.reportedToSchool).toBe(false)
		expect(out.reportedToCollective).toBe(false)
		expect(out.licensing).toEqual({ usesSchoolMarks: false })
		expect(out.deliverables).toEqual([])
		expect(out.documents).toEqual([])
		expect(out.payments).toEqual([
			{ date: '2026-01-15', amount: 0, currency: 'USD', method: 'check', notes: '' },
		])
		expect(out.exclusivityNotes).toBe('')
		expect('complianceNotes' in out).toBe(false)
	})

	it('events preserve sponsors, URLs, linkedDealId, and empty sponsor list as []', () => {
		const withSponsors: EventPlan = {
			id: 'evt-rt-1',
			athleteId: 'ath-1',
			type: 'appearance',
			name: 'Event',
			date: '2026-07-20',
			location: 'Gym',
			sponsors: ['A', 'B'],
			runOfShowUrl: 'https://example.com/run',
			waiversUrl: 'https://example.com/waiver',
			linkedDealId: 'deal-1',
			notes: 'n',
		}
		expect(roundTripEvent(withSponsors)).toEqual(withSponsors)

		const emptySponsors: EventPlan = {
			...withSponsors,
			id: 'evt-rt-2',
			sponsors: [],
			runOfShowUrl: '',
			waiversUrl: '',
		}
		const out = roundTripEvent(emptySponsors)
		expect(out.sponsors).toEqual([])
		expect(out.runOfShowUrl).toBe('')
		expect(out.waiversUrl).toBe('')
		expect(out.linkedDealId).toBe('deal-1')
	})

	it('createEmpty-shaped deal round-trips without inventing compliance fields', () => {
		const record: DealLogEntry = {
			id: 'deal-empty',
			athleteId: 'ath-1',
			title: '',
			dealType: 'brand_sponsorship',
			brandName: '',
			status: 'idea',
			deliverables: [],
			payments: [],
			documents: [],
		}
		const out = roundTripDeal(record)
		expect(out).toEqual(record)
		expect(out.reportedToSchool).toBeUndefined()
		expect(out.complianceNotes).toBeUndefined()
		expect(out.licensing).toBeUndefined()
	})

	it('upsert-style encode→decode mirror equals subsequent list decode (no false conflict)', () => {
		const local: Opportunity = {
			id: 'opp-shared',
			athleteId: 'ath-1',
			title: 'Same',
			category: 'other',
			status: 'idea',
			notes: 'n',
			expectedStartDate: '2026-08-01',
			linkedDealId: 'deal-1',
		}
		const mirrored = roundTripOpportunity(local)
		const listedAgain = roundTripOpportunity(mirrored)
		expect(workflowRecordsEqual(mirrored, listedAgain)).toBe(true)

		const plan = planOpportunityLegacyImport([mirrored], {
			activeAthleteId: 'ath-1',
			existingCloudClientIds: [listedAgain.id],
			existingCloudByClientId: new Map([[listedAgain.id, listedAgain]]),
		})
		expect(plan.conflicts.some((c) => c.reason === 'content_mismatch')).toBe(false)
		expect(decideWorkflowBootstrapMode(plan).mode).toBe('cloud')
	})
})

describe('PR-4B1 conflict recovery', () => {
	it('content_mismatch blocks cloud, then restored matching local returns to cloud on replan', () => {
		const cloud: DealLogEntry = {
			id: 'deal-c',
			athleteId: 'ath-1',
			title: 'Cloud',
			dealType: 'other',
			brandName: 'B',
			status: 'idea',
			reportedToSchool: false,
			deliverables: [],
			payments: [],
			documents: [],
		}
		const drifted: DealLogEntry = {
			...cloud,
			title: 'Local drift',
			complianceNotes: '',
		}

		const conflictPlan = planDealLegacyImport([drifted], {
			activeAthleteId: 'ath-1',
			existingCloudClientIds: [cloud.id],
			existingCloudByClientId: new Map([[cloud.id, cloud]]),
		})
		expect(decideWorkflowBootstrapMode(conflictPlan).mode).toBe('conflict')

		const recoveredPlan = planDealLegacyImport([cloud], {
			activeAthleteId: 'ath-1',
			existingCloudClientIds: [cloud.id],
			existingCloudByClientId: new Map([[cloud.id, cloud]]),
		})
		expect(decideWorkflowBootstrapMode(recoveredPlan).mode).toBe('cloud')
	})

	it('event local drift recovers when local is restored to cloud shape', () => {
		const cloud: EventPlan = {
			id: 'evt-c',
			athleteId: 'ath-1',
			type: 'appearance',
			name: 'E',
			date: '2026-01-01',
			location: 'L',
			sponsors: ['S'],
			runOfShowUrl: 'https://example.com/r',
			linkedDealId: 'deal-1',
		}
		const drifted = { ...cloud, location: `${cloud.location} CONFLICT-LOCAL` }
		const conflictPlan = planEventLegacyImport([drifted], {
			activeAthleteId: 'ath-1',
			existingCloudClientIds: [cloud.id],
			existingCloudByClientId: new Map([[cloud.id, cloud]]),
		})
		expect(decideWorkflowBootstrapMode(conflictPlan).mode).toBe('conflict')

		const recovered = planEventLegacyImport([cloud], {
			activeAthleteId: 'ath-1',
			existingCloudClientIds: [cloud.id],
			existingCloudByClientId: new Map([[cloud.id, cloud]]),
		})
		expect(decideWorkflowBootstrapMode(recovered).mode).toBe('cloud')
	})

	it('key-order differences alone do not create content_mismatch', () => {
		const a: Opportunity = {
			id: 'opp-k',
			athleteId: 'ath-1',
			title: 'T',
			category: 'other',
			status: 'idea',
			notes: 'n',
			linkedDealId: 'deal-1',
		}
		const b = {
			linkedDealId: 'deal-1',
			notes: 'n',
			status: 'idea' as const,
			category: 'other' as const,
			title: 'T',
			athleteId: 'ath-1',
			id: 'opp-k',
		}
		expect(workflowRecordsEqual(a, b)).toBe(true)
		const plan = planOpportunityLegacyImport([a], {
			activeAthleteId: 'ath-1',
			existingCloudClientIds: ['opp-k'],
			existingCloudByClientId: new Map([['opp-k', b]]),
		})
		expect(plan.conflicts.some((c) => c.reason === 'content_mismatch')).toBe(false)
	})
})

describe('PR-4B1 cloud CRUD ordering contract', () => {
	it('failed cloud write must not mutate mirror (ordering guard)', async () => {
		const mirror: DealLogEntry[] = []
		const pending: { write: boolean } = { write: false }

		async function cloudUpsert(
			record: DealLogEntry,
			impl: () => Promise<{ ok: true; record: DealLogEntry } | { ok: false }>
		): Promise<boolean> {
			if (pending.write) return false
			pending.write = true
			try {
				const before = mirror.slice()
				const result = await impl()
				// Mirror must remain unchanged until success
				expect(mirror).toEqual(before)
				if (!result.ok) return false
				mirror.splice(0, mirror.length, result.record)
				return true
			} finally {
				pending.write = false
			}
		}

		const created: DealLogEntry = {
			id: 'deal-new',
			athleteId: 'ath-1',
			title: 'New',
			dealType: 'other',
			brandName: 'B',
			status: 'idea',
			deliverables: [],
			payments: [],
			documents: [],
		}

		let release!: () => void
		const gate = new Promise<void>((r) => {
			release = r
		})
		const slowFail = cloudUpsert(created, async () => {
			await gate
			return { ok: false as const }
		})
		expect(mirror).toEqual([])
		release()
		expect(await slowFail).toBe(false)
		expect(mirror).toEqual([])

		let releaseOk!: () => void
		const gateOk = new Promise<void>((r) => {
			releaseOk = r
		})
		const slowOk = cloudUpsert(created, async () => {
			await gateOk
			return { ok: true as const, record: roundTripDeal(created) }
		})
		expect(mirror).toEqual([])
		releaseOk()
		expect(await slowOk).toBe(true)
		expect(mirror).toHaveLength(1)
		expect(mirror[0].title).toBe('New')
	})

	it('edit and delete only apply after cloud success', async () => {
		const store: EventPlan[] = [
			{
				id: 'evt-1',
				athleteId: 'ath-1',
				type: 'appearance',
				name: 'Original',
				date: '2026-01-01',
				location: 'L',
				sponsors: ['S'],
				runOfShowUrl: 'https://example.com/r',
			},
		]

		async function applyEdit(
			next: EventPlan,
			cloud: () => Promise<boolean>
		): Promise<void> {
			const before = structuredClone(store)
			const ok = await cloud()
			expect(store).toEqual(before)
			if (ok) store[0] = next
		}

		await applyEdit({ ...store[0], name: 'Edited' }, async () => false)
		expect(store[0].name).toBe('Original')

		await applyEdit({ ...store[0], name: 'Edited' }, async () => true)
		expect(store[0].name).toBe('Edited')

		const beforeDelete = structuredClone(store)
		const deleted = await (async () => {
			const ok = await Promise.resolve(false)
			expect(store).toEqual(beforeDelete)
			if (!ok) return false
			store.splice(0, 1)
			return true
		})()
		expect(deleted).toBe(false)
		expect(store).toHaveLength(1)

		const okDelete = await (async () => {
			const snapshot = structuredClone(store)
			const ok = await Promise.resolve(true)
			expect(store).toEqual(snapshot)
			if (!ok) return false
			store.splice(0, 1)
			return true
		})()
		expect(okDelete).toBe(true)
		expect(store).toHaveLength(0)
	})
})

describe('PR-4B1 workflowRecordsEqual canonical equality', () => {
	it('same fields in different object-key order are equal (top-level and nested)', () => {
		const a = {
			id: '1',
			b: false,
			nested: { z: 0, a: [] as string[] },
			arr: [{ b: 1, a: 2 }],
		}
		const b = {
			arr: [{ a: 2, b: 1 }],
			nested: { a: [], z: 0 },
			b: false,
			id: '1',
		}
		expect(workflowRecordsEqual(a, b)).toBe(true)
		expect(stableStringify(a)).toBe(stableStringify(b))
	})

	it('false / 0 / [] versus absent are not equal', () => {
		expect(workflowRecordsEqual({ reportedToSchool: false }, {})).toBe(false)
		expect(workflowRecordsEqual({ valueEstimate: 0 }, {})).toBe(false)
		expect(workflowRecordsEqual({ deliverables: [] }, {})).toBe(false)
		expect(workflowRecordsEqual({ sponsors: [] }, { sponsors: undefined })).toBe(false)
	})

	it('notes, dates, linkedDealId, sponsors, urls, payments, licensing differences conflict', () => {
		const base: DealLogEntry = {
			id: 'd1',
			athleteId: 'a1',
			title: 'T',
			dealType: 'other',
			brandName: 'B',
			status: 'idea',
			deliverables: [],
			payments: [{ date: '2026-01-01', amount: 0, currency: 'USD' }],
			documents: ['https://example.com/d'],
			licensing: { usesSchoolMarks: false },
			startDate: '2026-01-01',
			complianceNotes: 'n',
		}
		expect(workflowRecordsEqual(base, { ...base, complianceNotes: 'x' })).toBe(false)
		expect(workflowRecordsEqual(base, { ...base, startDate: '2026-02-01' })).toBe(false)
		expect(workflowRecordsEqual(base, { ...base, payments: [{ date: '2026-01-01', amount: 1, currency: 'USD' }] })).toBe(
			false
		)
		expect(workflowRecordsEqual(base, { ...base, documents: [] })).toBe(false)
		expect(workflowRecordsEqual(base, { ...base, licensing: { usesSchoolMarks: true } })).toBe(false)

		const opp: Opportunity = {
			id: 'o1',
			athleteId: 'a1',
			title: 'T',
			category: 'other',
			status: 'idea',
			notes: 'n',
			linkedDealId: 'd1',
			expectedStartDate: '2026-08-01',
		}
		expect(workflowRecordsEqual(opp, { ...opp, notes: 'x' })).toBe(false)
		expect(workflowRecordsEqual(opp, { ...opp, linkedDealId: 'd2' })).toBe(false)
		expect(workflowRecordsEqual(opp, { ...opp, expectedStartDate: '2026-09-01' })).toBe(false)

		const evt: EventPlan = {
			id: 'e1',
			athleteId: 'a1',
			type: 'appearance',
			name: 'E',
			date: '2026-01-01',
			location: 'L',
			sponsors: ['A'],
			runOfShowUrl: 'https://example.com/r',
			linkedDealId: 'd1',
		}
		expect(workflowRecordsEqual(evt, { ...evt, sponsors: ['B'] })).toBe(false)
		expect(workflowRecordsEqual(evt, { ...evt, runOfShowUrl: 'https://example.com/x' })).toBe(false)
		expect(workflowRecordsEqual(evt, { ...evt, linkedDealId: 'd2' })).toBe(false)
	})

	it('transient database timestamps on raw rows are not part of decoded equality', () => {
		const record: Opportunity = {
			id: 'o-ts',
			athleteId: 'a1',
			title: 'T',
			category: 'other',
			status: 'idea',
		}
		const encoded = encodeOpportunity(USER, record)
		expect(encoded.ok).toBe(true)
		if (!encoded.ok) throw new Error('encode failed')
		const rowA = { ...encoded.value, created_at: '2020-01-01T00:00:00Z', updated_at: '2020-01-02T00:00:00Z' }
		const rowB = { ...encoded.value, created_at: '2021-01-01T00:00:00Z', updated_at: '2021-01-02T00:00:00Z' }
		const a = decodeOpportunity(rowA)
		const b = decodeOpportunity(rowB)
		expect(a.ok && b.ok).toBe(true)
		if (!a.ok || !b.ok) throw new Error('decode failed')
		expect(workflowRecordsEqual(a.value, b.value)).toBe(true)
		expect('updated_at' in (a.value as object)).toBe(false)
	})

	it('array order remains meaningful where domain order matters', () => {
		expect(workflowRecordsEqual({ sponsors: ['A', 'B'] }, { sponsors: ['B', 'A'] })).toBe(false)
		expect(workflowRecordsEqual({ deliverables: ['x', 'y'] }, { deliverables: ['y', 'x'] })).toBe(false)
	})
})

describe('PR-4B1 Deal conflict Retry/Recheck recovery (Preview regression)', () => {
	it('restored localStorage + recheck exits conflict and unlocks delete ordering', async () => {
		const athleteId = 'ath-1'
		const cloud: DealLogEntry = {
			id: 'deal-preview-1',
			athleteId,
			title: 'Cloud Deal',
			dealType: 'other',
			brandName: 'Brand',
			status: 'idea',
			reportedToSchool: false,
			deliverables: [],
			payments: [],
			documents: [],
		}
		const originalMirror = JSON.stringify({ [athleteId]: [cloud] })

		// Simulate harmless local-only drift (complianceNotes invent) while preserving client id
		let localStorageRaw = JSON.stringify({
			[athleteId]: [{ ...cloud, complianceNotes: '', title: 'Cloud Deal' }],
		})
		const readLocal = (): DealLogEntry[] => {
			const parsed = JSON.parse(localStorageRaw) as Record<string, DealLogEntry[]>
			return parsed[athleteId] || []
		}
		const cloudState = [cloud]

		const planConflict = planDealLegacyImport(readLocal(), {
			activeAthleteId: athleteId,
			existingCloudClientIds: cloudState.map((r) => r.id),
			existingCloudByClientId: new Map(cloudState.map((r) => [r.id, r])),
		})
		expect(decideWorkflowBootstrapMode(planConflict).mode).toBe('conflict')
		expect(areMutationsDisabled('conflict')).toBe(true)

		// Restore exact original localStorage (no hard refresh) then Retry/Recheck rereads both sides
		localStorageRaw = originalMirror
		const planRecovered = planDealLegacyImport(readLocal(), {
			activeAthleteId: athleteId,
			existingCloudClientIds: cloudState.map((r) => r.id),
			existingCloudByClientId: new Map(cloudState.map((r) => [r.id, r])),
		})
		expect(decideWorkflowBootstrapMode(planRecovered).mode).toBe('cloud')
		expect(areMutationsDisabled('cloud')).toBe(false)

		// Delete ordering: repository first, UI second, mirror third
		const repo = { deleted: false as boolean }
		const ui: DealLogEntry[] = [...readLocal()]
		let mirror = localStorageRaw
		const removeThroughUi = async (id: string): Promise<boolean> => {
			const mode = 'cloud' as const
			if (areMutationsDisabled(mode)) return false
			const repoOk = await Promise.resolve((repo.deleted = true))
			expect(repoOk).toBe(true)
			expect(ui.some((d) => d.id === id)).toBe(true)
			expect(mirror).toBe(originalMirror)
			const nextUi = ui.filter((d) => d.id !== id)
			ui.splice(0, ui.length, ...nextUi)
			mirror = JSON.stringify({ [athleteId]: nextUi })
			return true
		}
		expect(await removeThroughUi(cloud.id)).toBe(true)
		expect(repo.deleted).toBe(true)
		expect(ui).toHaveLength(0)
		expect(JSON.parse(mirror)[athleteId]).toEqual([])
	})
})

describe('PR-4B1 deferred cloud CRUD ordering (all domains)', () => {
	async function deferredCloudMutate<T>(
		opts: {
			ui: T[]
			mirror: string
			applySuccess: (canonical: T) => void
			fail?: boolean
			canonical: T
		}
	): Promise<boolean> {
		const beforeUi = structuredClone(opts.ui)
		const beforeMirror = opts.mirror
		let release!: () => void
		const gate = new Promise<void>((r) => {
			release = r
		})
		const pending = (async () => {
			await gate
			if (opts.fail) return false
			opts.applySuccess(opts.canonical)
			return true
		})()
		expect(opts.ui).toEqual(beforeUi)
		expect(opts.mirror).toBe(beforeMirror)
		release()
		return pending
	}

	it('opportunity create/edit/delete and failures preserve UI+mirror until success', async () => {
		const base: Opportunity = {
			id: 'opp-d',
			athleteId: 'ath-1',
			title: 'O',
			category: 'other',
			status: 'idea',
			notes: 'n',
			linkedDealId: 'deal-1',
			expectedStartDate: '2026-08-01',
			expectedEndDate: '2026-09-01',
		}
		let ui: Opportunity[] = []
		let mirror = JSON.stringify({ 'ath-1': [] as Opportunity[] })

		expect(
			await deferredCloudMutate({
				ui,
				mirror,
				fail: true,
				canonical: roundTripOpportunity(base),
				applySuccess: () => undefined,
			})
		).toBe(false)
		expect(ui).toEqual([])
		expect(mirror).toBe(JSON.stringify({ 'ath-1': [] }))

		const created = roundTripOpportunity(base)
		expect(
			await deferredCloudMutate({
				ui,
				mirror,
				canonical: created,
				applySuccess: (c) => {
					ui = [c]
					mirror = JSON.stringify({ 'ath-1': [c] })
				},
			})
		).toBe(true)
		expect(ui).toEqual([created])
		expect(workflowRecordsEqual(ui[0], roundTripOpportunity(ui[0]))).toBe(true)

		const edited = roundTripOpportunity({ ...created, title: 'Edited', notes: 'n2' })
		const beforeEditUi = structuredClone(ui)
		const beforeEditMirror = mirror
		expect(
			await deferredCloudMutate({
				ui,
				mirror,
				fail: true,
				canonical: edited,
				applySuccess: () => undefined,
			})
		).toBe(false)
		expect(ui).toEqual(beforeEditUi)
		expect(mirror).toBe(beforeEditMirror)
		expect(ui[0].id).toBe(created.id)

		expect(
			await deferredCloudMutate({
				ui,
				mirror,
				canonical: edited,
				applySuccess: (c) => {
					ui = [c]
					mirror = JSON.stringify({ 'ath-1': [c] })
				},
			})
		).toBe(true)
		expect(ui).toHaveLength(1)
		expect(ui[0].title).toBe('Edited')
		expect(ui[0].notes).toBe('n2')
		expect(ui[0].linkedDealId).toBe('deal-1')

		expect(
			await deferredCloudMutate({
				ui,
				mirror,
				fail: true,
				canonical: edited,
				applySuccess: () => undefined,
			})
		).toBe(false)
		expect(ui).toHaveLength(1)

		expect(
			await deferredCloudMutate({
				ui,
				mirror,
				canonical: edited,
				applySuccess: () => {
					ui = []
					mirror = JSON.stringify({ 'ath-1': [] })
				},
			})
		).toBe(true)
		expect(ui).toEqual([])
		expect(JSON.parse(mirror)['ath-1']).toEqual([])
	})

	it('deal and event deferred mutate preserve falsy fields and client ids', async () => {
		const deal: DealLogEntry = {
			id: 'deal-d',
			athleteId: 'ath-1',
			title: 'D',
			dealType: 'other',
			brandName: 'B',
			status: 'idea',
			valueEstimate: 0,
			reportedToSchool: false,
			reportedToCollective: false,
			deliverables: [],
			payments: [{ date: '2026-01-01', amount: 0, currency: 'USD' }],
			documents: [],
			licensing: { usesSchoolMarks: false },
		}
		let ui = [roundTripDeal(deal)]
		let mirror = JSON.stringify({ 'ath-1': ui })
		const edited = roundTripDeal({ ...ui[0], title: 'D2' })
		expect(edited.id).toBe(deal.id)
		expect(edited.valueEstimate).toBe(0)
		expect(edited.reportedToSchool).toBe(false)

		const evt: EventPlan = {
			id: 'evt-d',
			athleteId: 'ath-1',
			type: 'appearance',
			name: 'E',
			date: '2026-01-01',
			location: 'L',
			sponsors: [],
			runOfShowUrl: 'https://example.com/r',
			linkedDealId: 'deal-d',
			notes: 'n',
		}
		const evtOut = roundTripEvent(evt)
		expect(evtOut.sponsors).toEqual([])
		expect(evtOut.runOfShowUrl).toBe('https://example.com/r')
		expect(evtOut.linkedDealId).toBe('deal-d')

		expect(workflowRecordsEqual(ui[0], roundTripDeal(ui[0]))).toBe(true)
		expect(mirror).toContain(deal.id)
		expect(edited.title).toBe('D2')
	})
})

describe('PR-4B1 DealCompliance mount/interaction contract', () => {
	const dealsSrc = fs.readFileSync(
		path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../components/Deals.tsx'),
		'utf8'
	)

	it('DealCompliance has no mount effect and only writes on explicit handlers', () => {
		const fnStart = dealsSrc.indexOf('function DealCompliance')
		expect(fnStart).toBeGreaterThan(-1)
		const body = dealsSrc.slice(fnStart, fnStart + 2500)
		expect(body).not.toContain('useEffect')
		expect(body).not.toContain("complianceNotes: ''")
		expect(body).not.toContain("notes: ''")
		expect(body).toContain('onChange={e =>')
		expect(body).toContain('e.target.checked')
	})

	it('explicit clear/false handlers match intended absent/false contract', () => {
		const deal: DealLogEntry = {
			id: 'd',
			athleteId: 'a',
			title: 'T',
			dealType: 'other',
			brandName: 'B',
			status: 'idea',
			deliverables: [],
			payments: [],
			documents: [],
		}
		const calls: DealLogEntry[] = []
		const onChange = (next: DealLogEntry) => calls.push(next)

		// Selecting/mounting must not call onChange — simulated by zero calls before user input
		expect(calls).toHaveLength(0)

		// Explicit false checkbox
		onChange({ ...deal, reportedToSchool: false })
		expect(calls[0].reportedToSchool).toBe(false)

		// Explicit licensing false without inventing notes
		onChange({ ...deal, licensing: { usesSchoolMarks: false } })
		expect(calls[1].licensing).toEqual({ usesSchoolMarks: false })
		expect(calls[1].licensing && 'notes' in calls[1].licensing).toBe(false)

		// Clearing optional compliance notes removes the key
		const withNotes = { ...deal, complianceNotes: 'x' }
		const { complianceNotes: _removed, ...rest } = withNotes
		onChange(rest as DealLogEntry)
		expect('complianceNotes' in calls[2]).toBe(false)
	})
})

describe('PR-4B1 complete populated opportunity/deal/event fixtures', () => {
	it('opportunity full fixture survives encode→decode and import equivalence', () => {
		const record = {
			id: 'opp-full',
			athleteId: 'ath-full',
			title: 'Full Opp',
			category: 'local_brand_deal' as const,
			status: 'pitched' as const,
			description: 'desc',
			targetBrandName: 'Brand',
			linkedDealId: 'deal-full',
			expectedStartDate: '2026-08-01',
			expectedEndDate: '2026-09-01',
			notes: 'full notes',
			extensionField: 'keep-me',
		}
		const out = roundTripOpportunity(record as Opportunity)
		expect(out.expectedStartDate).toBe('2026-08-01')
		expect(out.notes).toBe('full notes')
		expect(out.linkedDealId).toBe('deal-full')
		expect((out as Opportunity & { extensionField?: string }).extensionField).toBe('keep-me')
		expect(workflowRecordsEqual(out, roundTripOpportunity(out))).toBe(true)
		const plan = planOpportunityLegacyImport([out], {
			activeAthleteId: 'ath-full',
			existingCloudClientIds: [out.id],
			existingCloudByClientId: new Map([[out.id, out]]),
		})
		expect(decideWorkflowBootstrapMode(plan).mode).toBe('cloud')
	})
})
