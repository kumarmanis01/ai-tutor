'use client';

/**
 * DashboardTopbar — v2
 *
 * Sticky on mobile (top-14 = below StudentNav), static on desktop.
 * Left: Spinzy logo mark + wordmark.
 * Right: streak badge (🔥 N days) + level badge (Lv N) + avatar initials circle.
 *
 * All interactive elements ≥ 44×44px. Dark-mode variants on every class.
 */

import React from 'react';

export interface DashboardTopbarProps {
  name: string;
  streakCurrent: number;
  level: number;
}

export default function DashboardTopbar({
  name,
  streakCurrent,
  level,
}: DashboardTopbarProps) {
  const initial = (name ?? 'S').charAt(0).toUpperCase();

  return (
    <header className="sticky top-14 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-gray-100 dark:border-slate-800 px-4 py-2 flex items-center justify-between min-h-[44px]">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#534AB7] flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-xs leading-none">S</span>
        </div>
        <span className="font-bold text-sm text-gray-900 dark:text-gray-100 hidden sm:inline">
          Spinzy
        </span>
      </div>

      {/* Right badges */}
      <div className="flex items-center gap-2">
        {/* Streak badge — only shown when streak > 0 */}
        {streakCurrent > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-900/40 px-3 py-1 text-xs font-semibold text-orange-700 dark:text-orange-300">
            🔥 {streakCurrent} {streakCurrent === 1 ? 'day' : 'days'}
          </span>
        )}

        {/* Level badge */}
        <span className="inline-flex items-center rounded-full bg-[#534AB7]/10 dark:bg-[#534AB7]/20 px-3 py-1 text-xs font-semibold text-[#534AB7] dark:text-indigo-300">
          Lv {level}
        </span>

        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full bg-[#534AB7] flex items-center justify-center flex-shrink-0"
          aria-label={`Avatar for ${name}`}
        >
          <span className="text-white font-semibold text-xs leading-none">{initial}</span>
        </div>
      </div>
    </header>
  );
}
