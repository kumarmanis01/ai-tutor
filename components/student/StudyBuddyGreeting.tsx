'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getProgressPercent, getLevelFromXP, getLevelTierName } from '@/lib/student/xpLevels';

const MESSAGES = [
  "Every session makes you sharper. Keep going!",
  "Your consistency is building something real. One more session today?",
  "The best version of you is just a few sessions away.",
  "You showed up yesterday -- show up today too.",
  "Progress isn't always visible, but it's always happening.",
  "Today's effort is tomorrow's confidence.",
  "Your best is still ahead -- let's go find it!",
  "Steady practice beats last-minute panic. You're doing the right thing.",
];

type Props = {
  totalXp: number;
  streak: number;
  avatarName?: string;
};

export function StudyBuddyGreeting({ totalXp, streak, avatarName = 'Vidya' }: Props) {
  const [open, setOpen] = useState(false);
  const [msgIdx] = useState(() => Math.floor(Math.random() * MESSAGES.length));
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, close]);

  const level = getLevelFromXP(totalXp);
  const tierName = getLevelTierName(level);
  const progress = getProgressPercent(totalXp);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Chat with ${avatarName}`}
        aria-expanded={open}
        className="flex items-center gap-3 w-full min-h-[52px] rounded-xl bg-[#EEEDFE] dark:bg-[#534AB7]/20 px-4 py-3 hover:bg-[#534AB7]/20 dark:hover:bg-[#534AB7]/30 transition-colors text-left"
      >
        <span className="text-2xl select-none" aria-hidden>🧑‍🏫</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#534AB7] dark:text-indigo-300 truncate">
            {avatarName} says hi!
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {MESSAGES[msgIdx]}
          </p>
        </div>
        <span className="text-[#534AB7] dark:text-indigo-300 text-lg select-none" aria-hidden>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`${avatarName} -- study buddy`}
          className="absolute left-0 right-0 top-full mt-2 z-30 rounded-xl bg-white dark:bg-gray-900 shadow-lg border border-gray-100 dark:border-slate-800 p-4"
        >
          <div className="flex items-start gap-3 mb-4">
            <span className="text-4xl select-none" aria-hidden>🧑‍🏫</span>
            <div>
              <p className="text-sm font-bold text-gray-800 dark:text-white">{avatarName}</p>
              <p className="text-xs text-[#534AB7] dark:text-indigo-300">Your AI Study Buddy</p>
            </div>
          </div>

          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 italic">
            "{MESSAGES[msgIdx]}"
          </p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg bg-[#EAF3DE] dark:bg-[#1D9E75]/20 px-3 py-2 text-center">
              <p className="text-lg font-bold text-[#1D9E75]">
                {streak > 0 ? `🔥 ${streak}` : '0'}
              </p>
              <p className="text-xs text-[#1D9E75] font-medium">
                {streak === 1 ? 'day streak' : 'day streak'}
              </p>
            </div>
            <div className="rounded-lg bg-[#EEEDFE] dark:bg-[#534AB7]/20 px-3 py-2 text-center">
              <p className="text-lg font-bold text-[#534AB7] dark:text-indigo-300">
                Lv {level}
              </p>
              <p className="text-xs text-[#534AB7] dark:text-indigo-300 font-medium">{tierName}</p>
            </div>
          </div>

          {/* XP mini bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>{totalXp.toLocaleString()} XP</span>
              <span>{progress}% to next level</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#534AB7]"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>

          <Link
            href="/session"
            onClick={close}
            className="flex items-center justify-center gap-2 w-full min-h-[44px] rounded-lg bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4340a0] transition-colors"
          >
            Let's go! <span aria-hidden>&#8594;</span>
          </Link>
        </div>
      )}
    </div>
  );
}
