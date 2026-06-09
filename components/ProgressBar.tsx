/**
 * FILE OBJECTIVE:
 * - Reusable progress bar component with size variants, color variants, and optional label.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | created to satisfy pre-existing ProgressBar tests
 */

import React from 'react';

export type ProgressBarSize = 'sm' | 'md' | 'lg';
export type ProgressBarVariant = 'default' | 'success' | 'warning' | 'info';
export type ProgressBarLabelPosition = 'outside' | 'none';

export interface ProgressBarProps {
  progress: number;
  showLabel?: boolean;
  className?: string;
  size?: ProgressBarSize;
  variant?: ProgressBarVariant;
  labelPosition?: ProgressBarLabelPosition;
}

const SIZE_CLASSES: Record<ProgressBarSize, string> = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

const VARIANT_FILL_CLASSES: Record<ProgressBarVariant, string> = {
  default: 'bg-indigo-500',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  info: 'bg-blue-500',
};

export function calculateProgress(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

export default function ProgressBar({
  progress,
  showLabel = true,
  className = '',
  size = 'md',
  variant = 'default',
  labelPosition = 'outside',
}: ProgressBarProps) {
  const clamped = Math.round(Math.min(100, Math.max(0, progress)));
  const showLabelContent = showLabel && labelPosition !== 'none';

  return (
    <div className={className}>
      {showLabelContent && (
        <div className="mb-1 flex items-center justify-between text-sm">
          <span>Progress</span>
          <span>{clamped}%</span>
        </div>
      )}
      <div className={`w-full rounded-full bg-gray-200 ${SIZE_CLASSES[size]}`}>
        <div
          className={`${SIZE_CLASSES[size]} rounded-full ${VARIANT_FILL_CLASSES[variant]}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
