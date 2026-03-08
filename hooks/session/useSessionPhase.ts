'use client';
/**
 * FILE OBJECTIVE:
 * - Lightweight hook for local phase UI state (e.g., current question index).
 * - Keeps phase-specific UI state out of the main useSession hook.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Session Architecture refactor
 */

import { useState, useCallback } from 'react';

export function useSessionPhase() {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);

  const nextQuestion = useCallback(() => setQuestionIndex((i) => i + 1), []);
  const resetPhase = useCallback(() => {
    setQuestionIndex(0);
    setShowResults(false);
  }, []);
  const revealResults = useCallback(() => setShowResults(true), []);

  return { questionIndex, showResults, nextQuestion, resetPhase, revealResults };
}
