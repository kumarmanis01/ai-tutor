/**
 * FILE OBJECTIVE:
 * - Display student's last activity with progress indicator.
 * - Provides one-tap resume functionality.
 * - Matches PRD "Continue Where You Left Off" section.
 *
 * LINKED UNIT TEST:
 * - __tests__/app/dashboard/components/home/ContinueWhereLeftOff.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created for student dashboard PRD refactor
 */
'use client';

import React from 'react';
import { useContinueLearning } from '@/hooks/useContinueLearning';

const ACTIVITY_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  test: { icon: '📝', label: 'Test', color: 'bg-blue-500/10 text-blue-600' },
  notes: { icon: '📖', label: 'Notes', color: 'bg-purple-500/10 text-purple-600' },
  practice: { icon: '🎯', label: 'Practice', color: 'bg-green-500/10 text-green-600' },
  doubt_solving: { icon: '❓', label: 'Doubt', color: 'bg-amber-500/10 text-amber-600' },
  lesson: { icon: '📚', label: 'Lesson', color: 'bg-indigo-500/10 text-indigo-600' },
  video: { icon: '🎬', label: 'Video', color: 'bg-red-500/10 text-red-600' },
};

function getActivityConfig(type: string) {
  const key = type?.toLowerCase() || '';
  return ACTIVITY_CONFIG[key] || { icon: '📚', label: 'Learning', color: 'bg-primary/10 text-primary' };
}

export function ContinueWhereLeftOff() {
  const { activities, loading, resumeActivity } = useContinueLearning();

  if (loading) {
    return (
      <div className="bg-card rounded-xl p-4 border animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-muted rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/2" />
            <div className="h-2 bg-muted rounded w-full mt-2" />
          </div>
        </div>
      </div>
    );
  }

  // Get only the most recent activity
  const lastActivity = activities?.[0];

  if (!lastActivity) {
    return null; // Don't show if no activity to resume
  }

  const config = getActivityConfig(lastActivity.activityType);
  const progress = (lastActivity as any).completionPercentage ?? 0;
  const title = (lastActivity as any).title || config.label;

  return (
    <button
      onClick={() => resumeActivity(lastActivity)}
      className="w-full bg-card hover:bg-muted/50 rounded-xl p-4 border text-left transition-all active:scale-[0.98]"
    >
      <div className="flex items-center gap-4">
        {/* Activity Icon */}
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl ${config.color}`}>
          {config.icon}
        </div>

        {/* Activity Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${config.color}`}>
              {config.label}
            </span>
          </div>
          <h3 className="font-medium text-foreground truncate">{title}</h3>
          <p className="text-sm text-muted-foreground truncate">
            {lastActivity.subject}
            {lastActivity.chapter && ` • ${lastActivity.chapter}`}
          </p>

          {/* Progress Bar */}
          {progress > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {progress}%
              </span>
            </div>
          )}
        </div>

        {/* Resume Arrow */}
        <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
          <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </button>
  );
}

export default ContinueWhereLeftOff;
