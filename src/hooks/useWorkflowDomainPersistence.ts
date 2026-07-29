import { useCallback, useEffect, useRef, useState } from 'react'
import {
	getWorkflowCloudPersistenceMode,
	isWorkflowCloudPersistenceEnabled,
} from '../config/workflowCloudPersistence'
import { useAuth } from '../context/AuthContext'
import { load, save } from '../utils/storage'
import type { LegacyImportPlannerOptions } from '../persistence/workflows/importPlanners'
import type {
	LegacyImportPlan,
	RepoInsertMissingResult,
	RepoListResult,
	RepoUpsertResult,
	RepoWriteResult,
} from '../persistence/workflows/types'
import {
	isCloudEligibleAthleteId,
	toActiveAthleteId,
	toLocalAthleteStorageKey,
	type ActiveAthleteId,
} from '../persistence/workflows/athleteIdentity'
import { evaluateWorkflowCloudEligibility } from '../persistence/workflows/cloudEligibility'
import {
	areMutationsDisabled,
	decideWorkflowBootstrapMode,
	isCloudWriteMode,
	type WorkflowPersistenceMode,
} from '../persistence/workflows/persistenceMode'

export type AthleteKeyedStore<T> = Record<string, T[]>

export type WorkflowDomainAdapters<T extends { id: string; athleteId: string }> = {
	storageKey: 'opps.store' | 'deals.store' | 'events.store'
	listForUser: (userId: string) => Promise<RepoListResult<T>>
	upsertForUser: (userId: string, record: T) => Promise<RepoUpsertResult<T>>
	deleteForUser: (userId: string, clientId: string) => Promise<RepoWriteResult>
	insertMissing: (userId: string, records: T[]) => Promise<RepoInsertMissingResult>
	planImport: (localRecords: unknown[], options: LegacyImportPlannerOptions) => LegacyImportPlan<T>
}

export type UseWorkflowDomainPersistenceResult<T extends { id: string; athleteId: string }> = {
	mode: WorkflowPersistenceMode
	store: AthleteKeyedStore<T>
	/** Legacy localStorage partition for the active athlete (may be "anonymous" when none selected). */
	localAthleteKey: string
	importPlan: LegacyImportPlan<T> | null
	busy: boolean
	error: string | null
	mutationsDisabled: boolean
	pendingWrite: boolean
	upsert: (record: T) => Promise<boolean>
	remove: (id: string) => Promise<boolean>
	confirmImport: () => Promise<void>
	keepUsingDevice: () => void
	retryBootstrap: () => void
	cloudEnabled: boolean
}

function recordsToAthleteStore<T extends { id: string; athleteId: string }>(
	records: T[]
): AthleteKeyedStore<T> {
	const next: AthleteKeyedStore<T> = {}
	for (const record of records) {
		// Partitioning only — never treat "anonymous" as cloud ownership input.
		const key = toLocalAthleteStorageKey(toActiveAthleteId(record.athleteId))
		if (!next[key]) next[key] = []
		next[key].push(record)
	}
	return next
}

function mergeAthleteSlice<T extends { id: string }>(
	prev: AthleteKeyedStore<T>,
	athleteKey: string,
	records: T[]
): AthleteKeyedStore<T> {
	return { ...prev, [athleteKey]: records }
}

function applyCloudMirror<T extends { id: string; athleteId: string }>(
	prev: AthleteKeyedStore<T>,
	cloudRecords: T[],
	storageKey: WorkflowDomainAdapters<T>['storageKey']
): AthleteKeyedStore<T> {
	const cloudStore = recordsToAthleteStore(cloudRecords)
	const merged: AthleteKeyedStore<T> = { ...prev }
	for (const [key, list] of Object.entries(cloudStore)) {
		merged[key] = list
	}
	save(storageKey, merged)
	return merged
}

function resolveLocalSliceKey(
	recordAthleteId: string | undefined,
	activeAthleteId: ActiveAthleteId
): string {
	return toLocalAthleteStorageKey(toActiveAthleteId(recordAthleteId) ?? activeAthleteId)
}

/**
 * Dual-path persistence for one workflow domain.
 * Flag off → identical localStorage behavior (no repository queries).
 * Cloud path requires a real ActiveAthleteId — never the fabricated "anonymous" sentinel.
 */
export function useWorkflowDomainPersistence<T extends { id: string; athleteId: string }>(
	activeAthleteId: ActiveAthleteId,
	adapters: WorkflowDomainAdapters<T>
): UseWorkflowDomainPersistenceResult<T> {
	const { user, initializing } = useAuth()
	const userId = user?.id ?? null
	const localAthleteKey = toLocalAthleteStorageKey(activeAthleteId)

	const eligibility = evaluateWorkflowCloudEligibility({
		masterEnabled: isWorkflowCloudPersistenceEnabled(),
		mode: getWorkflowCloudPersistenceMode(),
		authenticated: Boolean(userId),
		athleteId: activeAthleteId,
		workflowCloudPersistenceCanary: user?.workflowCloudPersistenceCanary === true,
	})
	/** True only when master + mode + auth + athlete + (canary claim when needed) all pass. */
	const cloudEnabled = eligibility.enabled

	/** Session-only deferral — not persisted. Import prompt may return next session. */
	const [sessionStayLocal, setSessionStayLocal] = useState(false)

	const canAttemptCloud =
		cloudEnabled &&
		!sessionStayLocal &&
		Boolean(userId) &&
		isCloudEligibleAthleteId(activeAthleteId)

	const [store, setStore] = useState<AthleteKeyedStore<T>>(() =>
		load<AthleteKeyedStore<T>>(adapters.storageKey, {})
	)
	const [mode, setMode] = useState<WorkflowPersistenceMode>('local')
	const [importPlan, setImportPlan] = useState<LegacyImportPlan<T> | null>(null)
	const [busy, setBusy] = useState(false)
	const [pendingWrite, setPendingWrite] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [bootstrapNonce, setBootstrapNonce] = useState(0)
	const cancelledRef = useRef(false)

	const runBootstrap = useCallback(async () => {
		if (!userId || !canAttemptCloud || !isCloudEligibleAthleteId(activeAthleteId)) return

		setMode('checking')
		setError(null)
		setBusy(true)
		setImportPlan(null)

		try {
			const localStore = load<AthleteKeyedStore<T>>(adapters.storageKey, {})
			if (cancelledRef.current) return
			setStore(localStore)

			const listed = await adapters.listForUser(userId)
			if (cancelledRef.current) return

			if (!listed.ok) {
				setMode('unavailable')
				setImportPlan(null)
				setError(null)
				setBusy(false)
				return
			}

			const localForAthlete = Array.isArray(localStore[activeAthleteId])
				? (localStore[activeAthleteId] as T[])
				: []
			const cloudForAthlete = listed.records.filter((r) => r.athleteId === activeAthleteId)
			const plan = adapters.planImport(localForAthlete, {
				activeAthleteId,
				existingCloudClientIds: cloudForAthlete.map((r) => r.id),
				existingCloudByClientId: new Map(cloudForAthlete.map((r) => [r.id, r])),
			})

			if (cancelledRef.current) return
			setImportPlan(plan)

			const decision = decideWorkflowBootstrapMode(plan, {
				cloudRejectedCount: listed.rejectedCount,
			})

			if (decision.mode === 'conflict') {
				// Keep local visible working copy; do not replace with cloud.
				setMode('conflict')
				setBusy(false)
				return
			}

			if (decision.mode === 'import_required') {
				setMode('import_required')
				setBusy(false)
				return
			}

			// Cloud path: only mirror when every listed row decoded.
			if (listed.rejectedCount > 0) {
				setMode('conflict')
				setBusy(false)
				return
			}

			setStore((prev) => applyCloudMirror(prev, listed.records, adapters.storageKey))
			setMode('cloud')
			setImportPlan(null)
			setBusy(false)
		} catch {
			if (cancelledRef.current) return
			setMode('unavailable')
			setImportPlan(null)
			setError(null)
			setBusy(false)
		}
	}, [activeAthleteId, adapters, canAttemptCloud, userId])

	useEffect(() => {
		cancelledRef.current = false

		if (!cloudEnabled || sessionStayLocal || !isCloudEligibleAthleteId(activeAthleteId)) {
			setMode('local')
			setImportPlan(null)
			setError(null)
			setBusy(false)
			setStore(load<AthleteKeyedStore<T>>(adapters.storageKey, {}))
			return () => {
				cancelledRef.current = true
			}
		}

		if (initializing) {
			setMode('checking')
			setBusy(true)
			return () => {
				cancelledRef.current = true
			}
		}

		if (!userId) {
			setMode('local')
			setImportPlan(null)
			setError(null)
			setBusy(false)
			setStore(load<AthleteKeyedStore<T>>(adapters.storageKey, {}))
			return () => {
				cancelledRef.current = true
			}
		}

		void runBootstrap()

		return () => {
			cancelledRef.current = true
		}
	}, [
		activeAthleteId,
		adapters.storageKey,
		bootstrapNonce,
		cloudEnabled,
		initializing,
		runBootstrap,
		sessionStayLocal,
		userId,
	])

	const confirmImport = useCallback(async () => {
		if (!userId || mode !== 'import_required' || !isCloudEligibleAthleteId(activeAthleteId)) return
		setBusy(true)
		setError(null)
		try {
			const localStore = load<AthleteKeyedStore<T>>(adapters.storageKey, {})
			const localForAthlete = Array.isArray(localStore[activeAthleteId])
				? (localStore[activeAthleteId] as T[])
				: []

			const listed = await adapters.listForUser(userId)
			if (!listed.ok) {
				setMode('unavailable')
				return
			}

			const cloudForAthlete = listed.records.filter((r) => r.athleteId === activeAthleteId)
			const plan = adapters.planImport(localForAthlete, {
				activeAthleteId,
				existingCloudClientIds: cloudForAthlete.map((r) => r.id),
				existingCloudByClientId: new Map(cloudForAthlete.map((r) => [r.id, r])),
			})
			setImportPlan(plan)

			const decision = decideWorkflowBootstrapMode(plan, {
				cloudRejectedCount: listed.rejectedCount,
			})
			if (decision.mode !== 'import_required') {
				setMode(decision.mode)
				if (decision.mode === 'cloud' && listed.rejectedCount === 0) {
					setStore((prev) => applyCloudMirror(prev, listed.records, adapters.storageKey))
					setImportPlan(null)
				}
				return
			}

			const insertIds = new Set(plan.recordsToInsert.map((r) => r.id))
			const result = await adapters.insertMissing(userId, plan.recordsToInsert)
			if (!result.ok) {
				setMode('unavailable')
				return
			}

			const verified = await adapters.listForUser(userId)
			if (!verified.ok) {
				setMode('unavailable')
				return
			}
			if (verified.rejectedCount > 0) {
				setMode('conflict')
				setImportPlan(plan)
				return
			}

			const verifiedIds = new Set(verified.records.map((r) => r.id))
			for (const id of insertIds) {
				if (!verifiedIds.has(id)) {
					setMode('unavailable')
					return
				}
			}

			setStore((prev) => applyCloudMirror(prev, verified.records, adapters.storageKey))
			setMode('cloud')
			setImportPlan(null)
		} finally {
			setBusy(false)
		}
	}, [activeAthleteId, adapters, mode, userId])

	const keepUsingDevice = useCallback(() => {
		setSessionStayLocal(true)
		setMode('local')
		setImportPlan(null)
		setError(null)
		setBusy(false)
		setStore(load<AthleteKeyedStore<T>>(adapters.storageKey, {}))
	}, [adapters.storageKey])

	const upsert = useCallback(
		async (record: T): Promise<boolean> => {
			if (areMutationsDisabled(mode)) return false
			const key = resolveLocalSliceKey(record.athleteId, activeAthleteId)

			if (isCloudWriteMode(mode)) {
				if (!userId || pendingWrite) return false
				if (!isCloudEligibleAthleteId(toActiveAthleteId(record.athleteId))) {
					setError('Could not save to secure storage. Your previous records were left unchanged.')
					return false
				}
				setPendingWrite(true)
				try {
					const result = await adapters.upsertForUser(userId, record)
					if (!result.ok) {
						setError('Could not save to secure storage. Your previous records were left unchanged.')
						return false
					}
					// Mirror the canonical encode→decode record so local equals future list/decode.
					const mirrored = result.record
					setStore((prev) => {
						const list = prev[key] || []
						const idx = list.findIndex((r) => r.id === mirrored.id)
						const updated =
							idx === -1 ? [mirrored, ...list] : list.map((r) => (r.id === mirrored.id ? mirrored : r))
						const next = mergeAthleteSlice(prev, key, updated)
						save(adapters.storageKey, next)
						return next
					})
					setError(null)
					return true
				} finally {
					setPendingWrite(false)
				}
			}

			// Pure local mode — may partition under legacy "anonymous" key.
			setStore((prev) => {
				const list = prev[key] || []
				const idx = list.findIndex((r) => r.id === record.id)
				const updated = idx === -1 ? [record, ...list] : list.map((r) => (r.id === record.id ? record : r))
				const next = mergeAthleteSlice(prev, key, updated)
				save(adapters.storageKey, next)
				return next
			})
			return true
		},
		[activeAthleteId, adapters, mode, pendingWrite, userId]
	)

	const remove = useCallback(
		async (id: string): Promise<boolean> => {
			if (areMutationsDisabled(mode)) return false
			const key = localAthleteKey

			if (isCloudWriteMode(mode)) {
				if (!userId || pendingWrite) return false
				if (!isCloudEligibleAthleteId(activeAthleteId)) return false
				setPendingWrite(true)
				try {
					const result = await adapters.deleteForUser(userId, id)
					if (!result.ok) {
						setError('Could not delete from secure storage. Your previous records were left unchanged.')
						return false
					}
					setStore((prev) => {
						const list = prev[key] || []
						const next = mergeAthleteSlice(
							prev,
							key,
							list.filter((r) => r.id !== id)
						)
						save(adapters.storageKey, next)
						return next
					})
					setError(null)
					return true
				} finally {
					setPendingWrite(false)
				}
			}

			setStore((prev) => {
				const list = prev[key] || []
				const next = mergeAthleteSlice(
					prev,
					key,
					list.filter((r) => r.id !== id)
				)
				save(adapters.storageKey, next)
				return next
			})
			return true
		},
		[activeAthleteId, adapters, localAthleteKey, mode, pendingWrite, userId]
	)

	const retryBootstrap = useCallback(() => {
		setSessionStayLocal(false)
		setBootstrapNonce((n) => n + 1)
	}, [])

	const mutationsDisabled = areMutationsDisabled(mode) || pendingWrite || busy

	return {
		mode,
		store,
		localAthleteKey,
		importPlan,
		busy: busy || (canAttemptCloud && initializing),
		error,
		mutationsDisabled,
		pendingWrite,
		upsert,
		remove,
		confirmImport,
		keepUsingDevice,
		retryBootstrap,
		cloudEnabled,
	}
}
