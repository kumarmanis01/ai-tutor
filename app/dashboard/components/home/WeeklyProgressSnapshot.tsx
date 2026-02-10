/**
 * FILE OBJECTIVE:
 * - Weekly progress snapshot showing sessions, subjects, and streak.
 * - Simple visual (progress bar, streak) - no ranks, no scores per PRD.
 * - Child-friendly, encouraging metrics display.
 *
 * LINKED UNIT TEST:
 * - __tests__/app/dashboard/components/home/WeeklyProgressSnapshot.spec.tsx
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | updated to use correct API fields, student-friendly copy
 * - 2026-02-04 | claude | created for student dashboard PRD refactor
 */
'use client';

import React from 'react';
import { useStreaksAndGoals } from '@/hooks/useStreaksAndGoals';

export function WeeklyProgressSnapshot() {
  const { streaks, progress, loading } = useStreaksAndGoals();

  const dailyStreak = streaks?.find(s => s.kind === 'daily' || s.kind === 'daily_study');
  const streakDays = dailyStreak?.current ?? 0;

  if (loading) {
    return (
      <div className="bg-card rounded-xl p-4 border animate-pulse">
        <div className="h-5 bg-muted rounded w-1/3 mb-4" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-16 bg-muted rounded-lg" />
          <div className="h-16 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  // Weekly progress percentage (from API: sessions completed vs weekly goal)
  const weeklyPercent = progress?.weeklyProgress ?? 0;

  return (
    <div className="bg-card rounded-xl p-4 border">
      {/* Header */}
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <span>Your Week So Far</span>
      </h3>

      {/* Weekly Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-muted-foreground">Weekly goal</span>
          <span className="font-medium text-foreground">{weeklyPercent}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2.5">
          <div
            className="bg-primary h-2.5 rounded-full transition-all"
            style={{ width: `${Math.min(weeklyPercent, 100)}%` }}
          />
        </div>
        {weeklyPercent >= 100 && (
          <p className="text-xs text-primary font-medium mt-1">
            Weekly goal reached — awesome!
          </p>
        )}
      </div>

      {/* Stats Grid - Encouraging metrics, no ranks */}
      <div className="grid grid-cols-3 gap-3">
        {/* Topics Completed */}
        <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-lg p-3 border border-green-500/10">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-muted-foreground">Topics</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-foreground">
              {progress?.topicsCompleted ?? 0}
            </span>
            <span className="text-sm text-muted-foreground">done</span>
          </div>
        </div>

        {/* Sessions */}
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-lg p-3 border border-blue-500/10">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-muted-foreground">Sessions</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-foreground">
              {progress?.totalSessions ?? 0}
            </span>
            <span className="text-sm text-muted-foreground">total</span>
          </div>
        </div>

        {/* Subjects */}
        <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-lg p-3 border border-purple-500/10">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-muted-foreground">Subjects</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-foreground">
              {progress?.subjectsStudied ?? 0}
            </span>
            <span className="text-sm text-muted-foreground">explored</span>
          </div>
        </div>
      </div>

      {/* Streak Encouragement */}
      {streakDays > 0 && (
        <div className="mt-4 pt-3 border-t border-border/50">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-lg">🔥</span>
            <span className="text-foreground font-medium">{streakDays} day streak!</span>
            <span className="text-muted-foreground">Keep it up!</span>
          </div>
        </div>
      )}

      {/* No streak - gentle encouragement */}
      {streakDays === 0 && (
        <div className="mt-4 pt-3 border-t border-border/50">
          <p className="text-sm text-muted-foreground">
            Complete today&apos;s task to start a streak!
          </p>
        </div>
      )}
    </div>
  );
}

export default WeeklyProgressSnapshot;
