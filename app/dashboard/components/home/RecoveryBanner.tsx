/**
 * FILE OBJECTIVE:
 * - Banner shown when FRS detects student inactivity.
 * - Gentle, encouraging tone. Not dismissive or guilt-inducing.
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created recovery banner for FRS integration
 */
'use client';

import React from 'react';
import { useRecoveryNudge } from '@/hooks/useRecoveryNudge';

export function RecoveryBanner() {
  const { nudge, loading, respond } = useRecoveryNudge();

  if (loading || !nudge) return null;

  const bgColor = nudge.nudgeType === 'fresh_start'
    ? 'from-amber-500/10 to-orange-500/5 border-amber-500/20'
    : nudge.nudgeType === 'easy_task'
      ? 'from-blue-500/10 to-indigo-500/5 border-blue-500/20'
      : 'from-purple-500/10 to-pink-500/5 border-purple-500/20';

  const icon = nudge.nudgeType === 'fresh_start' ? '🌱'
    : nudge.nudgeType === 'easy_task' ? '👋'
      : '💜';

  return (
    <div className={`bg-gradient-to-r ${bgColor} rounded-xl p-4 border`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0 mt-0.5">{icon}</span>
        <div className="flex-1">
          <p className="text-sm text-foreground font-medium mb-2">
            {nudge.message}
          </p>
          <button
            onClick={respond}
            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            I&apos;m back! Let&apos;s go &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}

export default RecoveryBanner;
