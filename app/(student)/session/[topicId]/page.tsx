'use client'

import { useParams } from 'next/navigation'
import { SessionContainer } from '@/components/session/SessionContainer'

export default function SessionPage() {
  const params = useParams<{ topicId: string }>()
  const topicId = typeof params?.topicId === 'string' ? params.topicId : ''

  if (!topicId) {
    return (
      <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto p-6 flex flex-col items-center justify-center text-center">
        <div className="text-[18px] font-bold text-[var(--text)]">No topic selected</div>
        <div className="text-[13px] text-[var(--text-muted)] mt-2">
          Open a session from the dashboard or learning path.
        </div>
      </div>
    )
  }

  return <SessionContainer topicId={topicId} />
}
