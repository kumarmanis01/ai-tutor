'use client';
/**
 * FILE OBJECTIVE:
 * - 7-day activity grid showing which days had sessions this week.
 * - Closes Gap #10: "No visual streak calendar, only streak count as a number."
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Gap #10
 */

import React from 'react';
import { useWeeklyActivity } from '@/hooks/useWeeklyActivity';
import { useStreaksAndGoals } from '@/hooks/useStreaksAndGoals';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function StreakCalendar() {
  const { activeDays, todayIndex, loading: actLoading } = useWeeklyActivity();
  const { streaks, loading: strLoading } = useStreaksAndGoals();
  const loading = actLoading || strLoading;

  const dailyStreak = streaks?.find((s) => s.kind === 'daily' || s.kind === 'daily_study');
  const current = dailyStreak?.current ?? 0;
  const best = dailyStreak?.best ?? 0;

  if (loading) {
    return (
      <div className="bg-card rounded-xl p-4 border animate-pulse">
        <div className="h-5 bg-muted rounded w-1/3 mb-4" />
        <div className="flex gap-2 justify-between">
          {Array(7).fill(0).map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="h-3 bg-muted rounded w-6" />
              <div className="w-9 h-9 bg-muted rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-4 border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <span>🔥</span> This Week
        </h3>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            Streak: <span className="font-bold text-foreground">{current}d</span>
          </span>
          {best > 0 && (
            <span className="text-muted-foreground">
              Best: <span className="font-bold text-foreground">{best}d</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-1.5 justify-between">
        {DAY_LABELS.map((label, i) => {
          const isToday = i === todayIndex;
          const isActive = activeDays[i];
          const isFuture = i > todayIndex;

          return (
            <div key={label} className="flex-1 flex flex-col items-center gap-1">
              <span className={`text-xs ${isToday ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                {label}
              </span>
              <div
                className={[
                  'w-full aspect-square rounded-xl flex items-center justify-center text-base transition-all',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : isFuture
                    ? 'bg-muted/30 text-muted-foreground/40'
                    : 'bg-muted text-muted-foreground',
                  isToday && !isActive ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : '',
                ].join(' ')}
              >
                {isActive ? '⚡' : isFuture ? '' : '·'}
              </div>
            </div>
          );
        })}
      </div>

      {current === 0 && (
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Complete today&apos;s lesson to start a streak!
        </p>
      )}
      {current > 0 && (
        <p className="text-xs text-primary font-medium mt-3 text-center">
          {current >= 7 ? '🏆 Amazing week!' : `Keep going — ${7 - current} more days for a perfect week!`}
        </p>
      )}
    </div>
  );
}

export default StreakCalendar;
