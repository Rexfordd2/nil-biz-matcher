export function normalizeError(input: unknown): string {
	// Error instances: include name, message, and stack if available
	if (input instanceof Error) {
		const name = input.name || 'Error'
		const message = input.message || ''
		const stack = input.stack ?? ''
		return `${name}: ${message}\n${stack ?? ''}`
	}

	// Objects: JSON stringify with circular reference protection
	if (typeof input === 'object' && input !== null) {
		try {
			return JSON.stringify(input as Record<string, unknown>, safeReplacer(), 2)
		} catch {
			// Fallback to best-effort stringification
			return String(input)
		}
	}

	// Primitives, undefined, null
	return String(input)
}

export function safeReplacer(): (this: unknown, key: string, value: unknown) => unknown {
	const seen = new WeakSet<object>()
	return function (_key: string, value: unknown): unknown {
		if (typeof value === 'object' && value !== null) {
			if (seen.has(value as object)) {
				return '[Circular]'
			}
			seen.add(value as object)
		}
		if (typeof value === 'function') {
			return `[Function ${value.name || 'anonymous'}]`
		}
		if (value instanceof Error) {
			const name = value.name || 'Error'
			const message = value.message || ''
			const stack = value.stack ?? ''
			return { __type: 'Error', name, message, stack }
		}
		return value
	}
}


