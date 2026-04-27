'use client';
/**
 * FILE OBJECTIVE:
 * - Primary session lifecycle hook. Replaces hooks/useStructuredSession.ts.
 * - Uses sessionActions.ts for all API calls (no raw fetch here).
 * - Manages: start → advance → submitPractice → submitTest lifecycle.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created as part of Session Architecture refactor
 *                         (replaces hooks/useStructuredSession.ts)
 */

import { useState, useCallback } from 'react';
import {
  startSessionAction,
  advancePhaseAction,
  navigateToPhaseAction,
  submitPracticeAction,
  submitTestAction,
  type SessionActionResult,
  type SubmitActionResult,
} from '@/lib/session/sessionActions';
import type { SessionView, PhaseContent } from '@/lib/session/sessionEngine';
import type { PhaseContentData } from '@/lib/session/getPhaseContent';

interface SessionState {
  session: SessionView | null;
  phase: PhaseContent | null;
  content: PhaseContentData | null;
  loading: boolean;
  error: string | null;
  submitting: boolean;
}

const INITIAL: SessionState = {
  session: null,
  phase: null,
  content: null,
  loading: false,
  error: null,
  submitting: false,
};

function applyResult(result: SessionActionResult): Partial<SessionState> {
  return { session: result.session, phase: result.phase, content: result.content };
}

export function useSession() {
  const [state, setState] = useState<SessionState>(INITIAL);

  const startSession = useCallback(async (topicId: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const result = await startSessionAction(topicId);
      setState((s) => ({ ...s, ...applyResult(result), loading: false }));
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to start session',
      }));
    }
  }, []);

  const advancePhase = useCallback(async () => {
    const sessionId = state.session?.sessionId;
    if (!sessionId) return;
    setState((s) => ({ ...s, submitting: true, error: null }));
    try {
      const result = await advancePhaseAction(sessionId);
      setState((s) => ({ ...s, ...applyResult(result), submitting: false }));
    } catch (err) {
      setState((s) => ({
        ...s,
        submitting: false,
        error: err instanceof Error ? err.message : 'Failed to advance',
      }));
    }
  }, [state.session?.sessionId]);

  const submitPractice = useCallback(
    async (answers: { questionId: string; answer: string }[]): Promise<SubmitActionResult | null> => {
      const sessionId = state.session?.sessionId;
      if (!sessionId) return null;
      setState((s) => ({ ...s, submitting: true }));
      try {
        const result = await submitPracticeAction(sessionId, answers);
        setState((s) => ({ ...s, submitting: false }));
        return result;
      } catch {
        setState((s) => ({ ...s, submitting: false }));
        return null;
      }
    },
    [state.session?.sessionId],
  );

  const submitTest = useCallback(
    async (answers: { questionId: string; answer: string }[]): Promise<SubmitActionResult | null> => {
      const sessionId = state.session?.sessionId;
      if (!sessionId) return null;
      setState((s) => ({ ...s, submitting: true }));
      try {
        const result = await submitTestAction(sessionId, answers);
        setState((s) => ({ ...s, submitting: false }));
        return result;
      } catch {
        setState((s) => ({ ...s, submitting: false }));
        return null;
      }
    },
    [state.session?.sessionId],
  );

  const navigateToPhase = useCallback(async (targetPhase: string) => {
    const sessionId = state.session?.sessionId;
    if (!sessionId) return;
    setState((s) => ({ ...s, submitting: true, error: null }));
    try {
      const result = await navigateToPhaseAction(sessionId, targetPhase);
      setState((s) => ({ ...s, ...applyResult(result), submitting: false }));
    } catch (err) {
      setState((s) => ({
        ...s,
        submitting: false,
        error: err instanceof Error ? err.message : 'Failed to navigate',
      }));
    }
  }, [state.session?.sessionId]);

  return { ...state, startSession, advancePhase, navigateToPhase, submitPractice, submitTest };
}
