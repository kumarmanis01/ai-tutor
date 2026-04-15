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

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { PLANS } from '@/lib/billing/plans';

interface NextActionHint {
  topicId: string | null;
  topicName: string | null;
  reasonLabel?: string | null;
  estimatedTimeMin?: number;
}

interface FreeTierState {
  sessionsRemaining: number;
  sessionsUsed: number;
  periodStart: string;
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
  const [copied, setCopied] = useState(false);
  const [freeTier, setFreeTier] = useState<FreeTierState | null>(null);

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

  // AC-03 (F-STU-040): Check cap AFTER session ends so we know if this was the last free session.
  useEffect(() => {
    fetch('/api/student/freemium/status')
      .then((r) => r.json())
      .then((data) => {
        if (typeof data?.sessionsRemaining === 'number') {
          setFreeTier({
            sessionsRemaining: data.sessionsRemaining,
            sessionsUsed: data.sessionsUsed,
            periodStart: data.periodStart,
          });
        }
      })
      .catch(() => {});
  }, []);

  const standardMonthlyDisplay = useMemo(() => {
    try {
      const plan = PLANS.standard_monthly;
      return plan?.perMonthDisplay ?? '₹399/month';
    } catch {
      return '₹399/month';
    }
  }, []);

  /** AC-06: build plain-text summary and copy to clipboard. */
  function handleCopyShare() {
    const lines: string[] = [
      `I just completed "${topicName}" on Spinzy AI Tutor!`,
    ];
    if (performance?.accuracyPercent != null) {
      lines.push(`Accuracy: ${performance.accuracyPercent}%`);
    }
    if (performance?.practiceCompleted != null) {
      lines.push(`Questions completed: ${performance.practiceCompleted}`);
    }
    if (performance?.masteryLabel) {
      lines.push(`Mastery: ${performance.masteryLabel}`);
    }
    lines.push('Keep learning at spinzy.com');
    const text = lines.join('\n');

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }).catch(() => {});
    }
  }

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
              {performance?.accuracyPercent != null ? `${performance.accuracyPercent}%` : '--'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Practice questions completed</dt>
            <dd className="font-medium text-foreground mt-0.5">
              {performance?.practiceCompleted != null ? performance.practiceCompleted : '--'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Test questions completed</dt>
            <dd className="font-medium text-foreground mt-0.5">
              {performance?.testCompleted != null ? performance.testCompleted : '--'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Mastery status</dt>
            <dd className="font-medium text-foreground mt-0.5">
              {performance?.masteryLabel ?? '--'}
            </dd>
          </div>
        </dl>
      </div>

      {/* 3. AC-05: Study-again-tomorrow prompt */}
      <div className="rounded-xl bg-[#EAF3DE] dark:bg-[#1D9E75]/10 border border-[#1D9E75]/30 px-4 py-3 text-center">
        <p className="text-sm font-semibold text-[#1D9E75] dark:text-green-400 mb-0.5">
          Great session! Come back tomorrow to keep growing.
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Daily practice is how champions are made -- your best is still ahead.
        </p>
      </div>

      {/* 4. Next recommended topic card */}
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

      {/* AC-03 (F-STU-040): Upgrade nudge shown at session end when cap is hit.
          Never interrupts an in-progress session -- only shown here in COMPLETE state. */}
      {freeTier !== null && freeTier.sessionsRemaining === 0 && (() => {
        const resetDate = new Date(freeTier.periodStart);
        resetDate.setMonth(resetDate.getMonth() + 1);
        const resetLabel = resetDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
        return (
          <div className="rounded-xl border border-[#534AB7]/30 bg-[#EEEDFE] dark:bg-[#534AB7]/10 px-4 py-4">
            <p className="text-sm font-semibold text-[#534AB7] dark:text-indigo-300 mb-1">
              You&apos;ve used all {freeTier.sessionsUsed} free sessions this month
            </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              Sessions reset on {resetLabel}. Upgrade for unlimited access to Teacher Vidya — {standardMonthlyDisplay}.
            </p>
            <a
              href="/dashboard#upgrade-section"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#534AB7] px-5 text-sm font-semibold text-white hover:bg-[#4338a3] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#534AB7]"
            >
              View plans — {standardMonthlyDisplay}
            </a>
          </div>
        );
      })()}

      {/* 5 & 6. CTAs */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <Link
          href="/dashboard"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 border border-border bg-background hover:bg-muted/50 text-foreground font-medium rounded-xl transition-colors text-sm min-h-[44px]"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Return to Dashboard
        </Link>

        {/* AC-06: copy-to-clipboard shareable summary */}
        <button
          type="button"
          onClick={handleCopyShare}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 border border-[#534AB7]/40 bg-[#EEEDFE] dark:bg-[#534AB7]/15 hover:bg-[#534AB7]/20 text-[#534AB7] dark:text-indigo-300 font-medium rounded-xl transition-colors text-sm min-h-[44px]"
        >
          {copied ? (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Share results
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default EndOfSessionCard;
