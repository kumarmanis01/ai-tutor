'use client';
/**
 * FILE OBJECTIVE:
 * - Mobile-optimized study goals and streak display.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/StudyGoals.spec.ts
 *
 * EDIT LOG:
 * - 2025-01-22 | copilot | simplified for mobile with compact streak
 */
import React from 'react';
import { useStreaksAndGoals } from '@/hooks/useStreaksAndGoals';

const StudyGoals: React.FC = () => {
  const { streaks, loading } = useStreaksAndGoals();
  const daily = streaks.find(s => s.kind === 'daily_study');
  const streakDays = daily?.current ?? 0;
  const todayGoal = 3;
  const todayDone = Math.min(todayGoal, streakDays);

  if (loading) {
    return (
      <div className="bg-card rounded-lg p-4 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-muted rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-3 bg-muted rounded w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 rounded-lg p-4 border border-orange-500/20">
      <div className="flex items-center gap-4">
        {/* Streak flame */}
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
                style={{ width: `${Math.min((todayDone / todayGoal) * 100, 100)}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{todayDone}/{todayGoal}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudyGoals;