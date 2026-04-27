/**
 * FILE OBJECTIVE:
 * - Day-1 Celebration Screen component.
 * - Mark the day as a win, then exit.
 * - Tiny dopamine, no addiction.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/Day1/CelebrationScreen.test.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | copilot | created celebration screen
 */

'use client';

import React, { useEffect, useState } from 'react';
import {
  CelebrationScreenProps,
  CELEBRATION_COPY_HI,
  CELEBRATION_COPY_EN,
  DAY1_RULES,
} from './types';

/**
 * Day-1 Celebration Screen
 * 
 * UX Rules (FROZEN):
 * - Animation <2 seconds
 * - No streak pressure
 * - No competitive language
 * 
 * Goal: Leave student calm, not hyper
 */
export function CelebrationScreen({
  onFinish,
  language,
}: CelebrationScreenProps): React.ReactElement {
  const copy = language === 'hi' ? CELEBRATION_COPY_HI : CELEBRATION_COPY_EN;
  const [showConfetti, setShowConfetti] = useState(true);

  // Auto-hide confetti after animation duration
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowConfetti(false);
    }, DAY1_RULES.CELEBRATION_ANIMATION_MS);

    return () => clearTimeout(timer);
  }, []);

  // Auto-finish after a brief moment
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, DAY1_RULES.CELEBRATION_ANIMATION_MS + 1000);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-yellow-50 to-white relative overflow-hidden"
      role="main"
      aria-label="Celebration"
    >
      {/* Simple confetti animation - <2 seconds, then fades */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {/* Minimal confetti particles */}
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${(i * 8) + 4}%`,
                top: '-10px',
                animationDelay: `${i * 0.1}s`,
              }}
            >
              <div 
                className={`w-3 h-3 rounded-full ${
                  ['bg-yellow-400', 'bg-green-400', 'bg-blue-400', 'bg-pink-400'][i % 4]
                }`}
              />
            </div>
          ))}
        </div>
      )}

      {/* Celebration emoji - Simple, not over the top */}
      <div className="text-7xl mb-6 animate-bounce-gentle">
        🎉
      </div>

      {/* Title - Calm victory */}
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4 text-center">
        {copy.title}
      </h1>

      {/* Subtitle - Gentle farewell */}
      <p className="text-lg text-gray-500 text-center">
        {copy.subtitle}
      </p>

      {/* NO STREAK COUNTER - Intentionally absent on Day-1 */}
      {/* NO LEADERBOARD - Intentionally absent */}
      {/* NO "COME BACK TOMORROW" PRESSURE - Intentionally absent */}

      {/* Manual close option (in case auto-close doesn't trigger) */}
      <button
        onClick={onFinish}
        className="mt-10 text-sm text-gray-400 hover:text-gray-600 underline"
        aria-label="Close"
      >
        {language === 'hi' ? 'Band karein' : 'Close'}
      </button>
    </div>
  );
}

export default CelebrationScreen;
