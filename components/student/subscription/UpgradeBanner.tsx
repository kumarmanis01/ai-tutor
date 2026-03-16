'use client';

/**
 * UpgradeBanner — sticky dismiss-aware upgrade nudge.
 *
 * Shown on the dashboard when the student has previously dismissed
 * the FreemiumUpgradeGate (Redis key present, TTL 24 h).
 * Dismissing again refreshes the Redis TTL for another 24 h.
 * Banner is rendered at the top of the left dashboard column.
 */

import React, { useState, useCallback } from 'react';

interface UpgradeBannerProps {
  /** Whether to show the banner at all (passed from SSR dismiss check). */
  show: boolean;
}

export function UpgradeBanner({ show }: UpgradeBannerProps) {
  const [visible, setVisible] = useState(show);

  const handleDismiss = useCallback(async () => {
    setVisible(false);
    try {
      await fetch('/api/student/subscription/dismiss', { method: 'POST' });
    } catch {
      // non-blocking
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-5 flex items-center gap-3 rounded-xl border border-[#534AB7]/30 bg-[#EEEDFE] dark:bg-[#534AB7]/10 px-4 py-3"
    >
      <span className="flex-shrink-0 text-base" aria-hidden>✨</span>
      <a
        href="#upgrade"
        onClick={(e) => {
          e.preventDefault();
          // Scroll to upgrade section
          document.getElementById('upgrade-section')?.scrollIntoView({ behavior: 'smooth' });
        }}
        className="flex-1 text-sm font-medium text-[#534AB7] dark:text-indigo-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#534AB7] rounded"
      >
        Upgrade to continue learning →
      </a>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss upgrade banner"
        className="flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#534AB7]"
      >
        ✕
      </button>
    </div>
  );
}

export default UpgradeBanner;
