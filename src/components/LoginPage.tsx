import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '../lib/supabaseClient'
import { useSupabaseSession } from '../context/SupabaseSessionContext'
import { getBuildStamp } from '../config/env'

const LoginPage: React.FC = () => {
  const { loading } = useSupabaseSession()
  return (
    <div className="min-h-screen">
      <div className="fixed top-2 right-3 text-xs text-foreground/60">{getBuildStamp()}</div>
      {loading ? (
        <div className="flex justify-center items-center min-h-screen">
          <p>Loading…</p>
        </div>
      ) : !supabase ? (
        <div className="flex justify-center items-center min-h-screen">
          <div className="w-96 text-center text-sm text-gray-300">
            Cloud login unavailable. Missing Supabase environment variables.
          </div>
        </div>
      ) : (
        <div className="flex justify-center items-center min-h-screen">
          <div className="w-96">
            <Auth
              supabaseClient={supabase}
              appearance={{ theme: ThemeSupa }}
              providers={['google']}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default LoginPage

