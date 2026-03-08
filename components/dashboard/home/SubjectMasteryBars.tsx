'use client';
/**
 * FILE OBJECTIVE:
 * - Per-subject mastery progress bars for the student dashboard.
 * - Closes Gap #5: "No per-subject mastery bars in WeeklyProgressSnapshot."
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Gap #5
 */

import React from 'react';
import { useLearningSnapshot } from '@/hooks/useLearningSnapshot';

const SUBJECT_COLOURS: Record<string, string> = {
  Mathematics: 'bg-blue-500',
  Science: 'bg-green-500',
  Physics: 'bg-purple-500',
  Chemistry: 'bg-orange-500',
  Biology: 'bg-emerald-500',
  English: 'bg-pink-500',
  History: 'bg-amber-500',
  Geography: 'bg-teal-500',
};

function subjectColour(name: string): string {
  return SUBJECT_COLOURS[name] ?? 'bg-primary';
}

export function SubjectMasteryBars() {
  const { subjects, loading } = useLearningSnapshot();

  if (loading) {
    return (
      <div className="bg-card rounded-xl p-4 border space-y-3 animate-pulse">
        <div className="h-5 bg-muted rounded w-1/3 mb-4" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3 bg-muted rounded w-1/4" />
            <div className="h-2 bg-muted rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (subjects.length === 0) return null;

  return (
    <div className="bg-card rounded-xl p-4 border">
      <h3 className="font-semibold text-foreground mb-4">Subject Progress</h3>

      <div className="space-y-4">
        {subjects.map((s) => {
          const pct = Math.round(s.percentComplete);
          const colour = subjectColour(s.name);
          return (
            <div key={s.subjectId}>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="font-medium text-foreground">{s.name}</span>
                <span className="text-muted-foreground">
                  {s.completedTopics}/{s.topicCount} topics
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`${colour} h-2 rounded-full transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{pct}% complete</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SubjectMasteryBars;
