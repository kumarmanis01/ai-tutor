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
      <div className="flex items-center gap-2 mb-1">
        <span aria-hidden="true" className="text-2xl">🔥</span>
        <h3 id="study-streak-heading" className="text-lg font-semibold text-gray-900">
          Study Streak
        </h3>
      </div>

      <p className="text-4xl font-bold text-orange-500 mt-2">
        {currentStreak} {currentStreak === 1 ? 'day' : 'days'}
      </p>

      <p className="mt-2 text-sm text-gray-500">
        Keep learning every day to build strong concepts.
      </p>

      {longestStreak > 0 && (
        <p className="mt-3 text-xs text-gray-400">
          Best streak: {longestStreak} {longestStreak === 1 ? 'day' : 'days'}
        </p>
      )}
    </section>
  );
}
