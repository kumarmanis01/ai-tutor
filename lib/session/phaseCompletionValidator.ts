/**
 * PhaseCompletionValidator -- ABSTRACTION-02
 *
 * Validates that phase completion requirements are met before allowing
 * advanceSession to transition to the next phase.
 *
 * Rules:
 *   EXPLANATION → must be viewed (meta.explanationViewed)
 *   PRACTICE    → must answer ≥1 question (meta.practiceResult.totalAnswers >= 1)
 *   TEST        → must submit answers (meta.testResult exists)
 *   HOMEWORK    → must submit (HomeworkAssignment.status in SUBMITTED | GRADED)
 *
 * OVERVIEW and COMPLETE have no completion requirements for advancing.
 */

import { prisma } from '@/lib/prisma';
import type { SessionPhase } from '@/lib/session/sessionEngine';

export interface PhaseCompletionResult {
  valid: boolean;
  message?: string;
}

interface SessionWithMeta {
  id: string;
  state: string;
  meta: unknown;
}

/**
 * Validates that the current phase's completion requirements are met
 * before allowing advance to the next phase.
 *
 * @param currentPhase - The phase the student is leaving
 * @param session     - The session record (must include meta)
 * @param sessionId   - Session ID (for homework lookup)
 * @param studentId   - Student ID (for homework lookup)
 */
export async function validatePhaseCompletion(
  currentPhase: SessionPhase,
  session: SessionWithMeta,
  sessionId: string,
  studentId: string,
): Promise<PhaseCompletionResult> {
  switch (currentPhase) {
    case 'OVERVIEW':
    case 'COMPLETE':
    case 'EXPIRED':
      return { valid: true };

    case 'EXPLANATION': {
      const meta = (session.meta as Record<string, unknown>) ?? {};
      const viewed = meta.explanationViewed === true;
      if (!viewed) {
        return {
          valid: false,
          message: 'Please view the topic explanation before continuing.',
        };
      }
      return { valid: true };
    }

    case 'PRACTICE': {
      const meta = (session.meta as Record<string, unknown>) ?? {};
      const practiceResult = meta.practiceResult as
        | { totalAnswers?: number }
        | undefined;
      const totalAnswers = practiceResult?.totalAnswers ?? 0;
      if (totalAnswers < 1) {
        return {
          valid: false,
          message: 'Please answer at least one practice question before continuing.',
        };
      }
      return { valid: true };
    }

    case 'TEST': {
      const meta = (session.meta as Record<string, unknown>) ?? {};
      const hasTestResult = !!meta.testResult;
      if (!hasTestResult) {
        return {
          valid: false,
          message: 'Please submit your test answers before continuing.',
        };
      }
      return { valid: true };
    }

    case 'HOMEWORK': {
      const hw = await prisma.homeworkAssignment.findFirst({
        where: { sessionId, studentId },
        orderBy: { createdAt: 'desc' },
        select: { status: true },
      });
      const submitted =
        hw?.status === 'SUBMITTED' || hw?.status === 'GRADED';
      if (!submitted) {
        return {
          valid: false,
          message: 'Please submit your homework before continuing.',
        };
      }
      return { valid: true };
    }
  }
}

/**
 * Marks the explanation as viewed in session meta.
 * Call when the student fetches session content in EXPLANATION phase.
 */
export async function markExplanationViewed(sessionId: string): Promise<void> {
  try {
    const session = await prisma.structuredSession.findUnique({
      where: { id: sessionId },
      select: { meta: true },
    });
    if (!session) return;
    const meta = (session.meta as Record<string, unknown>) ?? {};
    if (meta.explanationViewed === true) return; // already marked

    await prisma.structuredSession.update({
      where: { id: sessionId },
      data: {
        meta: { ...meta, explanationViewed: true },
      },
    });
  } catch (err) {
    // Fire-and-forget; log but do not propagate
    const { logger } = await import('@/lib/logger');
    logger.warn('[PHASE_VALIDATOR] markExplanationViewed failed', {
      sessionId,
      error: String(err),
    });
  }
}
