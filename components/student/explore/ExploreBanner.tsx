/**
 * FILE OBJECTIVE:
 * - Sticky dismissible banner for Explore Mode: informs the student their parent approval is pending.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/explore/ExploreBanner.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created
 */

'use client'

import { useState } from 'react'

interface Props {
  sentTo: string | null
}

export default function ExploreBanner({ sentTo }: Props) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-2 bg-[#FAEEDA] dark:bg-amber-900 px-4 py-3 text-sm text-[#BA7517] dark:text-amber-200">
      <span>
        <span className="mr-1">⏳</span>
        Waiting for approval
        {sentTo ? `. Sent to ${sentTo}.` : '.'}
        {' '}Explore 3 free sample lessons while you wait!
      </span>
      <button
        aria-label="Dismiss banner"
        className="flex-shrink-0 text-[#BA7517] dark:text-amber-200 font-bold text-base min-h-[44px] min-w-[44px] flex items-center justify-center"
        onClick={() => setDismissed(true)}
      >
        ✕
      </button>
    </div>
  )
}
