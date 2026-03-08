/**
 * NudgeBanner
 *
 * A dismissable in-app nudge banner shown between PrimaryActionCard and
 * WeeklyStudyStrip when a nudge message is present.
 *
 * Design rules (UX architecture review):
 *   - Renders nothing when nudgeMessage is null
 *   - Calm, non-urgent tone (message text comes from nudgeMessage.ts)
 *   - Dismissable — student can close it; stored in sessionStorage so it
 *     doesn't reappear during the same browser session
 *   - No exclamation marks, no alarm colours
 *
 * EDIT LOG:
 *   2026-03-07 | UX implementation | created for engagement layer (Phase 4)
 */
'use client';

import React, { useEffect, useState } from 'react';

export interface NudgeBannerProps {
  nudgeMessage: string | null;
}

// Derive a stable key from the message text so we only dismiss this specific
// nudge, not all nudges.
function bannerKey(msg: string): string {
  return `nudge_dismissed_${msg.slice(0, 40).replace(/\s+/g, '_')}`;
}

export default function NudgeBanner({ nudgeMessage }: NudgeBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!nudgeMessage) return;
    const key = bannerKey(nudgeMessage);
    if (typeof window !== 'undefined' && sessionStorage.getItem(key)) {
      setDismissed(true);
    }
  }, [nudgeMessage]);

  if (!nudgeMessage || dismissed) return null;

  function handleDismiss() {
    if (!nudgeMessage) return;
    setDismissed(true);
    sessionStorage.setItem(bannerKey(nudgeMessage), '1');
  }

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800"
    >
      <p>{nudgeMessage}</p>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="shrink-0 text-blue-400 hover:text-blue-600 transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}
