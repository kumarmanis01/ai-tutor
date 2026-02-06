/**
 * FILE OBJECTIVE:
 * - Main first-week progress component showing the complete 7-day journey overview.
 * - Integrates day cards, streak display, and parent messages.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/Onboarding/FirstWeekJourney/FirstWeekProgress.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-05T00:00:00Z | copilot | created first week progress component
 */

'use client';

import React, { useState, useCallback } from 'react';
import type { FirstWeekProgressProps, DayUIConfig } from './types';
import { FIRST_WEEK_STRINGS, _DAY_THEMES } from './types';
import { DayProgressCard } from './DayProgressCard';
import { StreakCelebration } from './StreakCelebration';
import { ParentMessagePreview } from './ParentMessagePreview';

/**
 * Fire icon for streak display
 */
function FireIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M12 23C16.1421 23 19.5 19.6421 19.5 15.5C19.5 14.1183 19.1425 12.8228 18.5177 11.6936C18.3522 11.3944 18.1749 11.1032 17.9862 10.8211C17.0578 9.45093 15.9035 8.25403 15.0283 6.76823C14.1531 5.28244 13.5 3.5 13.5 1.5L12.6152 2.14453C11.1976 3.08828 10.0833 4.38857 9.3927 5.91016C8.70208 7.43175 8.46257 9.11252 8.70228 10.7617C8.82227 11.5935 9.03125 12.3968 9.03125 12.3968C9.03125 12.3968 8.07849 12.0737 7.5 11.5C7.20313 11.2031 6.96094 10.8672 6.72656 10.5234C6.27344 9.87891 5.84375 9.20313 5.25 8.65625C5.08594 8.5 4.5 8.5 4.5 8.5C4.5 8.5 4.5 9.5 4.5 10.5C4.5 11.5 4.72656 12.5859 5.0625 13.5C5.72656 15.3047 7 16.8906 7 18.5C7 20.1562 5.5 21 5.5 21C5.5 21 7.85791 23 12 23Z" />
    </svg>
  );
}

/**
 * Day titles and descriptions for display
 */
const DAY_DISPLAY_CONFIG: Record<'en' | 'hi', Record<number, { title: string; description: string; emoji: string }>> = {
  en: {
    1: { title: 'First Steps', description: 'Start your journey with easy wins', emoji: '🌟' },
    2: { title: 'Building Momentum', description: 'Add voice input to your learning', emoji: '🎤' },
    3: { title: 'Finding Your Pace', description: 'Discover what works for you', emoji: '🎯' },
    4: { title: 'Halfway There', description: 'You\'re doing amazing!', emoji: '💪' },
    5: { title: 'Going Deeper', description: 'Explore more challenging content', emoji: '🚀' },
    6: { title: 'Almost Champion', description: 'One more day to go!', emoji: '⭐' },
    7: { title: 'Week Complete!', description: 'You did it! Celebrate your success', emoji: '🏆' },
  },
  hi: {
    1: { title: 'पहला कदम', description: 'आसान जीत से शुरुआत', emoji: '🌟' },
    2: { title: 'गति बनाना', description: 'वॉइस इनपुट से सीखें', emoji: '🎤' },
    3: { title: 'अपनी गति खोजें', description: 'जानें क्या काम करता है', emoji: '🎯' },
    4: { title: 'आधा रास्ता', description: 'शानदार कर रहे हो!', emoji: '💪' },
    5: { title: 'गहराई में', description: 'चुनौतीपूर्ण सामग्री', emoji: '🚀' },
    6: { title: 'लगभग चैंपियन', description: 'एक दिन और!', emoji: '⭐' },
    7: { title: 'हफ्ता पूरा!', description: 'कर दिखाया! जश्न मनाओ', emoji: '🏆' },
  },
};

/**
 * Check if a day should show parent message preview
 */
function isParentMessageDay(dayNumber: number): dayNumber is 1 | 4 | 7 {
  return dayNumber === 1 || dayNumber === 4 || dayNumber === 7;
}

/**
 * FirstWeekProgress - Complete first-week journey overview component
 * 
 * @example
 * ```tsx
 * <FirstWeekProgress
 *   studentId="student-123"
 *   currentDay={3}
 *   days={dayConfigs}
 *   streakCount={3}
 *   showCelebration={false}
 *   onDayClick={(day) => router.push(`/learn/day/${day}`)}
 *   language="en"
 * />
 * ```
 */
export function FirstWeekProgress({
  _studentId,
  currentDay,
  days,
  streakCount,
  showCelebration = false,
  onDayClick,
  language = 'en',
  className = '',
}: FirstWeekProgressProps): React.JSX.Element {
  const [celebrationVisible, setCelebrationVisible] = useState(showCelebration);
  const [, _setCelebrationDay] = useState(currentDay);
  const strings = FIRST_WEEK_STRINGS[language];

  const handleDismissCelebration = useCallback(() => {
    setCelebrationVisible(false);
  }, []);

  const handleDayClick = useCallback(
    (dayNumber: number) => {
      if (onDayClick) {
        onDayClick(dayNumber);
      }
    },
    [onDayClick]
  );

  // Calculate overall progress
  const completedDays = days.filter((d) => d.status === 'completed').length;
  const overallProgress = Math.round((completedDays / 7) * 100);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Celebration modal */}
      {celebrationVisible && (
        <StreakCelebration
          streakCount={streakCount}
          dayCompleted={celebrationDay}
          onDismiss={handleDismissCelebration}
          language={language}
          autoDismissMs={5000}
        />
      )}

      {/* Header with streak */}
      <div className="flex items-center justify-between bg-gradient-to-r from-orange-100 to-yellow-100 rounded-xl p-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">
            {language === 'en' ? 'Your First Week Journey' : 'आपकी पहले हफ्ते की यात्रा'}
          </h2>
          <p className="text-sm text-gray-600">
            {language === 'en'
              ? `Day ${currentDay} of 7 • ${overallProgress}% complete`
              : `दिन ${currentDay}/7 • ${overallProgress}% पूरा`}
          </p>
        </div>
        
        {/* Streak counter */}
        <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm">
          <FireIcon
            className={`w-6 h-6 ${streakCount > 0 ? 'text-orange-500' : 'text-gray-300'}`}
          />
          <span className="text-xl font-bold text-orange-600">{streakCount}</span>
          <span className="text-sm text-gray-600">{strings.streakLabel}</span>
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="bg-white rounded-lg p-4 border">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>{language === 'en' ? 'Week Progress' : 'हफ्ते की प्रगति'}</span>
          <span>{completedDays}/7 {language === 'en' ? 'days' : 'दिन'}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${overallProgress}%` }}
            role="progressbar"
            aria-valuenow={completedDays}
            aria-valuemin={0}
            aria-valuemax={7}
            aria-label={`${completedDays} of 7 days completed`}
          />
        </div>
      </div>

      {/* Day cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {days.map((day) => {
          const displayConfig = DAY_DISPLAY_CONFIG[language][day.dayNumber];
          const enrichedDay: DayUIConfig = {
            ...day,
            title: displayConfig?.title || day.title,
            description: displayConfig?.description || day.description,
            emoji: displayConfig?.emoji || day.emoji,
          };

          return (
            <DayProgressCard
              key={day.dayNumber}
              day={enrichedDay}
              isActive={day.dayNumber === currentDay}
              onClick={() => handleDayClick(day.dayNumber)}
              language={language}
            />
          );
        })}
      </div>

      {/* Parent message previews for milestone days */}
      {days.some((d) => isParentMessageDay(d.dayNumber) && (d.status === 'current' || d.status === 'completed')) && (
        <div className="space-y-4">
          <h3 className="text-md font-semibold text-gray-700">
            {language === 'en' ? 'Parent Updates' : 'माता-पिता अपडेट'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {days
              .filter((d) => isParentMessageDay(d.dayNumber))
              .map((day) => {
                const isSent = day.status === 'completed';
                const isScheduled = day.status === 'current';
                
                if (!isSent && !isScheduled) return null;

                return (
                  <ParentMessagePreview
                    key={`parent-${day.dayNumber}`}
                    dayNumber={day.dayNumber as 1 | 4 | 7}
                    studentName="Student" // Would be personalized from props
                    sent={isSent}
                    scheduledTime={isScheduled ? new Date(Date.now() + 24 * 60 * 60 * 1000) : undefined}
                    language={language}
                  />
                );
              })}
          </div>
        </div>
      )}

      {/* Encouragement message */}
      {currentDay <= 7 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-blue-800">
            {language === 'en'
              ? currentDay === 7
                ? "🎉 You're on your final day! Complete it to earn your first-week badge!"
                : `Keep going! ${7 - currentDay} more days to complete your first week!`
              : currentDay === 7
              ? '🎉 आज आखिरी दिन है! पहले हफ्ते का बैज पाने के लिए पूरा करें!'
              : `जारी रखें! पहला हफ्ता पूरा करने में ${7 - currentDay} दिन बाकी!`}
          </p>
        </div>
      )}
    </div>
  );
}
