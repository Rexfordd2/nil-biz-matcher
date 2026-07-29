/**
 * Deterministic stable hash for legacy client IDs when a record lacks `id`.
 * Never use array index alone.
 */

export function stableHash(input: string): string {
	let h = 2166136261
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i)
		h = Math.imul(h, 16777619)
	}
	return (h >>> 0).toString(16).padStart(8, '0')
}

/** Canonical fingerprint string from sorted key/value pairs. */
export function fingerprintParts(parts: Record<string, unknown>): string {
	const keys = Object.keys(parts).sort()
	return keys.map((k) => `${k}:${JSON.stringify(parts[k] ?? null)}`).join('|')
}

/**
 * Derive a stable legacy client ID from domain prefix + content fingerprint.
 * Same inputs always produce the same ID.
 */
export function deriveLegacyClientId(prefix: string, parts: Record<string, unknown>): string {
	return `legacy-${prefix}-${stableHash(fingerprintParts(parts))}`
}

export function resolveClientId(
	id: unknown,
	prefix: string,
	parts: Record<string, unknown>
): string {
	if (typeof id === 'string' && id.trim().length > 0) return id
	return deriveLegacyClientId(prefix, parts)
}

/** Deep-clone via JSON so we never mutate the original local record. */
export function cloneRecordPayload(record: unknown): Record<string, unknown> {
	return JSON.parse(JSON.stringify(record)) as Record<string, unknown>
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function optionalString(value: unknown): string | undefined {
	if (value === undefined || value === null) return undefined
	if (typeof value === 'string') return value
	return undefined
}

export function optionalNumber(value: unknown): number | undefined {
	if (value === undefined || value === null) return undefined
	if (typeof value === 'number' && Number.isFinite(value)) return value
	return undefined
}

export function optionalBoolean(value: unknown): boolean | undefined {
	if (value === undefined || value === null) return undefined
	if (typeof value === 'boolean') return value
	return undefined
}

export function optionalStringArray(value: unknown): string[] | undefined {
	if (value === undefined || value === null) return undefined
	if (!Array.isArray(value)) return undefined
	return value.map((v) => (typeof v === 'string' ? v : String(v)))
}

/**
 * Order-independent JSON serialization for equality checks.
 * Distinguishes undefined (key absent) from null/false/0/""/[].
 */
export function stableStringify(value: unknown): string {
	return JSON.stringify(value, (_key, v) => {
		if (v && typeof v === 'object' && !Array.isArray(v)) {
			const sorted: Record<string, unknown> = {}
			for (const k of Object.keys(v as Record<string, unknown>).sort()) {
				sorted[k] = (v as Record<string, unknown>)[k]
			}
			return sorted
		}
		return v
	})
}

/** True when two domain records are semantically equal after key-order normalization. */
export function workflowRecordsEqual(a: unknown, b: unknown): boolean {
	return stableStringify(a) === stableStringify(b)
}
