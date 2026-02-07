/**
 * FILE OBJECTIVE:
 * - Progress bar component showing overall chapter/subject completion percentage.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/ProgressBar.spec.ts
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

export interface ProgressBarProps {
  /** Progress percentage (0-100) */
  progress: number;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show percentage label */
  showLabel?: boolean;
  /** Label position */
  labelPosition?: 'inside' | 'outside' | 'none';
  /** Color variant */
  variant?: 'default' | 'success' | 'warning' | 'info';
  /** Custom class name */
  className?: string;
}

const sizeConfig = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

const variantConfig = {
  default: 'bg-indigo-500',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  info: 'bg-blue-500',
};

/**
 * ProgressBar - Visual progress indicator for chapter/subject completion.
 */
export default function ProgressBar({
  progress,
  size = 'md',
  showLabel = true,
  labelPosition = 'outside',
  variant = 'default',
  className = '',
}: ProgressBarProps) {
  // Clamp progress between 0 and 100
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const roundedProgress = Math.round(clampedProgress);

  return (
    <div className={`w-full ${className}`}>
      {/* Label above */}
      {showLabel && labelPosition === 'outside' && (
        <div className="flex justify-between mb-1 text-xs text-gray-600 dark:text-gray-400">
          <span>Progress</span>
          <span>{roundedProgress}%</span>
        </div>
      )}

      {/* Progress bar container */}
      <div
        className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ${sizeConfig[size]}`}
      >
        {/* Progress fill */}
        <div
          className={`${sizeConfig[size]} ${variantConfig[variant]} rounded-full transition-all duration-300 ease-out flex items-center justify-end`}
          style={{ width: `${clampedProgress}%` }}
        >
          {/* Label inside (for lg size) */}
          {showLabel && labelPosition === 'inside' && size === 'lg' && clampedProgress > 15 && (
            <span className="text-xs text-white font-medium pr-2">{roundedProgress}%</span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Calculate progress percentage from completed/total counts
 */
export function calculateProgress(completed: number, total: number): number {
  if (total <= 0) return 0;
  return (completed / total) * 100;
}
