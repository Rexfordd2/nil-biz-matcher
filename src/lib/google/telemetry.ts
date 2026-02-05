/**
 * Google Maps/Places telemetry and observability
 * Centralized logging for all Google API interactions
 */

import Observability, { generateRequestId } from '../obs'
import { getGoogleMapsStatus } from './loader'
import { hasGoogleMapsKey } from '../../config/env'

export type GoogleFeature = 'discover' | 'recruiting'

export type GoogleOperation = 
	| 'loader.start'
	| 'loader.reuse'
	| 'loader.loaded'
	| 'loader.error'
	| 'loader.auth_failure'
	| 'loader.timeout'
	| 'places.textSearch'
	| 'places.getDetails'
	| 'geocode.forward'
	| 'geocode.reverse'
	| 'autocomplete.init'
	| 'autocomplete.place_changed'

export type GoogleCallContext = {
	feature: GoogleFeature
	operation: GoogleOperation
	requestId?: string
	userId?: string | null
	userAction?: string // e.g., "search_button_click", "map_idle", "use_my_location"
	query?: string
	locationText?: string
	placeId?: string
}

export type GoogleStatusString = 
	| 'OK'
	| 'ZERO_RESULTS'
	| 'OVER_QUERY_LIMIT'
	| 'REQUEST_DENIED'
	| 'INVALID_REQUEST'
	| 'UNKNOWN_ERROR'
	| 'NOT_FOUND'
	| 'ERROR'

/**
 * Log the start of a Google API operation
 */
export function logGoogleStart(ctx: GoogleCallContext): string {
	const requestId = ctx.requestId || generateRequestId()
	const loaderStatus = getGoogleMapsStatus()
	
	Observability.log({
		feature: ctx.feature === 'discover' ? 'discover' : 'recruitment',
		route: `google.${ctx.operation}`,
		status: 'start',
		requestId,
		userId: ctx.userId,
		meta: {
			userAction: ctx.userAction,
			query: ctx.query,
			locationText: ctx.locationText,
			placeId: ctx.placeId,
			hasKey: hasGoogleMapsKey,
			loaderReady: loaderStatus.ready,
			loaderLoading: loaderStatus.loading,
			loaderError: loaderStatus.error?.message
		}
	})
	
	return requestId
}

/**
 * Log successful completion of a Google API operation
 */
export function logGoogleSuccess(
	ctx: GoogleCallContext,
	result: {
		count?: number
		googleStatus?: GoogleStatusString
		durationMs?: number
	}
): void {
	Observability.log({
		feature: ctx.feature === 'discover' ? 'discover' : 'recruitment',
		route: `google.${ctx.operation}`,
		status: result.count === 0 ? 'empty' : 'ok',
		requestId: ctx.requestId,
		userId: ctx.userId,
		durationMs: result.durationMs,
		meta: {
			count: result.count,
			googleStatus: result.googleStatus,
			userAction: ctx.userAction,
			query: ctx.query,
			locationText: ctx.locationText,
			placeId: ctx.placeId
		}
	})
}

/**
 * Log a Google API error
 */
export function logGoogleError(
	ctx: GoogleCallContext,
	error: {
		message: string
		name?: string
		stack?: string
		googleStatus?: GoogleStatusString
		statusCode?: number
		retryable?: boolean
		durationMs?: number
	}
): void {
	Observability.log({
		feature: ctx.feature === 'discover' ? 'discover' : 'recruitment',
		route: `google.${ctx.operation}`,
		status: 'error',
		requestId: ctx.requestId,
		userId: ctx.userId,
		errorName: error.name,
		errorMessage: error.message,
		errorStack: error.stack,
		durationMs: error.durationMs,
		meta: {
			googleStatus: error.googleStatus,
			statusCode: error.statusCode,
			retryable: error.retryable,
			userAction: ctx.userAction,
			query: ctx.query,
			locationText: ctx.locationText,
			placeId: ctx.placeId
		}
	})
}

/**
 * Create a timer for measuring operation duration
 */
export function startTimer(): () => number {
	const start = Date.now()
	return () => Date.now() - start
}

/**
 * Enhanced Google error with structured metadata
 */
export class GoogleError extends Error {
	public readonly googleStatus?: GoogleStatusString
	public readonly operation: GoogleOperation
	public readonly retryable: boolean
	public readonly statusCode?: number
	public readonly requestId?: string

	constructor(
		message: string,
		operation: GoogleOperation,
		options?: {
			googleStatus?: GoogleStatusString
			retryable?: boolean
			statusCode?: number
			requestId?: string
			cause?: Error
		}
	) {
		super(message)
		this.name = 'GoogleError'
		this.operation = operation
		this.googleStatus = options?.googleStatus
		this.retryable = options?.retryable ?? false
		this.statusCode = options?.statusCode
		this.requestId = options?.requestId
		
		if (options?.cause) {
			this.stack = options.cause.stack
		}
	}
}

/**
 * Determine if a Google Places status indicates a retryable error
 */
export function isRetryableStatus(status: GoogleStatusString): boolean {
	return status === 'OVER_QUERY_LIMIT' || status === 'UNKNOWN_ERROR'
}

/**
 * Map Google Places status to HTTP-like status code for consistency
 */
export function statusToCode(status: GoogleStatusString): number | undefined {
	switch (status) {
		case 'OK':
		case 'ZERO_RESULTS':
			return 200
		case 'INVALID_REQUEST':
			return 400
		case 'REQUEST_DENIED':
			return 403
		case 'NOT_FOUND':
			return 404
		case 'OVER_QUERY_LIMIT':
			return 429
		case 'UNKNOWN_ERROR':
		case 'ERROR':
			return 500
		default:
			return undefined
	}
}
