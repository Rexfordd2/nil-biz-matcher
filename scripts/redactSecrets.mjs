/**
 * Redact secrets from environment variable values
 * 
 * @param {Record<string, string>} envVars - Environment variables object
 * @returns {Record<string, string>} - Environment variables with secrets redacted
 */
export function redactSecrets(envVars) {
	const secretPatterns = [
		/TOKEN/i,
		/KEY/i,
		/SECRET/i,
		/PASSWORD/i,
		/AUTH/i,
		/CREDENTIAL/i,
		/PRIVATE/i,
		/DATABASE_URL/i  // Specifically handle DATABASE_URL as it contains connection strings
	]
	
	const redacted = {}
	for (const [key, value] of Object.entries(envVars)) {
		const isSecret = secretPatterns.some(pattern => pattern.test(key))
		if (isSecret && value) {
			redacted[key] = '***REDACTED***'
		} else {
			redacted[key] = value
		}
	}
	return redacted
}
