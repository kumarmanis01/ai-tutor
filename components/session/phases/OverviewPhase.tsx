'use client';
/**
 * FILE OBJECTIVE:
 * - Phase 1: OVERVIEW — Prepares the student's mind before learning begins.
 * - Shows topic summary, learning objectives, session roadmap, tutor reason.
 * - "Students should never jump directly into content." — spec
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | moved to components/session/phases/ (architecture refactor)
 */

import React from 'react';
import type { OverviewContent } from '@/lib/session/getPhaseContent';

interface OverviewPhaseProps {
  content: OverviewContent;
  reasonLabel?: string | null;
  estimatedTimeMin?: number;
  onStart: () => void;
  loading?: boolean;
}

export function OverviewPhase({
  content,
  reasonLabel,
  estimatedTimeMin,
  onStart,
  loading,
}: OverviewPhaseProps) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          {content.subject} &rsaquo; {content.chapter}
        </p>
        <h1 className="text-2xl font-bold text-foreground">{content.topicName}</h1>
      </div>

      {reasonLabel && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
          <span className="text-xl flex-shrink-0">🎓</span>
          <p className="text-sm text-foreground">
            <span className="font-semibold">Your tutor says: </span>
            {reasonLabel}
          </p>
        </div>
      )}

      {content.summary && (
        <p className="text-sm text-muted-foreground leading-relaxed">{content.summary}</p>
      )}

      {content.objectives.length > 0 && (
        <div className="bg-card rounded-xl border p-4">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <span>📚</span> In this session you will learn:
          </h2>
          <ul className="space-y-2">
            {content.objectives.map((obj, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center flex-shrink-0 font-medium">
                  {i + 1}
                </span>
                {obj}
              </li>
            ))}
          </ul>
        </div>
      )}

      {content.upcomingPhases.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">What&apos;s ahead</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {content.upcomingPhases.map((label, i) => (
              <React.Fragment key={label}>
                <span className="px-3 py-1 bg-muted text-muted-foreground text-xs rounded-full">
                  {label}
                </span>
                {i < content.upcomingPhases.length - 1 && (
                  <svg className="w-3 h-3 text-muted-foreground flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {estimatedTimeMin && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
          </svg>
          Estimated time: {estimatedTimeMin} minutes
        </div>
      )}

      <button
        onClick={onStart}
        disabled={loading}
        className="w-full py-4 px-6 bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20 text-base"
      >
        {loading ? <span className="animate-spin">⏳</span> : (
          <>
            <span>Start Learning</span>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </>
        )}
      </button>
    </div>
  );
}

export default OverviewPhase;
