'use client';
/**
 * FILE OBJECTIVE:
 * - Root orchestrator for the 6-phase Spinzy learning session.
 * - Uses phaseRouter() to resolve the active phase component -- no switch statement here.
 * - Uses SessionLayout for consistent header/footer shell.
 * - Uses useSession() hook for all API lifecycle calls.
 *
 * Architecture (per spec):
 *   SessionContainer
 *     ├─ useSession()        -- data
 *     ├─ phaseRouter()       -- component resolution
 *     └─ SessionLayout       -- UI frame
 *          ├─ SessionHeader  -- breadcrumb + progress bar
 *          └─ PhaseComponent -- the active phase
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | refactored to use phaseRouter + SessionLayout + useSession
 *                          (was components/Session/SessionContainer.tsx)
 */

import React, { useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from '@/hooks/session/useSession';
import { phaseRouter } from '@/lib/session/phaseRouter';
import { SessionLayout } from './SessionLayout';
import { EndOfSessionCard } from './EndOfSessionCard';
import type {
  OverviewContent,
  ExplanationContent,
  PracticeContent,
  TestContent,
  HomeworkContent,
} from '@/lib/session/getPhaseContent';
import type { SessionPhaseClient } from '@/lib/session/phaseConfig';

const FOOTER_LABELS: Record<SessionPhaseClient, string> = {
  OVERVIEW: 'Start Learning',
  EXPLANATION: 'Start Practice',
  PRACTICE: 'Continue',
  TEST: 'Submit Test',
  HOMEWORK: 'Finish Session',
  COMPLETE: 'Next',
  EXPIRED: 'Next',
};

interface SessionContainerProps {
  topicId: string;
  reasonLabel?: string | null;
  estimatedTimeMin?: number;
}

export function SessionContainer({ topicId, reasonLabel, estimatedTimeMin }: SessionContainerProps) {
  const {
    session, phase, content,
    loading, error, submitting,
    startSession, advancePhase, navigateToPhase, submitPractice, submitTest,
  } = useSession();

  const [phaseReadyToProceed, setPhaseReadyToProceed] = React.useState(false);
  const [testAllAnswered, setTestAllAnswered] = React.useState(false);
  const [testResultSet, setTestResultSet] = React.useState(false);
  const testSubmitHandlerRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    startSession(topicId);
  }, [topicId]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentPhaseKey = session?.currentPhase as SessionPhaseClient | undefined;
  useEffect(() => {
    if (currentPhaseKey == null) return;
    setPhaseReadyToProceed(false);
    setTestAllAnswered(false);
    setTestResultSet(false);
    testSubmitHandlerRef.current = null;
    if (currentPhaseKey === 'OVERVIEW' || currentPhaseKey === 'EXPLANATION' || currentPhaseKey === 'HOMEWORK') {
      setPhaseReadyToProceed(true);
    }
  }, [currentPhaseKey]);

  const onReadyToProceed = useCallback((ready: boolean) => setPhaseReadyToProceed(ready), []);
  const onTestStateChange = useCallback((allAnswered: boolean, resultSet: boolean) => {
    setTestAllAnswered(allAnswered);
    setTestResultSet(resultSet);
  }, []);
  const onRegisterTestSubmit = useCallback((handler: (() => Promise<void>) | null) => {
    testSubmitHandlerRef.current = handler;
  }, []);
  const handleFooterCTA = useCallback(async () => {
    const phase = session?.currentPhase as SessionPhaseClient | undefined;
    if (phase === 'TEST' && !testResultSet && testSubmitHandlerRef.current) {
      await testSubmitHandlerRef.current();
      return;
    }
    advancePhase();
  }, [session?.currentPhase, testResultSet, advancePhase]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading || (!session && !error)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Starting your session...</p>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
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
              ? 'Set ENABLE_SESSION_ENGINE=1 to enable structured sessions.'
              : error ?? 'Unable to load this session.'}
          </p>
          <Link href="/dashboard" className="inline-block px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const currentPhase = session.currentPhase as SessionPhaseClient;

  // ── Terminal: COMPLETE ────────────────────────────────────────────────────
  if (currentPhase === 'COMPLETE') {
    return (
      <SessionLayout session={session} phase={phase}>
        <EndOfSessionCard topicName={session.topicName} subject={session.subject} />
      </SessionLayout>
    );
  }

  // ── Terminal: EXPIRED ─────────────────────────────────────────────────────
  if (currentPhase === 'EXPIRED') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-4">
          <div className="text-4xl">⏰</div>
          <h2 className="text-lg font-semibold text-foreground">Session expired</h2>
          <p className="text-sm text-muted-foreground">Start a fresh session to continue.</p>
          <button onClick={() => startSession(topicId)} className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
            Start New Session
          </button>
        </div>
      </div>
    );
  }

  // ── Pending content ───────────────────────────────────────────────────────
  if (content.type === 'pending') {
    return (
      <SessionLayout session={session} phase={phase}>
        <div className="max-w-2xl mx-auto px-4 py-10 text-center space-y-4">
          <div className="text-4xl">⚙️</div>
          <h2 className="text-lg font-semibold text-foreground">Preparing content...</h2>
          <p className="text-sm text-muted-foreground">{content.message}</p>
          <button onClick={advancePhase} disabled={submitting} className="px-5 py-2.5 bg-muted text-muted-foreground rounded-lg text-sm">
            Skip this phase
          </button>
        </div>
      </SessionLayout>
    );
  }

  // ── Resolve phase component via phaseRouter ───────────────────────────────
  const PhaseComponent = phaseRouter(currentPhase);

  if (!PhaseComponent) return null;

  const phaseProps = buildPhaseProps(
    currentPhase, content, session.topicName,
    reasonLabel, estimatedTimeMin,
    advancePhase, submitPractice, submitTest, submitting,
    onReadyToProceed, onTestStateChange, onRegisterTestSubmit,
  );

  const footerLabel = currentPhase === 'TEST' && testResultSet ? 'Continue' : FOOTER_LABELS[currentPhase];
  const footerDisabled = currentPhase === 'TEST' && !testResultSet ? !testAllAnswered : !phaseReadyToProceed;

  const footer = {
    nextLabel: footerLabel,
    onNext: handleFooterCTA,
    nextDisabled: footerDisabled,
    loading: submitting,
    showPrevious: false,
  };

  return (
    <SessionLayout session={session} phase={phase} footer={footer} onStepClick={navigateToPhase}>
      <PhaseComponent {...phaseProps} />
    </SessionLayout>
  );
}

// ─── Props builder ─────────────────────────────────────────────────────────
// Keeps the render function clean; each phase gets exactly the props it needs.
// Phases signal readiness via onReadyToProceed; footer in SessionLayout handles the CTA.

function buildPhaseProps(
  phase: SessionPhaseClient,
  content: import('@/lib/session/getPhaseContent').PhaseContentData,
  topicName: string,
  reasonLabel: string | null | undefined,
  estimatedTimeMin: number | undefined,
  advancePhase: () => Promise<void>,
  submitPractice: (a: { questionId: string; answer: string }[]) => Promise<import('@/lib/session/sessionActions').SubmitActionResult | null>,
  submitTest: (a: { questionId: string; answer: string }[]) => Promise<import('@/lib/session/sessionActions').SubmitActionResult | null>,
  submitting: boolean,
  onReadyToProceed: (ready: boolean) => void,
  onTestStateChange: (allAnswered: boolean, resultSet: boolean) => void,
  onRegisterTestSubmit: (handler: (() => Promise<void>) | null) => void,
): Record<string, unknown> {
  switch (phase) {
    case 'OVERVIEW':
      return {
        content: content as OverviewContent,
        reasonLabel, estimatedTimeMin,
        onReadyToProceed, loading: submitting,
      };
    case 'EXPLANATION':
      return {
        content: content as ExplanationContent,
        topicName, onReadyToProceed, loading: submitting,
      };
    case 'PRACTICE':
      return {
        content: content as PracticeContent,
        topicName, onSubmit: submitPractice, onReadyToProceed, submitting,
      };
    case 'TEST':
      return {
        content: content as TestContent,
        topicName, onSubmit: submitTest, onReadyToProceed, onTestStateChange, onRegisterTestSubmit, submitting,
      };
    case 'HOMEWORK':
      return {
        content: content as HomeworkContent,
        onReadyToProceed, loading: submitting,
      };
    default:
      return {};
  }
}

export default SessionContainer;
