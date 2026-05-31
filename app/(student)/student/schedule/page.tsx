'use client'
import { AppHeader, EmptyState, CalendarIcon } from '@/components/ui'
import { useRouter } from 'next/navigation'

export default function StudentSchedule() {
  const router = useRouter()
  return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto pb-8">
      <div className="px-4 pt-2 pb-3">
        <AppHeader title="Schedule" back onBack={() => router.push('/student/dashboard')} />
      </div>
      <div className="flex flex-col justify-center px-4 pt-16">
        <EmptyState
          icon={<CalendarIcon size={32} />}
          title="Coming Soon"
          body="Your schedule will appear here once sessions are set up."
        />
      </div>
    </div>
  )
}
