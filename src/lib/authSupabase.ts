import type { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

export type AuthResult<T> = {
  data: T | null
  error: { status?: number; message: string; code?: string } | null
}

export type SignUpResult = {
  user: User | null
  session: Session | null
  /** True when the account was created but no session was issued (email confirmation required). */
  requiresEmailConfirmation: boolean
  error: { status?: number; message: string; code?: string } | null
}

function toAuthError(error: { status?: number; message: string; code?: string } | null | undefined) {
  if (!error) return null
  return {
    status: (error as any)?.status,
    message: error.message,
    code: (error as any)?.code,
  }
}

export async function signUp(input: {
  email: string
  password: string
  fullName?: string
  phone?: string
  metadata?: Record<string, any>
  emailRedirectTo?: string
}): Promise<SignUpResult> {
  if (!supabase) {
    return {
      user: null,
      session: null,
      requiresEmailConfirmation: false,
      error: { message: 'Cloud auth not configured' },
    }
  }
  const { email, password, fullName, phone, metadata, emailRedirectTo } = input
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, phone, ...(metadata || {}) },
      ...(emailRedirectTo ? { emailRedirectTo } : {}),
    },
  })
  if (error) {
    return {
      user: null,
      session: null,
      requiresEmailConfirmation: false,
      error: toAuthError(error),
    }
  }
  const user = data.user ?? null
  const session = data.session ?? null
  return {
    user,
    session,
    requiresEmailConfirmation: Boolean(user) && !session,
    error: null,
  }
}

export async function resendSignupConfirmation(email: string): Promise<AuthResult<true>> {
  if (!supabase) {
    return { data: null, error: { message: 'Cloud auth not configured' } }
  }
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/login`,
    },
  })
  if (error) return { data: null, error: toAuthError(error) }
  return { data: true, error: null }
}

export async function signIn(input: {
  email: string
  password?: string
}): Promise<AuthResult<User>> {
  if (!supabase) {
    return { data: null, error: { message: 'Cloud auth not configured' } }
  }
  const { email, password } = input
  if (password && password.length > 0) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { data: null, error: toAuthError(error) }
    return { data: data.user, error: null }
  }
  // Magic link
  const { data, error } = await supabase.auth.signInWithOtp({ email })
  if (error) return { data: null, error: toAuthError(error) }
  // For magic link, user will be available after link click
  return { data: data.user ?? null, error: null }
}

export async function signOut(): Promise<AuthResult<true>> {
  if (!supabase) {
    return { data: null, error: { message: 'Cloud auth not configured' } }
  }
  const { error } = await supabase.auth.signOut()
  if (error) return { data: null, error: toAuthError(error) }
  return { data: true, error: null }
}

export async function getSession(): Promise<AuthResult<Session>> {
  if (!supabase) {
    return { data: null, error: { message: 'Cloud auth not configured' } }
  }
  const { data, error } = await supabase.auth.getSession()
  if (error) return { data: null, error: toAuthError(error) }
  return { data: data.session ?? null, error: null }
}

export async function updatePassword(password: string): Promise<AuthResult<true>> {
  if (!supabase) {
    return { data: null, error: { message: 'Cloud auth not configured' } }
  }
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { data: null, error: toAuthError(error) }
  return { data: true, error: null }
}
