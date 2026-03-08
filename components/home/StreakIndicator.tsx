'use client';

import React from 'react';

interface StreakIndicatorProps {
  current: number;
  loading?: boolean;
}

/**
 * Displays current streak. Minimal copy; no gamification visuals.
 */
export function StreakIndicator({ current, loading }: StreakIndicatorProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (current === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-medium text-foreground">
        {current} Day Streak
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Keep it going tomorrow.
      </p>
    </div>
  );
}
