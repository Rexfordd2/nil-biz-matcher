import { createTransport, type Transporter } from 'nodemailer'

type RequiredEnv = {
	host: string
	port: number
	user: string
	pass: string
	from?: string
}

let cachedTransporter: Transporter | null = null
let cachedFrom: string | undefined

function readRequiredEnv(): RequiredEnv {
	const host = process.env.SMTP_HOST
	const port = Number(process.env.SMTP_PORT || 587)
	const user = process.env.SMTP_USER
	const pass = process.env.SMTP_PASS
	const from = process.env.SMTP_FROM

	if (!host || !user || !pass) {
		throw new Error('SMTP not configured: set SMTP_HOST, SMTP_USER, SMTP_PASS (and optionally SMTP_PORT, SMTP_FROM)')
	}

	return { host, port, user, pass, from }
}

export function getEmailTransporter(): Transporter {
	if (cachedTransporter) return cachedTransporter
	const { host, port, user, pass, from } = readRequiredEnv()
	cachedFrom = from
	cachedTransporter = createTransport({
		host,
		port,
		secure: false,
		auth: { user, pass }
	})
	return cachedTransporter
}

export async function sendMail(params: {
	to: string
	subject: string
	text?: string
	html?: string
	from?: string
}) {
	const transporter = getEmailTransporter()
	const defaultFrom = cachedFrom || process.env.SMTP_FROM
	const from = params.from || defaultFrom
	if (!from) {
		// Fallback: if no SMTP_FROM configured and none provided, throw to avoid spoofing issues
		throw new Error('Missing "from" address: set SMTP_FROM or provide a from value')
	}
	return transporter.sendMail({
		from,
		to: params.to,
		subject: params.subject,
		text: params.text,
		html: params.html
	})
}

export default { getEmailTransporter, sendMail }

