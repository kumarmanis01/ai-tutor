/**
 * FILE OBJECTIVE:
 * - Visual indicator component for topic completion status.
 *   Shows checkmark for completed, progress ring for in-progress, empty for not started.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/TopicCompletionIndicator.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created for MVP progress indicators
 */

'use client';

import React from 'react';

export type CompletionStatus = 'not-started' | 'in-progress' | 'completed';

export interface TopicCompletionIndicatorProps {
  /** Current completion status */
  status: CompletionStatus;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Optional progress percentage (0-100) for in-progress state */
  progress?: number;
  /** Show tooltip on hover */
  showTooltip?: boolean;
  /** Custom class name */
  className?: string;
}

const sizeConfig = {
  sm: { container: 'w-4 h-4', icon: 'text-xs', stroke: 2 },
  md: { container: 'w-5 h-5', icon: 'text-sm', stroke: 2.5 },
  lg: { container: 'w-6 h-6', icon: 'text-base', stroke: 3 },
};

const statusConfig = {
  'not-started': {
    bg: 'bg-gray-100 dark:bg-gray-700',
    border: 'border-gray-300 dark:border-gray-600',
    color: 'text-gray-400',
    tooltip: 'Not started',
  },
  'in-progress': {
    bg: 'bg-blue-50 dark:bg-blue-900/30',
    border: 'border-blue-300 dark:border-blue-700',
    color: 'text-blue-500',
    tooltip: 'In progress',
  },
  completed: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    border: 'border-green-400 dark:border-green-600',
    color: 'text-green-600 dark:text-green-400',
    tooltip: 'Completed',
  },
};

/**
 * TopicCompletionIndicator - Visual status indicator for topic progress.
 */
export default function TopicCompletionIndicator({
  status,
  size = 'md',
  progress = 0,
  showTooltip = true,
  className = '',
}: TopicCompletionIndicatorProps) {
  const sizeStyles = sizeConfig[size];
  const statusStyles = statusConfig[status];

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full ${sizeStyles.container} ${className}`}
      title={showTooltip ? statusStyles.tooltip : undefined}
    >
      {status === 'completed' ? (
        // Checkmark for completed
        <div
          className={`flex items-center justify-center rounded-full ${sizeStyles.container} ${statusStyles.bg} ${statusStyles.color}`}
        >
          <svg
            className={sizeStyles.icon}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      ) : status === 'in-progress' ? (
        // Progress ring for in-progress
        <div className={`relative ${sizeStyles.container}`}>
          <svg className="w-full h-full -rotate-90" viewBox="0 0 24 24">
            {/* Background circle */}
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              stroke="currentColor"
              strokeWidth={sizeStyles.stroke}
              className="text-gray-200 dark:text-gray-700"
            />
            {/* Progress arc */}
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              stroke="currentColor"
              strokeWidth={sizeStyles.stroke}
              strokeLinecap="round"
              className={statusStyles.color}
              strokeDasharray={`${(progress / 100) * 62.83} 62.83`}
            />
          </svg>
          {/* Center dot */}
          <div className={`absolute inset-0 flex items-center justify-center ${statusStyles.color}`}>
            <div className="w-1.5 h-1.5 rounded-full bg-current" />
          </div>
        </div>
      ) : (
        // Empty circle for not started
        <div
          className={`rounded-full border ${sizeStyles.container} ${statusStyles.border} ${statusStyles.bg}`}
        />
      )}
    </div>
  );
}

/**
 * Helper to determine status from progress data
 */
export function getCompletionStatus(
  isCompleted?: boolean,
  isStarted?: boolean,
  questionsAttempted?: number
): CompletionStatus {
  if (isCompleted) return 'completed';
  if (isStarted || (questionsAttempted && questionsAttempted > 0)) return 'in-progress';
  return 'not-started';
}
