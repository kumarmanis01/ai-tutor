'use client'
import { AppHeader, EmptyState, TargetIcon } from '@/components/ui'
import { useRouter } from 'next/navigation'

export default function StudentPractice() {
  const router = useRouter()
  return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto pb-8">
      <div className="px-4 pt-2 pb-3">
        <AppHeader title="Practice" back onBack={() => router.push('/student/dashboard')} />
      </div>
      <div className="flex flex-col justify-center px-4 pt-16">
        <EmptyState
          icon={<TargetIcon size={32} />}
          title="Coming Soon"
          body="Practice mode is being built. Check back soon."
        />
      </div>
    </div>
  )
}
