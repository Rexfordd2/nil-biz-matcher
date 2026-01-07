import type { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

export type AuthResult<T> = {
  data: T | null
  error: { status?: number; message: string; code?: string } | null
}

export async function signUp(input: {
  email: string
  password: string
  fullName?: string
  phone?: string
  metadata?: Record<string, any>
}): Promise<AuthResult<User>> {
  if (!supabase) {
    return { data: null, error: { message: 'Cloud auth not configured' } }
  }
  const { email, password, fullName, phone, metadata } = input
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, phone, ...(metadata || {}) } }
  })
  if (error) return { data: null, error: { status: (error as any)?.status, message: error.message, code: (error as any)?.code } }
  return { data: data.user, error: null }
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
    if (error) return { data: null, error: { status: (error as any)?.status, message: error.message, code: (error as any)?.code } }
    return { data: data.user, error: null }
  }
  // Magic link
  const { data, error } = await supabase.auth.signInWithOtp({ email })
  if (error) return { data: null, error: { status: (error as any)?.status, message: error.message, code: (error as any)?.code } }
  // For magic link, user will be available after link click
  return { data: data.user ?? null, error: null }
}

export async function signOut(): Promise<AuthResult<true>> {
  if (!supabase) {
    return { data: null, error: { message: 'Cloud auth not configured' } }
  }
  const { error } = await supabase.auth.signOut()
  if (error) return { data: null, error: { status: (error as any)?.status, message: error.message, code: (error as any)?.code } }
  return { data: true, error: null }
}

export async function getSession(): Promise<AuthResult<Session>> {
  if (!supabase) {
    return { data: null, error: { message: 'Cloud auth not configured' } }
  }
  const { data, error } = await supabase.auth.getSession()
  if (error) return { data: null, error: { status: (error as any)?.status, message: error.message, code: (error as any)?.code } }
  return { data: data.session ?? null, error: null }
}

