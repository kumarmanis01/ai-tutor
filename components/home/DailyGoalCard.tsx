'use client';

import React from 'react';
import Link from 'next/link';

export type DailyGoalState = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

interface DailyGoalCardProps {
  state: DailyGoalState;
  /** When set, "Start Today's Session" links to /session/[topicId]. When unset, button still renders but links to dashboard. */
  nextTopicId?: string | null;
  loading?: boolean;
}

/**
 * Today's Learning Goal card. Primary CTA: complete 1 session.
 * States: NOT_STARTED, IN_PROGRESS, COMPLETED.
 */
export function DailyGoalCard({ state, nextTopicId, loading }: DailyGoalCardProps) {
  const href = nextTopicId ? `/session/${nextTopicId}` : '/dashboard';
  const showStartButton = state === 'NOT_STARTED' || state === 'IN_PROGRESS';

  if (loading) {
    return (
      <section
        className="rounded-xl border border-border bg-card p-5"
        aria-label="Today's learning goal"
      >
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-48 rounded bg-muted" />
          <div className="h-4 w-36 rounded bg-muted" />
          <div className="h-10 w-full rounded bg-muted" />
        </div>
      </section>
    );
  }

  return (
    <section
      className="rounded-xl border border-border bg-card p-5"
      aria-labelledby="daily-goal-heading"
    >
      <h2 id="daily-goal-heading" className="text-sm font-semibold text-muted-foreground">
        Today&apos;s Learning Goal
      </h2>
      <p className="mt-1 text-base font-medium text-foreground">
        Complete 1 session
      </p>
      {state === 'COMPLETED' && (
        <p className="mt-2 text-sm text-muted-foreground">Done for today.</p>
      )}
      {showStartButton && (
        <Link
          href={href}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Start Today&apos;s Session
        </Link>
      )}
    </section>
  );
}
