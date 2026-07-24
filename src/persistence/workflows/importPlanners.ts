import type { DealLogEntry, EventPlan, Opportunity } from '../../types'
import { dealClientId, decodeDeal, encodeDeal } from './dealCodec'
import { decodeEvent, encodeEvent, eventClientId } from './eventCodec'
import { decodeOpportunity, encodeOpportunity, opportunityClientId } from './opportunityCodec'
import { isPlainObject } from './stableId'
import type { LegacyImportPlan } from './types'

export type LegacyImportPlannerOptions = {
	/** Active athlete profile ID for ownership checks. */
	activeAthleteId?: string | null
	/**
	 * Existing cloud client IDs. Cloud wins during initial import —
	 * matching client IDs are never planned for overwrite.
	 */
	existingCloudClientIds: Iterable<string>
	/**
	 * Optional cloud record payloads keyed by client_id.
	 * When provided, same-ID/different-content is classified as `content_mismatch`
	 * instead of clean `alreadyPresent`.
	 */
	existingCloudByClientId?: ReadonlyMap<string, unknown> | Record<string, unknown>
}

function cloudRecordFor(
	clientId: string,
	map: LegacyImportPlannerOptions['existingCloudByClientId']
): unknown | undefined {
	if (!map) return undefined
	if (map instanceof Map) return map.has(clientId) ? map.get(clientId) : undefined
	const recordMap = map as Record<string, unknown>
	if (Object.prototype.hasOwnProperty.call(recordMap, clientId)) return recordMap[clientId]
	return undefined
}

function planDomainImport<T extends { athleteId: string; id: string }>(
	localRecords: unknown[],
	options: LegacyImportPlannerOptions,
	helpers: {
		clientIdOf: (record: T) => string
		tryNormalize: (raw: unknown) => { ok: true; record: T } | { ok: false }
	}
): LegacyImportPlan<T> {
	const cloudIds = new Set(
		[...options.existingCloudClientIds].filter((id) => typeof id === 'string' && id.length > 0)
	)
	const activeAthleteId = options.activeAthleteId ?? null

	const recordsToInsert: T[] = []
	const alreadyPresent: T[] = []
	const rejectedRecords: LegacyImportPlan<T>['rejectedRecords'] = []
	const conflicts: LegacyImportPlan<T>['conflicts'] = []

	const seenLocalIds = new Map<string, number>()

	for (let index = 0; index < localRecords.length; index++) {
		const raw = localRecords[index]
		const normalized = helpers.tryNormalize(raw)
		if (!normalized.ok) {
			rejectedRecords.push({ index, reason: 'malformed' })
			continue
		}

		const record = normalized.record
		const clientId = helpers.clientIdOf(record)

		const priorIndex = seenLocalIds.get(clientId)
		if (priorIndex !== undefined) {
			rejectedRecords.push({ index, reason: 'duplicate_local' })
			conflicts.push({ clientId, reason: 'duplicate_local_content' })
			continue
		}
		seenLocalIds.set(clientId, index)

		if (activeAthleteId && record.athleteId && record.athleteId !== activeAthleteId) {
			rejectedRecords.push({ index, reason: 'athlete_mismatch' })
			conflicts.push({ clientId, reason: 'athlete_mismatch' })
			continue
		}

		if (cloudIds.has(clientId)) {
			const cloudRaw = cloudRecordFor(clientId, options.existingCloudByClientId)
			if (cloudRaw !== undefined) {
				const cloudNorm = helpers.tryNormalize(cloudRaw)
				if (
					cloudNorm.ok &&
					JSON.stringify(cloudNorm.record) !== JSON.stringify(record)
				) {
					conflicts.push({ clientId, reason: 'content_mismatch' })
					continue
				}
			}
			alreadyPresent.push(record)
			conflicts.push({ clientId, reason: 'cloud_exists' })
			continue
		}

		recordsToInsert.push(record)
	}

	return {
		recordsToInsert,
		alreadyPresent,
		rejectedRecords,
		conflicts,
		totalLocal: localRecords.length,
		totalCloud: cloudIds.size,
	}
}

function tryNormalizeOpportunity(raw: unknown): { ok: true; record: Opportunity } | { ok: false } {
	if (!isPlainObject(raw)) return { ok: false }
	const probe = { ...raw } as Opportunity
	if (typeof probe.athleteId !== 'string' || !probe.athleteId) return { ok: false }
	if (typeof probe.title !== 'string') return { ok: false }
	if (typeof probe.category !== 'string') return { ok: false }
	if (typeof probe.status !== 'string') return { ok: false }

	const encoded = encodeOpportunity('import-probe-user', {
		...probe,
		id: opportunityClientId(probe),
	} as Opportunity)
	if (!encoded.ok) return { ok: false }
	const decoded = decodeOpportunity(encoded.value)
	if (!decoded.ok) return { ok: false }
	return { ok: true, record: decoded.value }
}

function tryNormalizeDeal(raw: unknown): { ok: true; record: DealLogEntry } | { ok: false } {
	if (!isPlainObject(raw)) return { ok: false }
	const probe = { ...raw } as DealLogEntry
	if (typeof probe.athleteId !== 'string' || !probe.athleteId) return { ok: false }
	if (typeof probe.title !== 'string') return { ok: false }
	if (typeof probe.dealType !== 'string') return { ok: false }
	if (typeof probe.brandName !== 'string') return { ok: false }
	if (typeof probe.status !== 'string') return { ok: false }

	const encoded = encodeDeal('import-probe-user', {
		...probe,
		id: dealClientId(probe),
	} as DealLogEntry)
	if (!encoded.ok) return { ok: false }
	const decoded = decodeDeal(encoded.value)
	if (!decoded.ok) return { ok: false }
	return { ok: true, record: decoded.value }
}

function tryNormalizeEvent(raw: unknown): { ok: true; record: EventPlan } | { ok: false } {
	if (!isPlainObject(raw)) return { ok: false }
	const probe = { ...raw } as EventPlan
	if (typeof probe.athleteId !== 'string' || !probe.athleteId) return { ok: false }
	if (typeof probe.type !== 'string') return { ok: false }
	if (typeof probe.name !== 'string') return { ok: false }
	if (typeof probe.date !== 'string') return { ok: false }
	if (typeof probe.location !== 'string') return { ok: false }

	const encoded = encodeEvent('import-probe-user', {
		...probe,
		id: eventClientId(probe),
	} as EventPlan)
	if (!encoded.ok) return { ok: false }
	const decoded = decodeEvent(encoded.value)
	if (!decoded.ok) return { ok: false }
	return { ok: true, record: decoded.value }
}

/**
 * Pure import planner for `opps.store` local records.
 * Does not write to Supabase. Does not mutate local records or rename keys.
 *
 * Athlete ownership: Opportunity includes athleteId. Mismatches vs activeAthleteId
 * are classified as conflicts (not auto-assigned to the signed-in user).
 */
export function planOpportunityLegacyImport(
	localRecords: unknown[],
	options: LegacyImportPlannerOptions
): LegacyImportPlan<Opportunity> {
	return planDomainImport(localRecords, options, {
		clientIdOf: opportunityClientId,
		tryNormalize: tryNormalizeOpportunity,
	})
}

/**
 * Pure import planner for `deals.store` local records.
 * DealLogEntry includes athleteId — mismatches require review.
 */
export function planDealLegacyImport(
	localRecords: unknown[],
	options: LegacyImportPlannerOptions
): LegacyImportPlan<DealLogEntry> {
	return planDomainImport(localRecords, options, {
		clientIdOf: dealClientId,
		tryNormalize: tryNormalizeDeal,
	})
}

/**
 * Pure import planner for `events.store` local records.
 * EventPlan includes athleteId — mismatches require review.
 */
export function planEventLegacyImport(
	localRecords: unknown[],
	options: LegacyImportPlannerOptions
): LegacyImportPlan<EventPlan> {
	return planDomainImport(localRecords, options, {
		clientIdOf: eventClientId,
		tryNormalize: tryNormalizeEvent,
	})
}

/**
 * Flatten athlete-keyed store (`Record<athleteId, T[]>`) into a single list
 * without mutating the store. Does not write or rename localStorage keys.
 */
export function flattenAthleteKeyedStore<T>(store: unknown): T[] {
	if (!isPlainObject(store)) return []
	const out: T[] = []
	for (const value of Object.values(store)) {
		if (!Array.isArray(value)) continue
		for (const item of value) out.push(item as T)
	}
	return out
}
