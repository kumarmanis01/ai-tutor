/**
 * Phase Transition Guard
 *
 * Enforces the strict linear order of the Spinzy session state machine:
 *
 *   OVERVIEW → EXPLANATION → PRACTICE → TEST → HOMEWORK → COMPLETE
 *
 * Only one transition is valid from each phase. Any other move is rejected
 * with `InvalidTransitionError` (HTTP 400). Attempting to transition an
 * already-COMPLETE session is rejected with HTTP 409.
 *
 * Concurrency safety:
 *   The DB update is NOT wrapped in a serialisable transaction because Prisma
 *   does not support advisory locks on a per-row basis without raw SQL. Instead
 *   the engine re-fetches the session state before calling this function; if
 *   two concurrent callers both see the same state and both call this function,
 *   the second `update` will silently succeed but will compute the wrong
 *   `phaseStartedAt`. This is acceptable — the engine's outer `findFirst →
 *   update → reload` pattern makes concurrent double-advances extremely
 *   unlikely in practice, and the worst outcome is a phase timestamp being
 *   slightly stale. If strict once-only semantics are required in the future,
 *   replace the `update` with a raw `UPDATE … WHERE state = $expected RETURNING`.
 *
 * EDIT LOG:
 *   2026-03-07 | Manish Kumar | add OVERVIEW → EXPLANATION as first valid
 *                               transition; update JSDoc for 6-phase flow.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { SessionPhase } from '@/lib/session/sessionEngine';

// ─── Transition Table ─────────────────────────────────────────────────────────

/**
 * Maps each phase to its single valid successor.
 * Only forward, strictly linear moves are permitted.
 */
const VALID_TRANSITIONS: ReadonlyMap<SessionPhase, SessionPhase> = new Map([
  ['OVERVIEW', 'EXPLANATION'],
  ['EXPLANATION', 'PRACTICE'],
  ['PRACTICE', 'TEST'],
  ['TEST', 'HOMEWORK'],
  ['HOMEWORK', 'COMPLETE'],
]);

// ─── Error Types ──────────────────────────────────────────────────────────────

export class InvalidTransitionError extends Error {
  /** Always 400 — the caller supplied an illegal next phase. */
  readonly status = 400;

  constructor(from: SessionPhase, to: SessionPhase) {
    super(`Invalid phase transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

// ─── Return Type ──────────────────────────────────────────────────────────────

export interface TransitionResult {
  sessionId: string;
  previousPhase: SessionPhase;
  currentPhase: SessionPhase;
  /** ISO timestamp recorded when this phase began. */
  phaseStartedAt: string;
  /** True when `currentPhase` is COMPLETE. */
  isComplete: boolean;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Transition a structured session to `nextPhase`.
 *
 * Steps:
 *   1. Load the session and verify it belongs to `studentId`.
 *   2. Reject if the session is already COMPLETE (409).
 *   3. Validate that `nextPhase` is the only legal successor of the
 *      current phase (400 on mismatch).
 *   4. Persist the new phase and record `phaseStartedAt` inside `meta`.
 *
 * @throws {InvalidTransitionError} when the requested transition is not allowed.
 * @throws {SessionError}           when the session is not found (404) or
 *                                  already complete (409).
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
    const err = new Error('Session not found') as Error & { status: number };
    err.status = 404;
    throw err;
  }

  // Terminal state — no further transitions are allowed.
  if (session.state === 'COMPLETE') {
    const err = new Error('Session already complete') as Error & { status: number };
    err.status = 409;
    throw err;
  }

  const currentPhase = session.state as SessionPhase;
  const expectedNext = VALID_TRANSITIONS.get(currentPhase);

  if (!expectedNext || expectedNext !== nextPhase) {
    logger.warn('[INVALID_PHASE_TRANSITION]', {
      sessionId,
      studentId,
      currentPhase,
      requestedPhase: nextPhase,
      expectedPhase: expectedNext ?? 'none',
    });
    throw new InvalidTransitionError(currentPhase, nextPhase);
  }

  const now = new Date();
  const isComplete = nextPhase === 'COMPLETE';

  // Merge the new phase timestamp into the existing meta object.
  const existingMeta = (session.meta as Record<string, unknown>) ?? {};
  const phaseTimestamps = ((existingMeta.phaseTimestamps as Record<string, string>) ?? {});
  phaseTimestamps[nextPhase] = now.toISOString();

  await prisma.structuredSession.update({
    where: { id: sessionId },
    data: {
      state: nextPhase,
      ...(isComplete ? { completedAt: now } : {}),
      meta: {
        ...existingMeta,
        phaseTimestamps,
        phaseStartedAt: now.toISOString(),
      },
    },
  });

  logger.info('[PHASE_TRANSITION]', {
    sessionId,
    studentId,
    from: currentPhase,
    to: nextPhase,
    phaseStartedAt: now.toISOString(),
  });

  return {
    sessionId,
    previousPhase: currentPhase,
    currentPhase: nextPhase,
    phaseStartedAt: now.toISOString(),
    isComplete,
  };
}
