/**
 * Honeypot and anti-bot configuration
 * 
 * Shared constants used by both the application and tests
 * to ensure consistent timing validation.
 */

/**
 * Minimum time (in milliseconds) before a form can be legitimately submitted.
 * Submissions faster than this threshold are flagged as suspicious.
 * 
 * Tests should wait > MIN_FORM_INTERACTION_TIME to simulate legitimate users.
 */
export const MIN_FORM_INTERACTION_TIME = 2000

/**
 * Recommended test delay (MIN_FORM_INTERACTION_TIME + safety buffer)
 * Use this in tests to avoid timing edge cases.
 */
export const TEST_FORM_DELAY = MIN_FORM_INTERACTION_TIME + 100
