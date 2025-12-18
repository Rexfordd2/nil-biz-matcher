import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '../lib/supabaseClient'
import { useSupabaseSession } from '../context/SupabaseSessionContext'

const LoginPage: React.FC = () => {
  const { loading } = useSupabaseSession()
  if (loading) return <p>Loading…</p>
  if (!supabase) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-96 text-center text-sm text-gray-300">
          Cloud login unavailable. Missing Supabase environment variables.
        </div>
      </div>
    )
  }
  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="w-96">
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={['google']}
        />
      </div>
    </div>
  )
}

export default LoginPage

