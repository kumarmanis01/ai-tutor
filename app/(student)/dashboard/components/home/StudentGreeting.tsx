/**
 * FILE OBJECTIVE:
 * - Student greeting header with name, grade, and board display.
 * - Shows time-appropriate greeting (morning/afternoon/evening).
 * - Non-editable profile info shown here (editing via Profile tab).
 *
 * LINKED UNIT TEST:
 * - __tests__/app/dashboard/components/home/StudentGreeting.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created for student dashboard PRD refactor
 */
'use client';

import React, { useMemo } from 'react';
import useCurrentUser from '@/hooks/useCurrentUser';
import { useStreaksAndGoals } from '@/hooks/useStreaksAndGoals';

/** Get time-appropriate greeting */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function StudentGreeting() {
  const { data: profile, loading } = useCurrentUser();
  const { streaks } = useStreaksAndGoals();

  const greeting = useMemo(() => getGreeting(), []);
  const firstName = profile?.name?.split(' ')[0] || 'Student';
  const grade = profile?.grade;
  const board = profile?.board;

  const dailyStreak = streaks?.find((s) => s.kind === 'daily' || s.kind === 'daily_study');
  const streakDays = dailyStreak?.current ?? 0;

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-muted rounded w-48 mb-2" />
        <div className="h-4 bg-muted rounded w-32" />
      </div>
    );
  }

  return (
    <div className="mb-6">
      {/* Teacher Vidya ready badge */}
      <div className="flex items-center gap-2 mb-3">
        <img
          src="/logos/vidya/vidya-avatar-64.png"
          alt="Teacher Vidya"
          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
        />
        <span className="text-sm text-muted-foreground">
          Teacher Vidya recommends your next topic.
        </span>
      </div>

      {/* Main Greeting + Streak badge */}
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          Hello, <span className="text-primary">{firstName}</span> 👋
        </h1>
        {streakDays > 0 && (
          <div className="flex-shrink-0 flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full text-sm font-semibold">
            🔥 {streakDays}d
          </div>
        )}
      </div>

      {/* Grade & Board - Non-editable info */}
      {(grade || board) && (
        <div className="flex items-center gap-2 mt-2">
          {grade && (
            <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
              Grade {grade}
            </span>
          )}
          {board && (
            <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded uppercase">
              {board}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default StudentGreeting;
