/**
 * Route page for RecruitingV2 at /recruiting
 */

import RecruitingV2 from '../components/RecruitingV2'

export default function RecruitingV2Route() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-7xl px-4 py-8">
        <RecruitingV2 />
      </main>
    </div>
  )
}
