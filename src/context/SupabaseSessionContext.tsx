import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

type SupabaseSessionContextType = {
  session: Session | null
  user: User | null
  loading: boolean
}

const SupabaseSessionContext = createContext<SupabaseSessionContextType>({
  session: null,
  user: null,
  loading: true
})

export function SupabaseSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    let isMounted = true
    let unsubscribe: (() => void) | null = null
    if (!supabase) {
      setLoading(false)
      return
    }
    
    // Store in local const after guard check so TypeScript narrows the type
    const supabaseClient = supabase
    
    // Check for existing session cookie/token before making network call
    // This avoids unnecessary network requests for anonymous users
    const checkSession = async () => {
      try {
        // Check localStorage for Supabase session token
        // Supabase stores sessions in localStorage with keys like "sb-<project-ref>-auth-token"
        const hasLocalSession = typeof window !== 'undefined' && 
          Object.keys(localStorage).some(key => 
            key.startsWith('sb-') && key.includes('auth-token')
          )
        
        // If no session token found, skip network call
        if (!hasLocalSession) {
          if (!isMounted) return
          setSession(null)
          setUser(null)
          setLoading(false)
          return
        }
        
        // Only make network call if session indicators exist
        const { data, error } = await supabaseClient.auth.getSession()
        if (error) {
          // Silently handle errors - don't show network errors for missing sessions
          if (!error.message?.includes('session') && !error.message?.includes('token')) {
            // eslint-disable-next-line no-console
            console.warn('Supabase getSession error:', error.message)
          }
        }
        if (!isMounted) return
        const s = data?.session ?? null
        setSession(s)
        setUser(s?.user ?? null)
        setLoading(false)
      } catch (err) {
        // Silently handle exceptions - don't block rendering
        if (!isMounted) return
        setSession(null)
        setUser(null)
        setLoading(false)
      }
    }
    
    checkSession()
    
    const { data: listener } = supabaseClient.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return
      setSession(newSession)
      setUser(newSession?.user ?? null)
      setLoading(false)
    })
    unsubscribe = () => listener.subscription.unsubscribe()
    return () => {
      isMounted = false
      if (unsubscribe) unsubscribe()
    }
  }, [])

  return (
    <SupabaseSessionContext.Provider value={{ session, user, loading }}>
      {children}
    </SupabaseSessionContext.Provider>
  )
}

export function useSupabaseSession(): SupabaseSessionContextType {
  return useContext(SupabaseSessionContext)
}

