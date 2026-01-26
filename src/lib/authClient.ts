export type AuthUser = {
	id: string
	fullName: string
	email: string
	phone?: string | null
	marketingConsent?: boolean
	role?: string
	termsAcceptedAt?: string
	termsVersion?: string
	createdAt: string
}

const USERS_KEY = 'athleteLedger:users'
const CURRENT_ID_KEY = 'athleteLedger:currentUserId'

function loadUsers(): AuthUser[] {
	try {
		const raw = localStorage.getItem(USERS_KEY)
		if (!raw) return []
		const parsed = JSON.parse(raw)
		return Array.isArray(parsed) ? parsed : []
	} catch {
		return []
	}
}

function saveUsers(users: AuthUser[]): void {
	localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function setCurrentUserId(userId: string | null): void {
	if (userId) {
		localStorage.setItem(CURRENT_ID_KEY, userId)
	} else {
		localStorage.removeItem(CURRENT_ID_KEY)
	}
}

function getCurrentUserId(): string | null {
	return localStorage.getItem(CURRENT_ID_KEY)
}

function generateId(): string {
	return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function getCurrentUser(): AuthUser | null {
	const id = getCurrentUserId()
	if (!id) return null
	const users = loadUsers()
	return users.find(u => u.id === id) || null
}

import { TERMS_VERSION } from '../constants/legal'

export function createLocalUser(input: { fullName: string; email: string; phone?: string; marketingConsent?: boolean }): AuthUser {
	const normalizedEmail = input.email.trim().toLowerCase()
	const normalizedName = input.fullName.trim()
	if (!normalizedEmail || !normalizedName) {
		throw new Error('Missing name or email')
	}
	const users = loadUsers()
	const existing = users.find(u => u.email.toLowerCase() === normalizedEmail)
	if (existing) {
		// treat as idempotent sign-up → "log in"
		setCurrentUserId(existing.id)
		return existing
	}
	const user: AuthUser = {
		id: generateId(),
		fullName: normalizedName,
		email: normalizedEmail,
		phone: input.phone || null,
		marketingConsent: !!input.marketingConsent,
		role: 'athlete',
		termsAcceptedAt: new Date().toISOString(),
		termsVersion: TERMS_VERSION,
		createdAt: new Date().toISOString()
	}
	users.push(user)
	saveUsers(users)
	setCurrentUserId(user.id)
	return user
}

export function loginLocalUser(email: string): AuthUser | null {
	const normalizedEmail = (email || '').trim().toLowerCase()
	if (!normalizedEmail) return null
	const users = loadUsers()
	const user = users.find(u => u.email.toLowerCase() === normalizedEmail) || null
	if (user) {
		setCurrentUserId(user.id)
	}
	return user
}

export function logoutUser(): void {
	setCurrentUserId(null)
}


