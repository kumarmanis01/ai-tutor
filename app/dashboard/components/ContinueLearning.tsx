'use client';
/**
 * FILE OBJECTIVE:
 * - Mobile-optimized continue learning section with compact activity cards.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/ContinueLearning.spec.ts
 *
 * EDIT LOG:
 * - 2025-01-22 | copilot | simplified for mobile with compact cards
 */
import React from 'react';
import { useContinueLearning } from '@/hooks/useContinueLearning';

const typeEmoji: Record<string, string> = {
  notes: '📖',
  test: '📝',
  quiz: '❓',
  default: '📚',
};

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
        const emoji = typeEmoji[a.activityType.toLowerCase()] || typeEmoji.default;
        return (
          <button
            key={a.id}
            onClick={() => resumeActivity(a)}
            className="w-full flex items-center gap-3 bg-card hover:bg-muted/50 rounded-lg p-3 text-left active:scale-[0.98] transition-transform"
          >
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-lg">
              {emoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{a.activityType}</p>
              <p className="text-xs text-muted-foreground truncate">{a.subject || 'General'}</p>
            </div>
            <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
};

export default ContinueLearning;