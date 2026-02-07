/**
 * FILE OBJECTIVE:
 * - Day progress card component showing individual day status in first-week journey.
 * - Configuration-driven UI (not grade conditionals).
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/Onboarding/FirstWeekJourney/DayProgressCard.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-05T00:00:00Z | copilot | created day progress card component
 */

'use client';

import React from 'react';
import type { DayProgressCardProps } from './types';
import { FIRST_WEEK_STRINGS, DAY_THEMES } from './types';

/**
 * Check icon SVG
 */
function CheckIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

/**
 * Lock icon SVG
 */
function LockIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  );
}

/**
 * Progress bar component
 */
function ProgressBar({
  completed,
  total,
  accentColor,
}: {
  completed: number;
  total: number;
  accentColor: string;
}): React.JSX.Element {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
      <div
        className={`${accentColor} h-2 rounded-full transition-all duration-500 ease-out`}
        style={{ width: `${percentage}%` }}
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${completed} of ${total} tasks completed`}
      />
    </div>
  );
}

/**
 * DayProgressCard - Shows individual day status in the first-week journey
 * 
 * @example
 * ```tsx
 * <DayProgressCard
 *   day={{
 *     dayNumber: 1,
 *     title: "First Steps",
 *     description: "Start your learning journey",
 *     emoji: "🌟",
 *     theme: "confidence",
 *     status: "completed",
 *     tasksCompleted: 3,
 *     totalTasks: 3
 *   }}
 *   isActive={false}
 *   onClick={() => console.log("Day clicked")}
 *   language="en"
 * />
 * ```
 */
export function DayProgressCard({
  day,
  isActive,
  onClick,
  language = 'en',
  className = '',
}: DayProgressCardProps): React.JSX.Element {
  const strings = FIRST_WEEK_STRINGS[language];
  const theme = DAY_THEMES[day.dayNumber] || DAY_THEMES[1];

  const isClickable = day.status === 'current' || day.status === 'completed';
  const isCompleted = day.status === 'completed';
  const isLocked = day.status === 'locked';
  const isMissed = day.status === 'missed';

  // Determine status label
  const getStatusLabel = (): string => {
    switch (day.status) {
      case 'current':
        return strings.currentDay;
      case 'completed':
        return strings.completedDay;
      case 'locked':
        return strings.lockedDay;
      case 'missed':
        return strings.missedDay;
      default:
        return '';
    }
  };

  // Card styles based on status
  const cardStyles = [
    'relative rounded-xl border-2 p-4 transition-all duration-200',
    isActive ? 'ring-2 ring-offset-2 ring-blue-500' : '',
    isClickable ? 'cursor-pointer hover:shadow-md' : 'cursor-not-allowed opacity-60',
    isCompleted ? `${theme.backgroundColor} ${theme.borderColor}` : '',
    isLocked ? 'bg-gray-50 border-gray-200' : '',
    isMissed ? 'bg-red-50 border-red-200' : '',
    day.status === 'current' ? `${theme.backgroundColor} ${theme.borderColor} shadow-md` : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const handleClick = (): void => {
    if (isClickable && onClick) {
      onClick();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if ((e.key === 'Enter' || e.key === ' ') && isClickable && onClick) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={cardStyles}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={isClickable ? 'button' : 'article'}
      tabIndex={isClickable ? 0 : -1}
      aria-label={`${strings.dayLabel} ${day.dayNumber}: ${day.title}. ${getStatusLabel()}`}
      aria-disabled={!isClickable}
    >
      {/* Day number badge */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`
              inline-flex items-center justify-center w-8 h-8 rounded-full text-white font-bold text-sm
              ${isCompleted ? theme.accentColor : ''}
              ${isLocked ? 'bg-gray-400' : ''}
              ${isMissed ? 'bg-red-400' : ''}
              ${day.status === 'current' ? theme.accentColor : ''}
            `}
          >
            {day.dayNumber}
          </span>
          <span className="text-2xl" aria-hidden="true">
            {day.emoji}
          </span>
        </div>

        {/* Status icon */}
        <div className="flex items-center">
          {isCompleted && (
            <div className={`${theme.completedBadgeColor} rounded-full p-1`}>
              <CheckIcon className={`w-4 h-4 ${theme.textColor}`} />
            </div>
          )}
          {isLocked && (
            <div className="bg-gray-100 rounded-full p-1">
              <LockIcon className="w-4 h-4 text-gray-400" />
            </div>
          )}
        </div>
      </div>

      {/* Day title and description */}
      <div className="mb-2">
        <h3
          className={`
            font-semibold text-base
            ${isCompleted ? theme.textColor : ''}
            ${isLocked ? 'text-gray-500' : ''}
            ${isMissed ? 'text-red-700' : ''}
            ${day.status === 'current' ? theme.textColor : ''}
          `}
        >
          {day.title}
        </h3>
        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{day.description}</p>
      </div>

      {/* Progress bar (only for current and completed days) */}
      {(day.status === 'current' || day.status === 'completed') && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{day.tasksCompleted}/{day.totalTasks} {strings.tasksLabel}</span>
            <span>{Math.round((day.tasksCompleted / day.totalTasks) * 100)}%</span>
          </div>
          <ProgressBar
            completed={day.tasksCompleted}
            total={day.totalTasks}
            accentColor={theme.accentColor}
          />
        </div>
      )}

      {/* Status badge */}
      <div className="mt-3">
        <span
          className={`
            inline-block text-xs font-medium px-2 py-1 rounded-full
            ${isCompleted ? `${theme.completedBadgeColor} ${theme.textColor}` : ''}
            ${isLocked ? 'bg-gray-100 text-gray-500' : ''}
            ${isMissed ? 'bg-red-100 text-red-700' : ''}
            ${day.status === 'current' ? 'bg-blue-100 text-blue-700 animate-pulse' : ''}
          `}
        >
          {getStatusLabel()}
        </span>
      </div>

      {/* Current day indicator */}
      {day.status === 'current' && (
        <div className="absolute -top-1 -right-1">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
          </span>
        </div>
      )}
    </div>
  );
}
