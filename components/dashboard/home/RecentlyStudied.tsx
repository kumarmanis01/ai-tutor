'use client';
/**
 * FILE OBJECTIVE:
 * - Shows up to 5 recent learning activities with one-tap resume.
 * - Closes Gap #8: "ContinueWhereLeftOff shows only 1 item."
 *   This component replaces the single-item card with a compact multi-item list.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Gap #8
 */

import React from 'react';
import { useContinueLearning } from '@/hooks/useContinueLearning';

const ACTIVITY_CONFIG: Record<string, { icon: string; label: string; colour: string }> = {
  test:          { icon: '📝', label: 'Test',     colour: 'bg-blue-500/10 text-blue-600' },
  notes:         { icon: '📖', label: 'Notes',    colour: 'bg-purple-500/10 text-purple-600' },
  practice:      { icon: '🎯', label: 'Practice', colour: 'bg-green-500/10 text-green-600' },
  doubt_solving: { icon: '❓', label: 'Doubt',    colour: 'bg-amber-500/10 text-amber-600' },
  lesson:        { icon: '📚', label: 'Lesson',   colour: 'bg-indigo-500/10 text-indigo-600' },
  video:         { icon: '🎬', label: 'Video',    colour: 'bg-red-500/10 text-red-600' },
};

function getConfig(type: string) {
  return ACTIVITY_CONFIG[type?.toLowerCase()] ?? { icon: '📚', label: 'Learning', colour: 'bg-primary/10 text-primary' };
}

export function RecentlyStudied() {
  const { activities, loading, resumeActivity } = useContinueLearning();

  if (loading) {
    return (
      <div className="bg-card rounded-xl p-4 border animate-pulse">
        <div className="h-5 bg-muted rounded w-1/3 mb-4" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <div className="w-10 h-10 bg-muted rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const items = activities?.slice(0, 5) ?? [];
  if (items.length === 0) return null;

  return (
    <div className="bg-card rounded-xl p-4 border">
      <h3 className="font-semibold text-foreground mb-3">Recently Studied</h3>

      <div className="divide-y divide-border/50">
        {items.map((activity, idx) => {
          const cfg = getConfig(activity.activityType);
          const title = (activity as any).title || cfg.label;
          const progress = (activity as any).completionPercentage ?? 0;

          return (
            <button
              key={idx}
              onClick={() => resumeActivity(activity)}
              className="w-full flex items-center gap-3 py-3 text-left hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors"
            >
              {/* Icon */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${cfg.colour}`}>
                {cfg.icon}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {activity.subject}{activity.chapter && ` · ${activity.chapter}`}
                </p>
                {progress > 0 && (
                  <div className="mt-1 w-full bg-muted rounded-full h-1">
                    <div
                      className="bg-primary h-1 rounded-full"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Resume arrow */}
              <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary text-xs">
                ▶
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default RecentlyStudied;
