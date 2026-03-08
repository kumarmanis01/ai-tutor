'use client';
/**
 * FILE OBJECTIVE:
 * - Root orchestrator for the 6-phase Spinzy learning session.
 * - Owns session lifecycle: start → advance → submit practice/test → complete.
 * - Renders SessionHeader + the correct PhaseRenderer for each state.
 * - Implements spec: "Single focus — only one learning task on screen."
 *
 * Architecture:
 *   SessionContainer
 *     ├─ SessionHeader        (sticky top: breadcrumb + phase progress bar)
 *     └─ PhaseRenderer switch
 *          ├─ OverviewPhase    (OVERVIEW)
 *          ├─ ExplanationPhase (EXPLANATION)
 *          ├─ PracticePhase    (PRACTICE)
 *          ├─ TestPhase        (TEST)
 *          ├─ HomeworkPhase    (HOMEWORK)
 *          └─ CompletePhase    (COMPLETE)
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Session Container Architecture
 */

import React, { useEffect } from 'react';
import { useStructuredSession } from '@/hooks/useStructuredSession';
import { SessionHeader } from './SessionHeader';
import { OverviewPhase } from './phases/OverviewPhase';
import { ExplanationPhase } from './phases/ExplanationPhase';
import { PracticePhase } from './phases/PracticePhase';
import { TestPhase } from './phases/TestPhase';
import { HomeworkPhase } from './phases/HomeworkPhase';
import { CompletePhase } from './phases/CompletePhase';
import type {
  OverviewContent,
  ExplanationContent,
  PracticeContent,
  TestContent,
  HomeworkContent,
} from '@/lib/session/getPhaseContent';

interface SessionContainerProps {
  topicId: string;
  /** Tutor reason from recommendation engine, passed through to OverviewPhase. */
  reasonLabel?: string | null;
  /** Estimated session time from recommendation engine. */
  estimatedTimeMin?: number;
}

export function SessionContainer({
  topicId,
  reasonLabel,
  estimatedTimeMin,
}: SessionContainerProps) {
  const {
    session,
    phase,
    content,
    loading,
    error,
    submitting,
    startSession,
    advancePhase,
    submitPractice,
    submitTest,
  } = useStructuredSession();

  // Start (or resume) session on mount
  useEffect(() => {
    startSession(topicId);
  }, [topicId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading || (!session && !error)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Starting your session…</p>
        </div>
      </div>
    );
  }

  // ── Error (engine disabled, topic not found, etc.) ────────────────────────
  if (error || !session || !phase || !content) {
    const isEngineDisabled = error?.includes('disabled');

    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-4">
          <div className="text-4xl">{isEngineDisabled ? '🔧' : '⚠️'}</div>
          <h2 className="text-lg font-semibold text-foreground">
            {isEngineDisabled ? 'Session engine is off' : 'Something went wrong'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isEngineDisabled
              ? 'The structured session engine is not enabled. Ask your admin to set ENABLE_SESSION_ENGINE=1.'
              : error ?? 'Unable to load this session. Please try again.'}
          </p>
          <a
            href="/dashboard"
            className="inline-block px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
          >
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }

  const currentPhase = session.currentPhase;

  // ── COMPLETE ──────────────────────────────────────────────────────────────
  if (currentPhase === 'COMPLETE') {
    return (
      <div className="min-h-screen bg-background">
        <SessionHeader session={session} phase={phase} />
        <CompletePhase session={session} />
      </div>
    );
  }

  // ── EXPIRED ───────────────────────────────────────────────────────────────
  if (currentPhase === 'EXPIRED') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-4">
          <div className="text-4xl">⏰</div>
          <h2 className="text-lg font-semibold text-foreground">Session expired</h2>
          <p className="text-sm text-muted-foreground">
            This session is more than 48 hours old. Start a fresh session to continue.
          </p>
          <button
            onClick={() => startSession(topicId)}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
          >
            Start New Session
          </button>
        </div>
      </div>
    );
  }

  // ── PENDING content (generating) ──────────────────────────────────────────
  if (content.type === 'pending') {
    return (
      <div className="min-h-screen bg-background">
        <SessionHeader session={session} phase={phase} />
        <div className="max-w-2xl mx-auto px-4 py-10 text-center space-y-4">
          <div className="text-4xl">⚙️</div>
          <h2 className="text-lg font-semibold text-foreground">Preparing content…</h2>
          <p className="text-sm text-muted-foreground">{content.message}</p>
          <button
            onClick={advancePhase}
            disabled={submitting}
            className="px-5 py-2.5 bg-muted text-muted-foreground rounded-lg text-sm font-medium"
          >
            Skip this phase
          </button>
        </div>
      </div>
    );
  }

  // ── Phase renderer ────────────────────────────────────────────────────────
  const renderPhase = () => {
    switch (currentPhase) {
      case 'OVERVIEW':
        return (
          <OverviewPhase
            content={content as OverviewContent}
            reasonLabel={reasonLabel}
            estimatedTimeMin={estimatedTimeMin}
            onStart={advancePhase}
            loading={submitting}
          />
        );

      case 'EXPLANATION':
        return (
          <ExplanationPhase
            content={content as ExplanationContent}
            onNext={advancePhase}
            loading={submitting}
          />
        );

      case 'PRACTICE':
        return (
          <PracticePhase
            content={content as PracticeContent}
            onSubmit={submitPractice}
            onNext={advancePhase}
            submitting={submitting}
          />
        );

      case 'TEST':
        return (
          <TestPhase
            content={content as TestContent}
            onSubmit={submitTest}
            onNext={advancePhase}
            submitting={submitting}
          />
        );

      case 'HOMEWORK':
        return (
          <HomeworkPhase
            content={content as HomeworkContent}
            onNext={advancePhase}
            loading={submitting}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <SessionHeader session={session} phase={phase} />
      <main>{renderPhase()}</main>
    </div>
  );
}

export default SessionContainer;
