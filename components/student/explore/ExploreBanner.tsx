'use client';

/**
 * FILE OBJECTIVE:
 * - Sticky dismissible banner for Explore Mode: informs the student their parent
 *   approval is pending. After 24h, switches to a gentle reminder copy.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/explore/ExploreBanner.spec.ts
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created
 * - 2026-04-28T00:00:00Z | staff-engineer | add 24h reminder copy per S0.3 spec
 */

import { useEffect, useState } from 'react';

interface Props {
  sentTo: string | null;
  /** ISO string of when the consent request was sent (from consentRequest.createdAt). */
  sentAt?: string | null;
}

const MS_24H = 24 * 60 * 60 * 1000;

function isPast24h(sentAt: string | null | undefined): boolean {
  if (!sentAt) return false;
  return Date.now() - new Date(sentAt).getTime() > MS_24H;
}

export default function ExploreBanner({ sentTo, sentAt }: Props) {
  const [dismissed, setDismissed] = useState(false);
  // Derived state so the banner re-renders when the 24h threshold is crossed.
  const [showReminder, setShowReminder] = useState(() => isPast24h(sentAt));

  useEffect(() => {
    if (!sentAt || showReminder) return;
    const elapsed = Date.now() - new Date(sentAt).getTime();
    const remaining = MS_24H - elapsed;
    if (remaining <= 0) {
      setShowReminder(true);
      return;
    }
    const id = setTimeout(() => setShowReminder(true), remaining);
    return () => clearTimeout(id);
  }, [sentAt, showReminder]);

  if (dismissed) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-2 bg-[#FAEEDA] dark:bg-amber-900 px-4 py-3 text-sm text-[#BA7517] dark:text-amber-200">
      <span>
        {showReminder ? (
          <>
            <span className="mr-1" aria-hidden>
              💛
            </span>
            Mom might have missed it.{' '}
            <strong>Send a gentle reminder?</strong>
          </>
        ) : (
          <>
            <span className="mr-1" aria-hidden>
              ⏳
            </span>
            Waiting for approval
            {sentTo ? `. Sent to ${sentTo}.` : '.'} Explore 3 free sample lessons while you wait!
          </>
        )}
      </span>
      <button
        aria-label="Dismiss banner"
        className="flex-shrink-0 text-[#BA7517] dark:text-amber-200 font-bold text-base min-h-[44px] min-w-[44px] flex items-center justify-center"
        onClick={() => setDismissed(true)}
      >
        ✕
      </button>
    </div>
  );
}
