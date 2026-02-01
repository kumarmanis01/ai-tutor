'use client';
/**
 * FILE OBJECTIVE:
 * - Mobile-optimized continue learning section with compact activity cards,
 *   progress indicators, and user-friendly labels.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/ContinueLearning.spec.ts
 *
 * EDIT LOG:
 * - 2026-02-01 | claude  | added progress bars, friendly activity labels, subject display
 * - 2025-01-22 | copilot | simplified for mobile with compact cards
 */
import React from 'react';
import { useContinueLearning } from '@/hooks/useContinueLearning';

const ACTIVITY_LABELS: Record<string, { label: string; emoji: string }> = {
  test: { label: 'Taking Test', emoji: '📝' },
  notes: { label: 'Reading Notes', emoji: '📖' },
  practice: { label: 'Practice Quiz', emoji: '🎯' },
  doubt_solving: { label: 'Doubt Solving', emoji: '❓' },
  lesson: { label: 'Lesson', emoji: '📚' },
  video: { label: 'Watching Video', emoji: '🎬' },
};

function getActivityDisplay(type: string) {
  const key = type?.toLowerCase() || '';
  return ACTIVITY_LABELS[key] || { label: type || 'Learning', emoji: '📚' };
}

const ContinueLearning: React.FC = () => {
  const { activities, loading, resumeActivity } = useContinueLearning();

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="bg-card rounded-lg p-3 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-muted rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-muted rounded w-3/4" />
                <div className="h-2 bg-muted rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!activities?.length) {
    return (
      <div className="bg-muted/30 rounded-lg p-4 text-center">
        <p className="text-sm text-muted-foreground">No activities to resume</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {activities.slice(0, 3).map((a) => {
        const display = getActivityDisplay(a.activityType);
        const title = (a as any).title || display.label;
        const progress = (a as any).completionPercentage ?? 0;

        return (
          <button
            key={a.id}
            onClick={() => resumeActivity(a)}
            className="w-full flex items-center gap-3 bg-card hover:bg-muted/50 rounded-lg p-3 text-left active:scale-[0.98] transition-transform"
          >
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-lg">
              {display.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{title}</p>
              <p className="text-xs text-muted-foreground truncate">
                {a.subject || display.label}
              </p>
              {progress > 0 && (
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 bg-muted rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {progress}%
                  </span>
                </div>
              )}
            </div>
            <svg className="w-4 h-4 text-muted-foreground flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
};

export default ContinueLearning;
