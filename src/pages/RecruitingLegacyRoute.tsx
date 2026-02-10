/**
 * Route page for legacy Recruiting at /recruiting/legacy
 */

import { SupabaseSessionProvider } from '../context/SupabaseSessionContext'
import Recruiting from '../components/Recruiting'

export default function RecruitingLegacyRoute() {
  return (
    <SupabaseSessionProvider>
      <div className="min-h-screen bg-background text-foreground">
        <main className="mx-auto max-w-7xl px-4 py-8">
          <Recruiting />
        </main>
      </div>
    </SupabaseSessionProvider>
  )
}
