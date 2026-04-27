/**
 * FILE OBJECTIVE:
 * - GDPR/DPDP-compliant cookie consent banner fixed to bottom of viewport.
 *   Persists dismissal in localStorage so it only shows once per browser.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/CookieConsentBanner.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T00:00:00Z | copilot | created for v3 landing page
 */
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'spinzy_cookie_consent';

const CookieConsentBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable (private browsing or SSR) -- show banner
      setVisible(true);
    }
  }, []);

  const dismiss = (accepted: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, accepted ? 'accepted' : 'declined');
    } catch {
      // ignore storage errors
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed bottom-0 inset-x-0 z-40 bg-secondary text-white shadow-2xl border-t border-white/10"
    >
      <div className="mx-auto px-4 py-4 md:py-3 max-w-7xl flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="font-body text-sm opacity-90 flex-1">
          We use cookies to improve your experience and analyse usage. We never sell your data.{' '}
          <Link href="/privacy" className="underline hover:opacity-100 transition-opacity">
            Privacy Policy
          </Link>
        </p>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={() => dismiss(true)}
            className="px-4 py-2 min-h-[44px] bg-[#534AB7] hover:bg-[#433ba0] text-white font-semibold rounded-lg text-sm transition-colors"
          >
            Accept
          </button>
          <button
            onClick={() => dismiss(false)}
            className="px-4 py-2 min-h-[44px] bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg text-sm transition-colors"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsentBanner;
