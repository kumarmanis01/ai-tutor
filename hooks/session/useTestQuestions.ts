'use client';
/**
 * FILE OBJECTIVE:
 * - Thin wrapper that extracts test questions from session content.
 * - Mirror of usePracticeQuestions for the TEST phase.
 * - Future: could add adaptive test selection logic here.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Session Architecture refactor
 */

import { useState } from 'react';
import type { TestContent } from '@/lib/session/getPhaseContent';

export function useTestQuestions(content: TestContent | null) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const setAnswer = (questionId: string, answer: string) =>
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));

  const answeredCount = Object.keys(answers).length;
  const totalCount = content?.questions.length ?? 0;
  const allAnswered = totalCount > 0 && answeredCount === totalCount;

  return {
    questions: content?.questions ?? [],
    isEmpty: !content || content.questions.length === 0,
    answers,
    setAnswer,
    answeredCount,
    allAnswered,
  };
}
