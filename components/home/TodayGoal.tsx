/**
 * FILE OBJECTIVE:
 * - TodayGoal: displays today's learning time goal as a progress bar with streak info.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | created to satisfy pre-existing TodayGoal unit tests
 */

import React from 'react';

interface TodayGoalProps {
  targetMinutes: number;
  completedMinutes: number;
  streakDays?: number;
}

export default function TodayGoal({ targetMinutes, completedMinutes, streakDays = 0 }: TodayGoalProps) {
  const pct = targetMinutes > 0 ? Math.min(100, Math.round((completedMinutes / targetMinutes) * 100)) : 0;

  return (
    <div>
      <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ width: `${pct}%` }} />
      </div>
      {streakDays > 0 && <span>{streakDays} day streak</span>}
    </div>
  );
}
