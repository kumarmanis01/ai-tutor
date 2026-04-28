/**
 * FILE OBJECTIVE:
 * - S2.1 Study Buddy top-bar widget: tappable avatar button that opens a greeting
 *   popover with a rotating encouraging message, XP, and streak stats.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/learning-map/StudyBuddyGreeting.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-28T00:00:00Z | claude | created S2.1 study buddy greeting popover
 */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

const GREETINGS = [
  'Great to see you! Ready to unlock your next chapter?',
  "You're doing amazing! Keep that streak going!",
  'Every lesson you complete gets you one step closer to mastery.',
  "Let's tackle something new today. You've got this!",
  'Consistency is your superpower. Show up and learn!',
];

type StudyBuddyGreetingProps = {
  xp: number;
  streak: number;
  avatarName?: string;
};

export function StudyBuddyGreeting({ xp, streak, avatarName = 'Vidya' }: StudyBuddyGreetingProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [greeting, setGreeting] = useState(GREETINGS[0]);
  const ref = useRef<HTMLDivElement>(null);

  const open = useCallback(() => {
    const pick = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    setGreeting(pick);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        close();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, close]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={isOpen ? close : open}
        aria-expanded={isOpen}
        aria-label={`${avatarName} study buddy -- tap for greeting`}
        className="min-h-[44px] w-full rounded-xl bg-[#EEEDFE] px-3 py-2 text-left hover:bg-[#E0DEFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#534AB7] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-[#534AB7]">
          Study Buddy
        </p>
        <p className="mt-1 text-sm font-medium text-[#3C3489]">
          {avatarName} &middot; {xp} XP &middot; {streak > 0 ? `${streak}-day streak` : 'Start your streak today!'}
        </p>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Study Buddy greeting"
          className="absolute left-0 top-full z-20 mt-2 w-72 animate-[fadeIn_180ms_ease-out] rounded-2xl border border-[#534AB7]/20 bg-white p-4 shadow-lg"
        >
          <div className="flex items-start gap-3">
            <span className="text-3xl" aria-hidden="true">🦊</span>
            <div>
              <p className="text-sm font-semibold text-[#534AB7]">{avatarName} says:</p>
              <p className="mt-1 text-sm leading-relaxed text-gray-700">{greeting}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-3 border-t border-gray-100 pt-3">
            <div className="flex-1 rounded-lg bg-[#EAF3DE] px-3 py-1.5 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#1D9E75]">XP</p>
              <p className="text-sm font-bold text-[#1D9E75]">{xp}</p>
            </div>
            <div className="flex-1 rounded-lg bg-[#FAEEDA] px-3 py-1.5 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#BA7517]">Streak</p>
              <p className="text-sm font-bold text-[#BA7517]">
                {streak > 0 ? `🔥 ${streak}` : '0 days'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="mt-3 min-h-[44px] w-full rounded-xl bg-[#534AB7] px-4 py-2 text-sm font-semibold text-white"
          >
            {"Let's go! →"}
          </button>
        </div>
      )}
    </div>
  );
}

export default StudyBuddyGreeting;
