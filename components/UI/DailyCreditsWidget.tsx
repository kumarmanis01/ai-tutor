/**
 * FILE OBJECTIVE:
 * - DailyCreditsWidget: displays the daily AI interaction counter ("43 / 50 today")
 *   in the dashboard nav area. Reads from DailyCreditsContext which is updated via
 *   the onMeta callback from useStream. No separate API fetch required.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/DailyCreditsWidget.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-06-08T00:00:00Z | claude | initial implementation for task S1-3
 */

'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import Link from 'next/link';
import { DAILY_FREE_LIMIT } from '@/lib/constants/credits';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DailyCreditsState {
  creditsUsed: number;
  creditsLimit: number;
  isLoading: boolean;
}

interface DailyCreditsContextValue extends DailyCreditsState {
  handleMeta: (meta: { creditsUsed: number; creditsLimit: number }) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const defaultContextValue: DailyCreditsContextValue = {
  creditsUsed: 0,
  creditsLimit: DAILY_FREE_LIMIT,
  isLoading: true,
  handleMeta: () => {},
};

export const DailyCreditsContext = createContext<DailyCreditsContextValue>(defaultContextValue);

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * Wrap the dashboard layout (or any subtree that renders a chat + this widget)
 * with DailyCreditsProvider. The handleMeta function is passed as onMeta to
 * useStream so the widget updates when each AI response completes.
 */
export function DailyCreditsProvider({ children }: { children: React.ReactNode }) {
  const [creditsUsed, setCreditsUsed] = useState(0);
  const [creditsLimit, setCreditsLimit] = useState(DAILY_FREE_LIMIT);
  const [isLoading, setIsLoading] = useState(true);

  const handleMeta = useCallback((meta: { creditsUsed: number; creditsLimit: number }) => {
    setCreditsUsed(meta.creditsUsed);
    setCreditsLimit(meta.creditsLimit);
    setIsLoading(false);
  }, []);

  return (
    <DailyCreditsContext.Provider value={{ creditsUsed, creditsLimit, isLoading, handleMeta }}>
      {children}
    </DailyCreditsContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/** Returns the current daily credit state and the meta handler for wiring to useStream. */
export function useDailyCredits(): DailyCreditsContextValue {
  return useContext(DailyCreditsContext);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true when the user is at or above 80% of their daily limit. */
export function isNearLimit(creditsUsed: number, creditsLimit: number): boolean {
  return creditsLimit > 0 && creditsUsed >= Math.floor(creditsLimit * 0.8);
}

/** Returns true when the user has reached or exceeded their daily limit. */
export function isLimitExceeded(creditsUsed: number, creditsLimit: number): boolean {
  return creditsUsed >= creditsLimit;
}

// ─── Widget ───────────────────────────────────────────────────────────────────

/**
 * Displays the daily AI credit counter.
 * Reads state from DailyCreditsContext -- must be rendered inside DailyCreditsProvider.
 *
 * States:
 * - Loading (isLoading=true): skeleton placeholder
 * - Normal (< 80%): muted "43 / 50 today"
 * - Soft warn (>= 80%): amber text, no link yet
 * - At limit (>= 100%): amber text + "Upgrade for more" link
 */
export function DailyCreditsWidget() {
  const { creditsUsed, creditsLimit, isLoading } = useDailyCredits();

  if (isLoading) {
    return (
      <div
        className="h-4 w-24 animate-pulse rounded bg-muted dark:bg-muted/60"
        aria-label="Loading credit usage"
        role="status"
      />
    );
  }

  const atLimit = isLimitExceeded(creditsUsed, creditsLimit);
  const nearLimit = isNearLimit(creditsUsed, creditsLimit);

  const fractionClass = atLimit || nearLimit
    ? 'text-warning dark:text-warning'
    : 'text-muted-foreground dark:text-muted-foreground';

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={fractionClass} data-testid="credits-fraction">
        {creditsUsed} / {creditsLimit} today
      </span>
      {atLimit && (
        <Link
          href="/pricing"
          className="min-h-[44px] min-w-[44px] flex items-center text-warning underline underline-offset-2 hover:text-warning/80 dark:text-warning dark:hover:text-warning/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          data-testid="upgrade-link"
        >
          Upgrade for more
        </Link>
      )}
    </div>
  );
}
