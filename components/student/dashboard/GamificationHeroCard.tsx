'use client';

import React from 'react';
import { getProgressPercent, getLevelFromXP, getLevelTierName, getTierColor } from '@/lib/student/xpLevels';
import { StudyBuddyGreeting } from '@/components/student/StudyBuddyGreeting';

const WEEKLY_GOAL = 5;

type Props = {
  totalXp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  weeklySessionCount: number;
  studyBuddy?: string;
};

export default function GamificationHeroCard({
  totalXp,
  level,
  currentStreak,
  longestStreak,
  weeklySessionCount,
  studyBuddy,
}: Props) {
  const progress = getProgressPercent(totalXp);
  const tierName = getLevelTierName(level);
  const tierColor = getTierColor(level);
  const weeklyDone = Math.min(weeklySessionCount, WEEKLY_GOAL);
  const weeklyPct = Math.round((weeklyDone / WEEKLY_GOAL) * 100);

  return (
    <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-slate-800 p-4 flex flex-col gap-4">
      {/* Row 1: Level + XP bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-bold"
              style={{ backgroundColor: tierColor }}
              aria-label={`Level ${level} -- ${tierName}`}
            >
              {level}
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-white leading-none">
                Level {level}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 leading-none mt-0.5">
                {tierName}
              </p>
            </div>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {totalXp.toLocaleString()} XP
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, backgroundColor: tierColor }}
            role="progressbar"
            aria-label={`XP progress: ${progress}% to next level`}
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 text-right">
          {progress}% to next level
        </p>
      </div>

      {/* Row 2: Streak + weekly goal tiles */}
      <div className="grid grid-cols-2 gap-3">
        {/* Streak tile */}
        <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 px-3 py-2.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-orange-500 leading-none">
              {currentStreak}
            </span>
            <span className="text-xs text-orange-400 font-medium">
              {currentStreak === 1 ? 'day' : 'days'}
            </span>
          </div>
          <p className="text-xs text-orange-500 dark:text-orange-400 font-medium mt-0.5">
            🔥 Current streak
          </p>
          {longestStreak > 0 && (
            <p className="text-[10px] text-orange-400/70 mt-0.5">
              Best: {longestStreak}d
            </p>
          )}
        </div>

        {/* Weekly goal tile */}
        <div className="rounded-lg bg-[#EAF3DE] dark:bg-[#1D9E75]/10 px-3 py-2.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-[#1D9E75] leading-none">
              {weeklyDone}
            </span>
            <span className="text-xs text-[#1D9E75] font-medium">
              / {WEEKLY_GOAL}
            </span>
          </div>
          <p className="text-xs text-[#1D9E75] font-medium mt-0.5">
            Sessions this week
          </p>
          <div className="flex gap-0.5 mt-1.5">
            {Array.from({ length: WEEKLY_GOAL }).map((_, i) => (
              <div
                key={i}
                className={[
                  'flex-1 h-1.5 rounded-full',
                  i < weeklyDone
                    ? 'bg-[#1D9E75]'
                    : 'bg-[#1D9E75]/20 dark:bg-[#1D9E75]/10',
                ].join(' ')}
                aria-hidden
              />
            ))}
          </div>
          <p className="text-[10px] text-[#1D9E75]/70 mt-0.5">
            {weeklyDone >= WEEKLY_GOAL
              ? 'Weekly goal hit!'
              : `${WEEKLY_GOAL - weeklyDone} more to hit goal`}
          </p>
        </div>
      </div>

      {/* Row 3: Study buddy greeting */}
      <StudyBuddyGreeting
        totalXp={totalXp}
        streak={currentStreak}
        avatarName={studyBuddy ?? 'Vidya'}
      />
    </div>
  );
}
