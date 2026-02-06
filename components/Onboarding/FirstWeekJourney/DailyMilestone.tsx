/**
 * FILE OBJECTIVE:
 * - Daily milestone component showing achievement progress within a day.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/Onboarding/FirstWeekJourney/DailyMilestone.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-05T00:00:00Z | copilot | created daily milestone component
 */

'use client';

import React from 'react';
import type { DailyMilestoneProps } from './types';

/**
 * Check circle icon for completed milestones
 */
function CheckCircleIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Circle icon for pending milestones
 */
function CircleIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
    </svg>
  );
}

/**
 * Progress circle for partial completion
 */
function ProgressCircle({
  progress,
  size = 40,
  strokeWidth = 4,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
}): React.JSX.Element {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      className="transform -rotate-90"
      aria-hidden="true"
    >
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-gray-200"
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="text-blue-500 transition-all duration-500 ease-out"
      />
    </svg>
  );
}

/**
 * DailyMilestone - Shows individual milestone achievement within a day
 * 
 * @example
 * ```tsx
 * <DailyMilestone
 *   title="Complete 3 questions"
 *   description="Answer three practice questions correctly"
 *   achieved={true}
 *   progress={100}
 *   icon="📝"
 *   language="en"
 * />
 * ```
 */
export function DailyMilestone({
  title,
  description,
  achieved,
  progress,
  icon = '✨',
  _language = 'en',
}: DailyMilestoneProps): React.JSX.Element {
  const isInProgress = !achieved && progress > 0;

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-lg border transition-all duration-200
        ${achieved ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}
        ${isInProgress ? 'bg-blue-50 border-blue-200' : ''}
      `}
      role="listitem"
      aria-label={`${title}: ${achieved ? 'Completed' : `${progress}% complete`}`}
    >
      {/* Status icon */}
      <div className="flex-shrink-0 mt-0.5">
        {achieved ? (
          <CheckCircleIcon className="w-6 h-6 text-green-500" />
        ) : isInProgress ? (
          <div className="relative">
            <ProgressCircle progress={progress} size={24} strokeWidth={3} />
            <span
              className="absolute inset-0 flex items-center justify-center text-xs font-medium text-blue-600"
              aria-hidden="true"
            >
              {progress}%
            </span>
          </div>
        ) : (
          <CircleIcon className="w-6 h-6 text-gray-300" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">
            {icon}
          </span>
          <h4
            className={`
              font-medium text-sm
              ${achieved ? 'text-green-800 line-through' : 'text-gray-800'}
              ${isInProgress ? 'text-blue-800' : ''}
            `}
          >
            {title}
          </h4>
        </div>
        <p className="text-xs text-gray-500 mt-1">{description}</p>

        {/* Progress bar for in-progress items */}
        {isInProgress && (
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        )}
      </div>

      {/* Achievement badge */}
      {achieved && (
        <div className="flex-shrink-0">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
            aria-label="Completed"
          >
            ✓
          </span>
        </div>
      )}
    </div>
  );
}
