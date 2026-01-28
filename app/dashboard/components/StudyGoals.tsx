'use client';
/**
 * FILE OBJECTIVE:
 * - Mobile-optimized study goals, streak display, and progress metrics.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/StudyGoals.spec.ts
 *
 * EDIT LOG:
 * - 2026-01-22 | copilot | enhanced with real progress metrics (tests, score, sessions)
 * - 2025-01-22 | copilot | simplified for mobile with compact streak
 */
import React from 'react';
import { useStreaksAndGoals } from '@/hooks/useStreaksAndGoals';

const StudyGoals: React.FC = () => {
  const { streaks, progress, loading } = useStreaksAndGoals();
  const daily = streaks.find(s => s.kind === 'daily_study');
  const streakDays = daily?.current ?? 0;
  
  // Use actual progress data
  const weeklyProgress = progress.weeklyProgress;
  const testsCompleted = progress.testsCompleted;
  const averageScore = progress.averageScore;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-card rounded-lg p-4 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-muted rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-3 bg-muted rounded w-3/4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Streak Card */}
      <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 rounded-lg p-4 border border-orange-500/20">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center text-white shadow-lg">
            <span className="text-2xl">🔥</span>
          </div>
          
          <div className="flex-1">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-foreground">{streakDays}</span>
              <span className="text-sm text-muted-foreground">day streak</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all"
                  style={{ width: `${weeklyProgress}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{weeklyProgress}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Stats Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card rounded-lg p-3 text-center border">
          <div className="text-2xl font-bold text-primary">{testsCompleted}</div>
          <div className="text-xs text-muted-foreground">Tests</div>
        </div>
        <div className="bg-card rounded-lg p-3 text-center border">
          <div className="text-2xl font-bold text-green-600">{averageScore}%</div>
          <div className="text-xs text-muted-foreground">Avg Score</div>
        </div>
        <div className="bg-card rounded-lg p-3 text-center border">
          <div className="text-2xl font-bold text-purple-600">{progress.totalSessions}</div>
          <div className="text-xs text-muted-foreground">Sessions</div>
        </div>
      </div>
    </div>
  );
};

export default StudyGoals;