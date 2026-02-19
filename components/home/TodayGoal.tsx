import React from 'react';

export interface TodayGoalProps {
  targetMinutes: number;
  completedMinutes: number;
  streakDays?: number | null;
}

export default function TodayGoal({ targetMinutes, completedMinutes, streakDays }: TodayGoalProps) {
  const safeTarget = Math.max(0, Math.floor(Number(targetMinutes) || 0));
  const safeCompleted = Math.max(0, Math.floor(Number(completedMinutes) || 0));
  const pct = safeTarget === 0 ? 0 : Math.min(100, Math.round((safeCompleted / safeTarget) * 100));

  return (
    <section className="bg-white rounded-lg shadow p-4" aria-labelledby="today-goal-heading">
      <h3 id="today-goal-heading" className="text-lg font-semibold">
        {`Today's goal — ${safeTarget} min`}
      </h3>

      <div className="mt-3">
        <div
          className="w-full h-3 bg-gray-200 rounded overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={safeTarget}
          aria-valuenow={safeCompleted}
          aria-label={`Completed ${safeCompleted} of ${safeTarget} minutes`}
        >
          <div
            className="h-full bg-indigo-600"
            style={{ width: `${pct}%` }}
            aria-hidden
          />
        </div>

        <div className="mt-2 text-sm text-gray-600">
          {safeCompleted} / {safeTarget} minutes • {streakDays ?? 0}-day streak
        </div>
      </div>
    </section>
  );
}
