import { useState } from 'react'
import Button from '../ui/Button'
import type { LegacyImportPlan } from '../../persistence/workflows/types'
import type { WorkflowPersistenceMode } from '../../persistence/workflows/persistenceMode'

type Props = {
	domainLabel: string
	mode: WorkflowPersistenceMode
	plan: LegacyImportPlan<unknown> | null
	busy: boolean
	error: string | null
	onConfirmImport: () => void
	onKeepUsingDevice: () => void
	onRetry: () => void
}

/**
 * Status/import gate for cloud workflow bootstrap.
 * Never deletes localStorage. Never offers force-overwrite / use-cloud resolution.
 */
export default function WorkflowImportGate({
	domainLabel,
	mode,
	plan,
	busy,
	error,
	onConfirmImport,
	onKeepUsingDevice,
	onRetry,
}: Props) {
	const [awaitingImportConfirm, setAwaitingImportConfirm] = useState(false)

	if (mode === 'local') return null

	const insertCount = plan?.recordsToInsert.length ?? 0
	const conflictCount =
		plan?.conflicts.filter(
			(c) =>
				c.reason === 'content_mismatch' ||
				c.reason === 'athlete_mismatch' ||
				c.reason === 'duplicate_local_content'
		).length ?? 0
	const rejectedCount = plan?.rejectedRecords.length ?? 0
	const alreadyCount = plan?.alreadyPresent.length ?? 0

	if (mode === 'checking') {
		return (
			<div
				className="mb-3 rounded-md border border-border bg-mid/40 px-3 py-2 text-sm text-gray-300"
				role="status"
				aria-live="polite"
			>
				Checking secure storage…
			</div>
		)
	}

	if (mode === 'cloud') {
		return (
			<div className="mb-3 space-y-2">
				<div
					className="rounded-md border border-border bg-mid/30 px-3 py-1.5 text-xs text-gray-400"
					role="status"
					aria-live="polite"
				>
					Saved to NIL Roster
				</div>
				{error && (
					<div className="rounded-md border border-border bg-mid/40 px-3 py-2 text-sm text-amber-200" role="alert">
						{error}
					</div>
				)}
			</div>
		)
	}

	if (mode === 'unavailable') {
		return (
			<div className="mb-3 rounded-md border border-border bg-mid/40 px-3 py-2 text-sm text-amber-200 space-y-2">
				<div role="alert">Cloud saving is temporarily unavailable</div>
				<p className="text-gray-300 text-sm">
					Your on-device copy is shown and was not changed. Create, edit, and delete stay paused until
					secure storage is reachable again.
				</p>
				<Button variant="ghost" className="text-xs" onClick={onRetry} disabled={busy} aria-busy={busy}>
					{busy ? 'Retrying…' : 'Retry'}
				</Button>
			</div>
		)
	}

	if (mode === 'conflict') {
		return (
			<div className="mb-4 rounded-md border border-border bg-mid/50 p-3 space-y-3">
				<div className="text-white font-semibold text-sm" role="status">
					Records need review
				</div>
				<p className="text-sm text-gray-300">
					Local and secure storage do not match safely. Nothing was merged or overwritten. Create,
					edit, and delete stay paused.
				</p>
				<ul className="text-sm text-gray-300 list-disc pl-5 space-y-1">
					<li>Conflicts: {conflictCount}</li>
					<li>Rejected local rows: {rejectedCount}</li>
					<li>Already present in secure storage: {alreadyCount}</li>
				</ul>
				<Button variant="ghost" onClick={onRetry} disabled={busy} aria-busy={busy}>
					{busy ? 'Rechecking…' : 'Retry / Recheck'}
				</Button>
			</div>
		)
	}

	if (mode === 'import_required') {
		return (
			<div className="mb-4 rounded-md border border-border bg-mid/50 p-3 space-y-3">
				<div className="text-white font-semibold text-sm" role="status">
					Save your existing records to NIL Roster
				</div>
				<p className="text-sm text-gray-300">
					Your browser keeps a local copy either way. Import only adds missing records and never
					overwrites secure storage.
				</p>
				<ul className="text-sm text-gray-300 list-disc pl-5 space-y-1">
					<li>Ready to import: {insertCount}</li>
					<li>Already saved securely: {alreadyCount}</li>
				</ul>
				{!awaitingImportConfirm ? (
					<div className="flex flex-wrap gap-2">
						<Button
							onClick={() => setAwaitingImportConfirm(true)}
							disabled={busy || insertCount === 0}
						>
							Import records
						</Button>
						<Button variant="ghost" onClick={onKeepUsingDevice} disabled={busy}>
							Keep using this device for now
						</Button>
					</div>
				) : (
					<div className="space-y-2" role="alertdialog" aria-label="Confirm import">
						<p className="text-sm text-amber-200">
							Confirm import of {insertCount} {domainLabel.toLowerCase()} record
							{insertCount === 1 ? '' : 's'}? Local copies remain on this device.
						</p>
						<div className="flex flex-wrap gap-2">
							<Button
								onClick={() => {
									setAwaitingImportConfirm(false)
									onConfirmImport()
								}}
								disabled={busy}
								aria-busy={busy}
							>
								{busy ? 'Importing…' : 'Confirm import'}
							</Button>
							<Button
								variant="ghost"
								onClick={() => setAwaitingImportConfirm(false)}
								disabled={busy}
							>
								Cancel
							</Button>
						</div>
					</div>
				)}
			</div>
		)
	}

	return null
}
