/**
 * FILE OBJECTIVE:
 * - Client hook for S2.3 practice flow: loads questions, tracks per-question feedback, and submits answers.
 *
 * LINKED UNIT TEST:
 * - tests/unit/hooks/usePractice.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created S2.3 usePractice hook
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export type PracticeQuestion = {
  id: string;
  prompt: string;
  options: Array<{ key: string; label: string }>;
  difficulty: string | null;
  hint: string;
  answerKey: string | null;
};

export type PracticeResult = {
  questionId: string;
  question: string;
  answer: string;
  isCorrect: boolean;
  correctAnswer: string | null;
  hint: string | null;
  explanation: string;
};

type RemainingPayload = {
  isPremium: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
};

function questionCacheKey(studentId: string, topicId: string): string {
  return `practice-question-cache:${studentId}:${topicId}`;
}

export function usePractice(studentId: string, topicId: string) {
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<PracticeResult[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<RemainingPayload>({
    isPremium: false,
    limit: 5,
    used: 0,
    remaining: 5,
  });

  const loadRemaining = useCallback(async () => {
    const res = await fetch(
      `/api/v1/students/${encodeURIComponent(studentId)}/practice/remaining-today`,
      { cache: 'no-store' }
    );
    if (!res.ok) return;
    const payload = (await res.json()) as RemainingPayload;
    setRemaining(payload);
  }, [studentId]);

  const loadQuestions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/content/${encodeURIComponent(topicId)}/practice?count=5`, {
        cache: 'no-store',
      });

      if (!res.ok) throw new Error(`Failed to load practice questions (${res.status})`);

      const payload = (await res.json()) as { questions: PracticeQuestion[] };
      const nextQuestions = Array.isArray(payload.questions) ? payload.questions : [];
      setQuestions(nextQuestions);

      try {
        window.localStorage.setItem(questionCacheKey(studentId, topicId), JSON.stringify(nextQuestions));
      } catch {
        // non-blocking cache write
      }
    } catch (err) {
      try {
        const raw = window.localStorage.getItem(questionCacheKey(studentId, topicId));
        if (raw) {
          const cached = JSON.parse(raw) as PracticeQuestion[];
          setQuestions(Array.isArray(cached) ? cached : []);
        }
      } catch {
        // ignore cache parse errors
      }
      setError(err instanceof Error ? err.message : 'Failed to load practice questions');
    } finally {
      setIsLoading(false);
    }
  }, [studentId, topicId]);

  useEffect(() => {
    void Promise.all([loadQuestions(), loadRemaining()]);
  }, [loadQuestions, loadRemaining]);

  const currentQuestion = useMemo(() => questions[index] ?? null, [index, questions]);

  const canShowFreemiumWall = useMemo(() => {
    if (remaining.isPremium) return false;
    if (typeof remaining.remaining !== 'number') return false;
    return remaining.remaining <= 0;
  }, [remaining]);

  const submitCurrent = useCallback(async () => {
    if (!currentQuestion || !selectedAnswer || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/students/${encodeURIComponent(studentId)}/practice/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId,
          answers: [{ questionId: currentQuestion.id, answer: selectedAnswer }],
        }),
      });

      const payload = (await res.json()) as {
        results?: PracticeResult[];
        freemium?: RemainingPayload;
        code?: string;
      };

      if (!res.ok) {
        if (payload.code === 'FREEMIUM_LIMIT_REACHED') {
          await loadRemaining();
        }
        throw new Error('Could not submit answer');
      }

      const result = payload.results?.[0];
      if (result) {
        setResults((prev) => [...prev, result]);
      }

      if (payload.freemium) {
        setRemaining({
          isPremium: payload.freemium.isPremium,
          limit: payload.freemium.limit,
          used: payload.freemium.used,
          remaining: payload.freemium.remaining,
        });
      } else {
        await loadRemaining();
      }

      setSelectedAnswer(null);
      setIndex((prev) => Math.min(prev + 1, questions.length));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit answer');
    } finally {
      setIsSubmitting(false);
    }
  }, [currentQuestion, isSubmitting, loadRemaining, questions.length, selectedAnswer, studentId, topicId]);

  const score = useMemo(() => {
    const correct = results.filter((result) => result.isCorrect).length;
    const total = results.length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { correct, total, accuracy };
  }, [results]);

  const isFinished = index >= questions.length && questions.length > 0;

  function restart() {
    setIndex(0);
    setResults([]);
    setSelectedAnswer(null);
  }

  return {
    questions,
    currentQuestion,
    index,
    isLoading,
    isSubmitting,
    error,
    selectedAnswer,
    setSelectedAnswer,
    submitCurrent,
    score,
    isFinished,
    canShowFreemiumWall,
    remaining,
    reload: loadQuestions,
    restart,
    results,
  };
}

export default usePractice;
