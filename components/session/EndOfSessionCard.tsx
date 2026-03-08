'use client';
/**
 * FILE OBJECTIVE:
 * - Displays the end-of-session celebration, performance summary,
 *   and next-topic recommendation card.
 * - Uses existing /api/home/next-action for recommendation (no engine changes).
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | extracted from components/Session/phases/CompletePhase.tsx
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface NextActionHint {
  topicId: string | null;
  topicName: string | null;
  reasonLabel?: string | null;
  estimatedTimeMin?: number;
}

export interface SessionPerformanceSummary {
  accuracyPercent?: number;
  practiceCompleted?: number;
  testCompleted?: number;
  masteryLabel?: string;
}

interface EndOfSessionCardProps {
  topicName: string;
  subject: string;
  /** Optional performance data; when omitted, summary still shows with placeholders. */
  performance?: SessionPerformanceSummary;
}

export function EndOfSessionCard({ topicName, subject: _subject, performance }: EndOfSessionCardProps) {
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
            reasonLabel: action.reasonLabel ?? null,
            estimatedTimeMin: action.estimatedTimeMin,
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      {/* 1. Completion headline */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground">Session Complete 🎉</h1>
        <p className="text-muted-foreground mt-2">
          You completed <span className="font-semibold text-foreground">{topicName}</span>
        </p>
      </div>

      {/* 2. Performance summary */}
      <div className="bg-card rounded-xl border p-5 text-left">
        <h2 className="text-sm font-semibold text-foreground mb-4">Performance summary</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Accuracy</dt>
            <dd className="font-medium text-foreground mt-0.5">
              {performance?.accuracyPercent != null ? `${performance.accuracyPercent}%` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Practice questions completed</dt>
            <dd className="font-medium text-foreground mt-0.5">
              {performance?.practiceCompleted != null ? performance.practiceCompleted : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Test questions completed</dt>
            <dd className="font-medium text-foreground mt-0.5">
              {performance?.testCompleted != null ? performance.testCompleted : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Mastery status</dt>
            <dd className="font-medium text-foreground mt-0.5">
              {performance?.masteryLabel ?? '—'}
            </dd>
          </div>
        </dl>
      </div>

      {/* 3. Next recommended topic card */}
      {nextAction?.topicId && nextAction.topicName && (
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20 p-5 text-left">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Next Topic
          </p>
          <h3 className="text-lg font-semibold text-foreground mb-3">{nextAction.topicName}</h3>
          {nextAction.reasonLabel && (
            <p className="text-sm text-muted-foreground mb-1">
              <span className="font-medium text-foreground/90">Reason:</span>{' '}
              {nextAction.reasonLabel}
            </p>
          )}
          {nextAction.estimatedTimeMin != null && (
            <p className="text-xs text-muted-foreground mb-4">
              Estimated time: {nextAction.estimatedTimeMin} min
            </p>
          )}
          <Link
            href={`/session/${nextAction.topicId}`}
            className="inline-flex items-center gap-2 px-5 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-colors shadow-md shadow-primary/20"
          >
            Start Next Topic
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}

      {/* 4 & 5. CTAs */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <Link
          href="/dashboard"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 border border-border bg-background hover:bg-muted/50 text-foreground font-medium rounded-xl transition-colors text-sm"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}

export default EndOfSessionCard;
