'use client';
/**
 * FILE OBJECTIVE:
 * - Pure API call abstractions for session lifecycle operations.
 * - Components and hooks call these functions instead of writing fetch directly.
 * - No React imports -- usable in both hooks and server actions if needed.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Session Architecture refactor
 * - 2026-05-08 | copilot | add practice hydration status/trigger actions for pending PRACTICE fallback
 * - 2026-05-09T00:00:00Z | copilot | submit test payload now carries testId so backend grades against the displayed test version
 * - 2026-05-11T13:00:00Z | copilot | add practice more action for fresh question generation once-per-day
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

export interface PracticeHydrationStatusResult {
  hasActiveQuestions: boolean;
  isHydrationRunning: boolean;
  runningJobId: string | null;
}

export interface PracticeHydrationTriggerResult {
  enqueued: boolean;
  reason: string;
  jobId: string | null;
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

export async function navigateToPhaseAction(
  sessionId: string,
  targetPhase: string,
): Promise<SessionActionResult> {
  const res = await fetch('/api/session/back', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, targetPhase }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to navigate session');
  return data as SessionActionResult;
}

export async function submitTestAction(
  sessionId: string,
  answers: { questionId: string; answer: string }[],
  testId?: string,
): Promise<SubmitActionResult> {
  const res = await fetch(`/api/session/${sessionId}/test/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers, testId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to submit test');
  return data as SubmitActionResult;
}

export async function getPracticeHydrationStatusAction(
  sessionId: string,
): Promise<PracticeHydrationStatusResult> {
  const res = await fetch(`/api/session/${sessionId}/practice/hydrate`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to load hydration status');
  return data as PracticeHydrationStatusResult;
}

export async function triggerPracticeHydrationAction(
  sessionId: string,
): Promise<PracticeHydrationTriggerResult> {
  const res = await fetch(`/api/session/${sessionId}/practice/hydrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to enqueue practice hydration');
  return data as PracticeHydrationTriggerResult;
}

export interface PracticeMoreActionResult {
  success: boolean;
  message: string;
  questions: {
    id: string;
    type: string;
    prompt: string;
    choices: unknown;
    difficulty: string | null;
    correctAnswer: string | null;
  }[];
  sessionId: string;
}

export async function practiceMoreAction(sessionId: string): Promise<PracticeMoreActionResult> {
  const res = await fetch(`/api/session/${sessionId}/practice/more`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to fetch fresh practice questions');
  return data as PracticeMoreActionResult;
}
