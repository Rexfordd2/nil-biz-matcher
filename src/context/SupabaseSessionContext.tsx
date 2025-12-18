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
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('Supabase getSession error:', error.message)
      }
      if (!isMounted) return
      const s = data?.session ?? null
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return
      setSession(newSession)
      setUser(newSession?.user ?? null)
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

