// Lightweight observability utility for structured logging across client and server
// - Structured JSON logs
// - In-memory ring buffer for Diagnostics panel
// - Helpers for requestId generation and timing

export type ObservabilityFeature = 'discover' | 'recruitment' | 'discover_api' | 'recruitment_api' | 'ui' | 'user_data' | 'profile';

export type ObservabilityStatus =
	| 'ui_action'
	| 'start'
	| 'end'
	| 'ok'
	| 'empty'
	| 'error'
	| 'validation_ok'
	| 'validation_error'
	| 'warning';

export type ObservabilityEntry = {
	time: string
	tsMs: number
	requestId?: string
	feature: ObservabilityFeature
	route?: string
	userId?: string | null
	status: ObservabilityStatus
	durationMs?: number
	errorName?: string
	errorMessage?: string
	errorStack?: string
	meta?: Record<string, unknown>
};

const MAX_LOGS = 200;
const buffer: ObservabilityEntry[] = [];
const lastReqIdByFeature: Record<string, string | undefined> = {};

function isDiagnosticsEnabled(): boolean {
	try {
		// Vite exposes import.meta.env
		const flag = (import.meta as any)?.env?.VITE_DIAGNOSTICS;
		const dev = (import.meta as any)?.env?.DEV;
		return String(flag).toLowerCase() === 'true' || Boolean(dev);
	} catch {
		return false;
	}
}

export function generateRequestId(): string {
	// Prefer crypto.randomUUID when available
	if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
		return (crypto as any).randomUUID();
	}
	// Fallback
	return 'req_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function log(entry: Omit<ObservabilityEntry, 'time' | 'tsMs'>): ObservabilityEntry {
	const full: ObservabilityEntry = {
		time: new Date().toISOString(),
		tsMs: Date.now(),
		...entry
	};
	if (full.requestId && full.feature) {
		lastReqIdByFeature[full.feature] = full.requestId;
	}
	buffer.push(full);
	if (buffer.length > MAX_LOGS) {
		buffer.splice(0, buffer.length - MAX_LOGS);
	}
	// Always echo to dev console for immediate visibility
	try {
		// eslint-disable-next-line no-console
		console.log('[obs]', JSON.stringify(full));
	} catch {}
	return full;
}

export function getLogs(options?: { feature?: ObservabilityFeature; limit?: number }): ObservabilityEntry[] {
	const { feature, limit = 20 } = options || {};
	const logs = feature ? buffer.filter(l => l.feature === feature) : buffer.slice();
	return logs.slice(Math.max(0, logs.length - limit));
}

export function getLastRequestId(feature: ObservabilityFeature): string | undefined {
	return lastReqIdByFeature[feature];
}

export function setLastRequestId(feature: ObservabilityFeature, requestId: string) {
	lastReqIdByFeature[feature] = requestId;
}

export function startTimer(): () => number {
	const start = Date.now();
	return () => Date.now() - start;
}

export function startSpan(meta: { feature: ObservabilityFeature; route?: string; requestId?: string; userId?: string | null }): {
	requestId: string
	end: (status: ObservabilityStatus, extra?: { error?: unknown; meta?: Record<string, unknown> }) => number
} {
	const requestId = meta.requestId || generateRequestId();
	const stop = startTimer();
	log({
		requestId,
		feature: meta.feature,
		route: meta.route,
		status: 'start',
		userId: meta.userId
	});
	return {
		requestId,
		end: (status, extra) => {
			const durationMs = stop();
			const err = extra?.error as any;
			log({
				requestId,
				feature: meta.feature,
				route: meta.route,
				status,
				durationMs,
				userId: meta.userId,
				errorName: err?.name,
				errorMessage: err?.message,
				errorStack: err?.stack,
				meta: extra?.meta
			});
			return durationMs;
		}
	};
}

export const Observability = {
	log,
	getLogs,
	getLastRequestId,
	setLastRequestId,
	generateRequestId,
	startTimer,
	startSpan,
	isDiagnosticsEnabled
};

export default Observability;

