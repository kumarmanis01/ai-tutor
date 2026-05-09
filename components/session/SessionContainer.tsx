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
 * - 2026-05-08 | copilot | replace pending PRACTICE skip CTA with hydrate status + manual generate + polling refresh
 * - 2026-05-09T00:00:00Z | copilot | submit TEST answers with testId to keep backend grading aligned with displayed test version
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
  initialFocus?: { focus?: string; itemId?: string };
}

export function SessionContainer({
  topicId,
  reasonLabel,
  estimatedTimeMin,
  initialFocus,
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
    navigateToPhase,
    submitPractice,
    submitTest,
    getPracticeHydrationStatus,
    triggerPracticeHydration,
  } = useSession();

  const [phaseReadyToProceed, setPhaseReadyToProceed] = React.useState(false);
  const [testAllAnswered, setTestAllAnswered] = React.useState(false);
  const [testResultSet, setTestResultSet] = React.useState(false);
  const [practicePendingStatus, setPracticePendingStatus] = React.useState<{
    isChecking: boolean;
    isGenerating: boolean;
    hasActiveQuestions: boolean;
    isHydrationRunning: boolean;
    runningJobId: string | null;
    errorMessage: string | null;
  }>({
    isChecking: false,
    isGenerating: false,
    hasActiveQuestions: false,
    isHydrationRunning: false,
    runningJobId: null,
    errorMessage: null,
  });
  const [practicePollingSeed, setPracticePollingSeed] = React.useState(0);
  const practiceAutoTriggerAttemptedRef = useRef<string | null>(null);
  const testSubmitHandlerRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    // If a deep-link focus.itemId is provided (e.g., ?focus=next&itemId=...), prefer it.
    const initialTopic = initialFocus?.itemId ?? topicId;
    startSession(initialTopic);
  }, [topicId, initialFocus?.itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentPhaseKey = session?.currentPhase as SessionPhaseClient | undefined;
  useEffect(() => {
    if (currentPhaseKey == null) return;
    setPhaseReadyToProceed(false);
    setTestAllAnswered(false);
    setTestResultSet(false);
    testSubmitHandlerRef.current = null;
    if (
      currentPhaseKey === 'OVERVIEW' ||
      currentPhaseKey === 'EXPLANATION' ||
      currentPhaseKey === 'HOMEWORK'
    ) {
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

  React.useEffect(() => {
    if (!session || !content || content.type !== 'pending' || session.currentPhase !== 'PRACTICE') {
      return;
    }

    let isCancelled = false;
    let timeoutRef: ReturnType<typeof setTimeout> | null = null;
    let pollAttempt = 0;

    const schedulePoll = (delayMs: number) => {
      timeoutRef = setTimeout(() => {
        void pollHydrationStatus();
      }, delayMs);
    };

    const pollHydrationStatus = async () => {
      if (isCancelled) return;

      setPracticePendingStatus((prev) => ({ ...prev, isChecking: true, errorMessage: null }));
      const status = await getPracticeHydrationStatus();
      if (!status || isCancelled) {
        setPracticePendingStatus((prev) => ({
          ...prev,
          isChecking: false,
          errorMessage: 'Unable to check question generation status right now.',
        }));
        return;
      }

      setPracticePendingStatus((prev) => ({
        ...prev,
        isChecking: false,
        hasActiveQuestions: status.hasActiveQuestions,
        isHydrationRunning: status.isHydrationRunning,
        runningJobId: status.runningJobId,
      }));

      if (status.hasActiveQuestions) {
        void startSession(topicId);
        return;
      }

      // Auto-trigger generation once per sessionId when PRACTICE is pending and no job is running.
      if (!status.isHydrationRunning && session?.sessionId) {
        const alreadyAttemptedForSession =
          practiceAutoTriggerAttemptedRef.current === session.sessionId;
        if (!alreadyAttemptedForSession) {
          practiceAutoTriggerAttemptedRef.current = session.sessionId;
          setPracticePendingStatus((prev) => ({ ...prev, isGenerating: true, errorMessage: null }));
          const autoResult = await triggerPracticeHydration();
          if (isCancelled) return;

          if (!autoResult) {
            setPracticePendingStatus((prev) => ({
              ...prev,
              isGenerating: false,
              errorMessage: 'Auto-generation could not start. You can trigger it manually.',
            }));
            return;
          }

          const generationStarted =
            autoResult.reason === 'enqueued' || autoResult.reason === 'already_running';
          setPracticePendingStatus((prev) => ({
            ...prev,
            isGenerating: false,
            isHydrationRunning: generationStarted,
            runningJobId: autoResult.jobId,
            errorMessage: null,
          }));

          if (generationStarted) {
            pollAttempt += 1;
            const firstBackoff = Math.min(15000, 2000 * 2 ** Math.min(pollAttempt, 3));
            schedulePoll(firstBackoff);
          }
          return;
        }
      }

      if (status.isHydrationRunning) {
        pollAttempt += 1;
        const backoff = Math.min(15000, 2000 * 2 ** Math.min(pollAttempt, 3));
        schedulePoll(backoff);
      }
    };

    void pollHydrationStatus();

    return () => {
      isCancelled = true;
      if (timeoutRef) clearTimeout(timeoutRef);
    };
  }, [
    session,
    content,
    getPracticeHydrationStatus,
    startSession,
    topicId,
    practicePollingSeed,
    triggerPracticeHydration,
  ]);

  const handleGeneratePracticeQuestions = useCallback(async () => {
    setPracticePendingStatus((prev) => ({ ...prev, isGenerating: true, errorMessage: null }));
    const result = await triggerPracticeHydration();

    if (!result) {
      setPracticePendingStatus((prev) => ({
        ...prev,
        isGenerating: false,
        errorMessage: 'Could not start question generation. Please try again.',
      }));
      return;
    }

    setPracticePendingStatus((prev) => ({
      ...prev,
      isGenerating: false,
      isHydrationRunning: result.reason === 'enqueued' || result.reason === 'already_running',
      runningJobId: result.jobId,
      errorMessage: null,
    }));

    setPracticePollingSeed((v) => v + 1);
  }, [triggerPracticeHydration]);

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
              : (error ?? 'Unable to load this session.')}
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
          >
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

  // ── Pending content ───────────────────────────────────────────────────────
  if (content.type === 'pending') {
    if (currentPhase === 'PRACTICE') {
      return (
        <SessionLayout session={session} phase={phase}>
          <div className="max-w-2xl mx-auto px-4 py-10 text-center space-y-4">
            <div className="text-4xl">⚙️</div>
            <h2 className="text-lg font-semibold text-foreground">Practice questions are not ready yet</h2>
            <p className="text-sm text-muted-foreground">
              No practice questions are currently available for this topic. Click the button below to generate a fresh practice set.
            </p>
            {practicePendingStatus.isHydrationRunning && (
              <p className="text-xs text-muted-foreground">
                We are generating your practice questions now. This page refreshes automatically when they are ready.
              </p>
            )}
            {practicePendingStatus.errorMessage && (
              <p className="text-xs text-red-600">{practicePendingStatus.errorMessage}</p>
            )}
            <button
              onClick={handleGeneratePracticeQuestions}
              disabled={
                submitting ||
                practicePendingStatus.isGenerating ||
                practicePendingStatus.isHydrationRunning ||
                practicePendingStatus.isChecking
              }
              className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-60"
            >
              {practicePendingStatus.isGenerating || practicePendingStatus.isHydrationRunning
                ? 'Generating practice questions...'
                : 'Generate Practice Questions'}
            </button>
          </div>
        </SessionLayout>
      );
    }

    return (
      <SessionLayout session={session} phase={phase}>
        <div className="max-w-2xl mx-auto px-4 py-10 text-center space-y-4">
          <div className="text-4xl">⚙️</div>
          <h2 className="text-lg font-semibold text-foreground">Preparing content...</h2>
          <p className="text-sm text-muted-foreground">{content.message}</p>
        </div>
      </SessionLayout>
    );
  }

  // ── Resolve phase component via phaseRouter ───────────────────────────────
  const PhaseComponent = phaseRouter(currentPhase);

  if (!PhaseComponent) return null;

  const phaseProps = buildPhaseProps(
    currentPhase,
    content,
    session.topicName,
    reasonLabel,
    estimatedTimeMin,
    advancePhase,
    submitPractice,
    submitTest,
    submitting,
    onReadyToProceed,
    onTestStateChange,
    onRegisterTestSubmit
  );

  const footerLabel =
    currentPhase === 'TEST' && testResultSet ? 'Continue' : FOOTER_LABELS[currentPhase];
  const footerDisabled =
    currentPhase === 'TEST' && !testResultSet ? !testAllAnswered : !phaseReadyToProceed;

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
  submitPractice: (
    a: { questionId: string; answer: string }[]
  ) => Promise<import('@/lib/session/sessionActions').SubmitActionResult | null>,
  submitTest: (
    testId: string,
    a: { questionId: string; answer: string }[]
  ) => Promise<import('@/lib/session/sessionActions').SubmitActionResult | null>,
  submitting: boolean,
  onReadyToProceed: (ready: boolean) => void,
  onTestStateChange: (allAnswered: boolean, resultSet: boolean) => void,
  onRegisterTestSubmit: (handler: (() => Promise<void>) | null) => void
): Record<string, unknown> {
  switch (phase) {
    case 'OVERVIEW':
      return {
        content: content as OverviewContent,
        reasonLabel,
        estimatedTimeMin,
        onReadyToProceed,
        loading: submitting,
      };
    case 'EXPLANATION':
      return {
        content: content as ExplanationContent,
        topicName,
        onReadyToProceed,
        loading: submitting,
      };
    case 'PRACTICE':
      return {
        content: content as PracticeContent,
        topicName,
        onSubmit: submitPractice,
        onReadyToProceed,
        submitting,
      };
    case 'TEST':
      return {
        content: content as TestContent,
        topicName,
        onSubmit: (answers: { questionId: string; answer: string }[]) =>
          submitTest((content as TestContent).testId, answers),
        onReadyToProceed,
        onTestStateChange,
        onRegisterTestSubmit,
        submitting,
      };
    case 'HOMEWORK':
      return {
        content: content as HomeworkContent,
        onReadyToProceed,
        loading: submitting,
      };
    default:
      return {};
  }
}

export default SessionContainer;