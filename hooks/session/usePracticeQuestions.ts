'use client';
/**
 * FILE OBJECTIVE:
 * - Thin wrapper that extracts practice questions from session content.
 * - Kept as a dedicated hook so PracticePhase has a clean data interface.
 * - When the session engine expands (e.g., adaptive question fetching),
 *   this hook is the single place to add that logic.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Session Architecture refactor
 */

import type { PracticeContent } from '@/lib/session/getPhaseContent';

export function usePracticeQuestions(content: PracticeContent | null) {
  return {
    questions: content?.questions ?? [],
    isEmpty: !content || content.questions.length === 0,
  };
}
