/**
 * Enforces valid session phase transitions.
 *
 * Valid transitions (linear only):
 *   EXPLANATION → PRACTICE
 *   PRACTICE    → TEST
 *   TEST        → HOMEWORK
 *   HOMEWORK    → COMPLETE
 *
 * Any other transition is rejected.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
type SessionPhase = 'EXPLANATION' | 'PRACTICE' | 'TEST' | 'HOMEWORK' | 'COMPLETE';

const VALID_TRANSITIONS: ReadonlyMap<SessionPhase, SessionPhase> = new Map([
  ['EXPLANATION', 'PRACTICE'],
  ['PRACTICE', 'TEST'],
  ['TEST', 'HOMEWORK'],
  ['HOMEWORK', 'COMPLETE'],
]);

export class InvalidTransitionError extends Error {
  status = 400;
  constructor(from: SessionPhase, to: SessionPhase) {
    super(`Invalid phase transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export interface TransitionResult {
  sessionId: string;
  previousPhase: SessionPhase;
  currentPhase: SessionPhase;
  phaseStartedAt: string;
  isComplete: boolean;
}

/**
 * Transition a structured session to the next phase.
 *
 * 1. Verifies the session exists and belongs to the student.
 * 2. Validates that `nextPhase` is the only legal successor of the current phase.
 * 3. Updates the phase and records `phaseStartedAt` in the session `meta`.
 * 4. Throws `InvalidTransitionError` for illegal transitions.
 */
export async function transitionSessionPhase(
  sessionId: string,
  nextPhase: SessionPhase,
  studentId: string,
): Promise<TransitionResult> {
  const session = await prisma.structuredSession.findFirst({
    where: { id: sessionId, studentId },
  });

  if (!session) {
    const err = new Error('Session not found');
    (err as Error & { status: number }).status = 404;
    throw err;
  }

  // Already complete — no further transitions allowed
  if (session.state === 'COMPLETE') {
    const err = new Error('Session already complete');
    (err as Error & { status: number }).status = 409;
    throw err;
  }

  const expectedNext = VALID_TRANSITIONS.get(session.state);

  if (!expectedNext || expectedNext !== nextPhase) {
    logger.warn('[INVALID_PHASE_TRANSITION]', {
      sessionId,
      studentId,
      currentPhase: session.state,
      requestedPhase: nextPhase,
      expectedPhase: expectedNext ?? 'none',
    });
    throw new InvalidTransitionError(session.state, nextPhase);
  }

  const now = new Date();
  const isComplete = nextPhase === 'COMPLETE';

  // Merge phaseStartedAt into the existing meta object
  const existingMeta = (session.meta as Record<string, unknown>) ?? {};
  const phaseTimestamps = (existingMeta.phaseTimestamps as Record<string, string>) ?? {};
  phaseTimestamps[nextPhase] = now.toISOString();

  await prisma.structuredSession.update({
    where: { id: sessionId },
    data: {
      state: nextPhase,
      ...(isComplete ? { completedAt: now } : {}),
      meta: { ...existingMeta, phaseTimestamps, phaseStartedAt: now.toISOString() },
    },
  });

  logger.info('[PHASE_TRANSITION]', {
    sessionId,
    studentId,
    from: session.state,
    to: nextPhase,
    phaseStartedAt: now.toISOString(),
  });

  return {
    sessionId,
    previousPhase: session.state,
    currentPhase: nextPhase,
    phaseStartedAt: now.toISOString(),
    isComplete,
  };
}
