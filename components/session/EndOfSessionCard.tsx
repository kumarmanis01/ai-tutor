'use client';
/**
 * FILE OBJECTIVE:
 * - Displays the end-of-session celebration, phase completion summary,
 *   and next-topic recommendation card.
 * - Extracted from CompletePhase so it can be used independently
 *   (e.g., embedded in a modal or a separate view).
 * - Closes Gap #16: "No end-of-session screen."
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | extracted from components/Session/phases/CompletePhase.tsx
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface NextActionHint {
  topicId: string | null;
  topicName: string | null;
  estimatedTimeMin?: number;
}

interface EndOfSessionCardProps {
  topicName: string;
  subject: string;
}

export function EndOfSessionCard({ topicName, subject: _subject }: EndOfSessionCardProps) {
  const [nextAction, setNextAction] = useState<NextActionHint | null>(null);

  useEffect(() => {
    fetch('/api/home/next-action')
      .then((r) => r.json())
      .then((data) => {
        const action = data?.action;
        if (action?.topicId) {
          setNextAction({
            topicId: action.topicId,
            topicName: action.topicName,
            estimatedTimeMin: action.estimatedTimeMin,
          });
        }
      })
      .catch(() => {});
  }, []);

  const phases = ['Overview', 'Learn', 'Practice', 'Quick Test', 'Homework'];

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6 text-center">
      {/* Celebration */}
      <div>
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-foreground">Great work today!</h1>
        <p className="text-sm text-muted-foreground mt-1">
          You completed <span className="font-semibold text-foreground">{topicName}</span>
        </p>
      </div>

      {/* Phase completion summary */}
      <div className="bg-card rounded-xl border p-5 text-left space-y-2">
        <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          What you did today
        </p>
        {phases.map((p) => (
          <div key={p} className="flex items-center gap-2 text-sm">
            <span className="text-green-600 font-bold flex-shrink-0">✓</span>
            <span className="text-foreground/80">{p} complete</span>
          </div>
        ))}
      </div>

      {/* Next recommended topic */}
      {nextAction?.topicId && nextAction.topicName && (
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20 p-5 text-left">
          <p className="text-xs text-muted-foreground mb-1">Recommended next</p>
          <h3 className="font-semibold text-foreground mb-1">{nextAction.topicName}</h3>
          {nextAction.estimatedTimeMin && (
            <p className="text-xs text-muted-foreground mb-4">
              Estimated time: {nextAction.estimatedTimeMin} minutes
            </p>
          )}
          <Link
            href={`/session/${nextAction.topicId}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-lg transition-colors"
          >
            Start Next Topic
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}

      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Return to Dashboard
      </Link>
    </div>
  );
}

export default EndOfSessionCard;
