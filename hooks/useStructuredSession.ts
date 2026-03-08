'use client';
/**
 * FILE OBJECTIVE:
 * - Manages the full lifecycle of a StructuredSession in the UI.
 * - Wraps /api/session/start, /api/session/next, practice/submit, test/submit.
 * - No business logic — pure data passthrough to session engine API routes.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Session Container Architecture
 */

import { useState, useCallback } from 'react';
import type { SessionView, PhaseContent } from '@/lib/session/sessionEngine';
import type { PhaseContentData } from '@/lib/session/getPhaseContent';

export interface SubmitResult {
  score: number;
  percentage: number;
  correctAnswers: number;
  totalAnswers: number;
  results: { questionId: string; isCorrect: boolean; correctAnswer: string | null }[];
}

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

export function useStructuredSession() {
  const [state, setState] = useState<SessionState>(INITIAL);

  const startSession = useCallback(async (topicId: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState((s) => ({ ...s, loading: false, error: data.error ?? 'Failed to start session' }));
        return;
      }
      setState((s) => ({
        ...s,
        session: data.session,
        phase: data.phase,
        content: data.content,
        loading: false,
      }));
    } catch {
      setState((s) => ({ ...s, loading: false, error: 'Failed to start session' }));
    }
  }, []);

  const advancePhase = useCallback(async () => {
    const sessionId = state.session?.sessionId;
    if (!sessionId) return;
    setState((s) => ({ ...s, submitting: true, error: null }));
    try {
      const res = await fetch('/api/session/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState((s) => ({ ...s, submitting: false, error: data.error ?? 'Failed to advance' }));
        return;
      }
      setState((s) => ({
        ...s,
        session: data.session,
        phase: data.phase,
        content: data.content,
        submitting: false,
      }));
    } catch {
      setState((s) => ({ ...s, submitting: false, error: 'Failed to advance' }));
    }
  }, [state.session?.sessionId]);

  const submitPractice = useCallback(
    async (answers: { questionId: string; answer: string }[]): Promise<SubmitResult | null> => {
      const sessionId = state.session?.sessionId;
      if (!sessionId) return null;
      setState((s) => ({ ...s, submitting: true }));
      try {
        const res = await fetch(`/api/session/${sessionId}/practice/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers }),
        });
        setState((s) => ({ ...s, submitting: false }));
        if (!res.ok) return null;
        return await res.json();
      } catch {
        setState((s) => ({ ...s, submitting: false }));
        return null;
      }
    },
    [state.session?.sessionId],
  );

  const submitTest = useCallback(
    async (answers: { questionId: string; answer: string }[]): Promise<SubmitResult | null> => {
      const sessionId = state.session?.sessionId;
      if (!sessionId) return null;
      setState((s) => ({ ...s, submitting: true }));
      try {
        const res = await fetch(`/api/session/${sessionId}/test/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers }),
        });
        setState((s) => ({ ...s, submitting: false }));
        if (!res.ok) return null;
        return await res.json();
      } catch {
        setState((s) => ({ ...s, submitting: false }));
        return null;
      }
    },
    [state.session?.sessionId],
  );

  return { ...state, startSession, advancePhase, submitPractice, submitTest };
}
