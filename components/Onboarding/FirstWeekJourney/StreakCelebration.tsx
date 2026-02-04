/**
 * FILE OBJECTIVE:
 * - Streak celebration component with animation for first-week journey.
 * - Shows celebration when student completes a day.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/Onboarding/FirstWeekJourney/StreakCelebration.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-05T00:00:00Z | copilot | created streak celebration component
 */

'use client';

import React, { useEffect, useState } from 'react';
import type { StreakCelebrationProps } from './types';
import { FIRST_WEEK_STRINGS } from './types';

/**
 * Confetti particle for celebration animation
 */
interface ConfettiParticle {
  id: number;
  x: number;
  y: number;
  color: string;
  rotation: number;
  size: number;
  animationDelay: number;
}

/**
 * Generate random confetti particles
 */
function generateConfetti(count: number): ConfettiParticle[] {
  const colors = [
    'bg-yellow-400',
    'bg-pink-400',
    'bg-blue-400',
    'bg-green-400',
    'bg-purple-400',
    'bg-orange-400',
  ];

  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: -10 - Math.random() * 20,
    color: colors[Math.floor(Math.random() * colors.length)],
    rotation: Math.random() * 360,
    size: 8 + Math.random() * 8,
    animationDelay: Math.random() * 0.5,
  }));
}

/**
 * Day completion messages by day number
 */
const DAY_MESSAGES: Record<'en' | 'hi', Record<number, string>> = {
  en: {
    1: "You've taken your first step! 🎉",
    2: "Two days strong! Keep it up! 💪",
    3: "Three days! You're building a habit! 🌟",
    4: "Four days in! You're a star! ⭐",
    5: "Five days! Almost there! 🚀",
    6: "Six days! One more to go! 🎯",
    7: "ONE WEEK COMPLETE! You're amazing! 🏆",
  },
  hi: {
    1: 'आपने पहला कदम उठाया! 🎉',
    2: 'दो दिन पूरे! शाबाश! 💪',
    3: 'तीन दिन! आदत बन रही है! 🌟',
    4: 'चार दिन! आप स्टार हो! ⭐',
    5: 'पाँच दिन! लगभग पहुँच गए! 🚀',
    6: 'छह दिन! एक और बाकी! 🎯',
    7: 'एक हफ्ता पूरा! आप कमाल हो! 🏆',
  },
};

/**
 * Streak milestone messages
 */
const STREAK_MILESTONES: Record<'en' | 'hi', Record<number, string>> = {
  en: {
    3: '🔥 3-Day Streak! Fire!',
    5: '🌟 5-Day Streak! Superstar!',
    7: '🏆 7-Day Streak! Champion!',
  },
  hi: {
    3: '🔥 3-दिन स्ट्रीक! आग लगा दी!',
    5: '🌟 5-दिन स्ट्रीक! सुपरस्टार!',
    7: '🏆 7-दिन स्ट्रीक! चैंपियन!',
  },
};

/**
 * StreakCelebration - Animated celebration component for day completion
 * 
 * @example
 * ```tsx
 * <StreakCelebration
 *   streakCount={3}
 *   dayCompleted={3}
 *   onDismiss={() => setShowCelebration(false)}
 *   language="en"
 *   autoDismissMs={5000}
 * />
 * ```
 */
export function StreakCelebration({
  streakCount,
  dayCompleted,
  onDismiss,
  language = 'en',
  autoDismissMs = 5000,
}: StreakCelebrationProps): React.JSX.Element | null {
  const [confetti, setConfetti] = useState<ConfettiParticle[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  const strings = FIRST_WEEK_STRINGS[language];
  const dayMessage = DAY_MESSAGES[language][dayCompleted] || DAY_MESSAGES[language][1];
  const streakMilestone = STREAK_MILESTONES[language][streakCount];

  // Generate confetti on mount
  useEffect(() => {
    setConfetti(generateConfetti(50));
  }, []);

  // Auto-dismiss timer
  useEffect(() => {
    if (autoDismissMs > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoDismissMs);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [autoDismissMs]);

  const handleDismiss = (): void => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      if (onDismiss) {
        onDismiss();
      }
    }, 300);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`
        fixed inset-0 z-50 flex items-center justify-center
        bg-black/50 backdrop-blur-sm
        transition-opacity duration-300
        ${isExiting ? 'opacity-0' : 'opacity-100'}
      `}
      onClick={handleDismiss}
      role="dialog"
      aria-modal="true"
      aria-label={`${strings.celebrationTitle} ${strings.celebrationSubtitle} ${dayCompleted}`}
    >
      {/* Confetti particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {confetti.map((particle) => (
          <div
            key={particle.id}
            className={`
              absolute rounded-sm ${particle.color}
              animate-fall
            `}
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              transform: `rotate(${particle.rotation}deg)`,
              animationDelay: `${particle.animationDelay}s`,
            }}
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Celebration card */}
      <div
        className={`
          relative bg-white rounded-2xl shadow-2xl p-8 m-4 max-w-sm w-full
          transform transition-all duration-300
          ${isExiting ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close celebration"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Trophy icon */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-yellow-100 animate-bounce">
            <span className="text-5xl" role="img" aria-label="trophy">
              {dayCompleted === 7 ? '🏆' : '🎉'}
            </span>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
          {strings.celebrationTitle}
        </h2>

        {/* Subtitle */}
        <p className="text-lg text-center text-gray-600 mb-4">
          {strings.celebrationSubtitle}{' '}
          <span className="font-bold text-blue-600">{dayCompleted}</span>!
        </p>

        {/* Day-specific message */}
        <p className="text-center text-gray-700 mb-4 text-lg">{dayMessage}</p>

        {/* Streak milestone (if applicable) */}
        {streakMilestone && (
          <div className="bg-gradient-to-r from-orange-400 to-red-500 rounded-lg p-3 mb-4 animate-pulse">
            <p className="text-center text-white font-bold">{streakMilestone}</p>
          </div>
        )}

        {/* Streak counter */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="text-3xl" role="img" aria-label="fire">
            🔥
          </span>
          <span className="text-3xl font-bold text-orange-500">{streakCount}</span>
          <span className="text-lg text-gray-600">{strings.streakLabel}</span>
        </div>

        {/* Continue button */}
        <button
          onClick={handleDismiss}
          className="
            w-full py-3 px-6 rounded-lg
            bg-gradient-to-r from-blue-500 to-purple-500
            text-white font-semibold text-lg
            hover:from-blue-600 hover:to-purple-600
            transform hover:scale-105 transition-all
            shadow-lg hover:shadow-xl
          "
        >
          {strings.continueButton}
        </button>
      </div>

      {/* CSS for confetti animation */}
      <style jsx>{`
        @keyframes fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-fall {
          animation: fall 3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
