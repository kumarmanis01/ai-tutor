'use client';
/**
 * FILE OBJECTIVE:
 * - Pure API call abstractions for session lifecycle operations.
 * - Components and hooks call these functions instead of writing fetch directly.
 * - No React imports — usable in both hooks and server actions if needed.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Session Architecture refactor
 */

export interface SessionActionResult {
  session: import('@/lib/session/sessionEngine').SessionView;
  phase: import('@/lib/session/sessionEngine').PhaseContent;
  content: import('@/lib/session/getPhaseContent').PhaseContentData;
}

export interface SubmitActionResult {
  score: number;
  percentage: number;
  correctAnswers: number;
  totalAnswers: number;
  results: { questionId: string; isCorrect: boolean; correctAnswer: string | null }[];
}

export async function startSessionAction(topicId: string): Promise<SessionActionResult> {
  const res = await fetch('/api/session/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topicId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to start session');
  return data as SessionActionResult;
}

export async function advancePhaseAction(sessionId: string): Promise<SessionActionResult> {
  const res = await fetch('/api/session/next', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to advance session');
  return data as SessionActionResult;
}

export async function submitPracticeAction(
  sessionId: string,
  answers: { questionId: string; answer: string }[],
): Promise<SubmitActionResult> {
  const res = await fetch(`/api/session/${sessionId}/practice/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to submit practice');
  return data as SubmitActionResult;
}

export async function submitTestAction(
  sessionId: string,
  answers: { questionId: string; answer: string }[],
): Promise<SubmitActionResult> {
  const res = await fetch(`/api/session/${sessionId}/test/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to submit test');
  return data as SubmitActionResult;
}
