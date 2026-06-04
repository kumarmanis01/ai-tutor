'use client'

/**
 * FILE OBJECTIVE:
 * - Thin route shim for /session/[topicId]: reads the topicId param and mounts
 *   SessionContainer, which drives the structured-session phases through
 *   /api/session/start -> /next -> /practice/submit -> /test/submit.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/session/topicId/page.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-06-04T00:00:00Z | claude | replace 374-line hardcoded demo with thin
 *                                   SessionContainer mount; surface no-topic empty state.
 */

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
