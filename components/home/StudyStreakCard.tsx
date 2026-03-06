/**
 * FILE OBJECTIVE:
 * - Dashboard widget displaying the student's daily study streak.
 * - Shows currentStreak, longestStreak, and a motivational message.
 *
 * EDIT LOG:
 * - 2026-03-06 | claude | created for daily streak tracking feature
 */
import React from 'react';

export interface StudyStreakCardProps {
  currentStreak: number;
  longestStreak: number;
}

export default function StudyStreakCard({ currentStreak, longestStreak }: StudyStreakCardProps) {
  return (
    <section
      className="bg-white rounded-lg border p-6"
      aria-labelledby="study-streak-heading"
    >
      <h3 id="study-streak-heading" className="text-lg font-semibold text-gray-900">
        🔥 {currentStreak} {currentStreak === 1 ? 'Day' : 'Day'} Study Streak
      </h3>

      <p className="mt-2 text-sm text-gray-500">
        Keep learning daily to build strong habits.
      </p>

      {longestStreak > 0 && (
        <p className="mt-3 text-xs text-gray-400">
          Best streak: {longestStreak} {longestStreak === 1 ? 'day' : 'days'}
        </p>
      )}
    </section>
  );
}
