/**
 * Structured Learning Session Engine
 *
 * Implements the 6-phase learning flow defined in the Spinzy architecture:
 *
 *   OVERVIEW → EXPLANATION → PRACTICE → TEST → HOMEWORK → COMPLETE
 *
 * Design principles:
 *   1. The engine owns all state transitions — callers never mutate state directly.
 *   2. Starting a session on a topic that already has an in-progress session
 *      resumes that session rather than creating a duplicate.
 *   3. `completeSession()` persists a STUDY-type progress touch so the
 *      TopicRanker's recency signal stays accurate.
 *   4. All bridge operations to LearningSession are fire-and-forget so they
 *      cannot crash the primary session flow.
 *   5. Concurrent advance attempts are safe: `transitionSessionPhase` performs
 *      a guarded DB write that will fail for the second caller.
 *
 * Phase overview:
 *   OVERVIEW     – Student reads a topic summary and learning objectives.
 *                  Acts as an intentional entry gate; student must confirm before proceeding.
 *   EXPLANATION  – Full topic notes are displayed for deep reading.
 *   PRACTICE     – 5 practice questions drawn from the question bank.
 *   TEST         – A generated test (approved or draft fallback).
 *   HOMEWORK     – A homework assignment generated automatically on entry.
 *   COMPLETE     – Session closed; progress persisted; celebration shown.
 *
 * EDIT LOG:
 *   2026-03-07 | Manish Kumar | full rewrite: add OVERVIEW phase, move progress
 *                               update into engine, centralise StudentTopicProgress
 *                               touch, strengthen error handling and JSDoc.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { generateHomework } from '@/lib/session/homework';
import { transitionSessionPhase, InvalidTransitionError } from '@/lib/session/transitionSessionPhase';
import { updateStudentTopicProgress } from '@/lib/learning/updateTopicProgress';
import { invalidateTopicRankerCache } from '@/lib/recommendations/topicRanker';

// ─── Phase Order ──────────────────────────────────────────────────────────────

/**
 * Canonical phase sequence. The index of each phase is used to compute
 * `phaseIndex` and `totalPhases` in `SessionView`.
 * COMPLETE is included in the array but excluded from the displayed step count
 * (see `DISPLAYABLE_PHASES`).
 */
export type SessionPhase =
  | 'OVERVIEW'
  | 'EXPLANATION'
  | 'PRACTICE'
  | 'TEST'
  | 'HOMEWORK'
  | 'COMPLETE';

const PHASE_ORDER: SessionPhase[] = [
  'OVERVIEW',
  'EXPLANATION',
  'PRACTICE',
  'TEST',
  'HOMEWORK',
  'COMPLETE',
];

/** Phases shown in the progress bar (excludes COMPLETE which is a terminal state). */
const DISPLAYABLE_PHASES = PHASE_ORDER.filter((p) => p !== 'COMPLETE');

const PHASE_INDEX = new Map(PHASE_ORDER.map((p, i) => [p, i]));

/** Returns the next phase in the sequence, or the current one when at COMPLETE. */
function nextPhase(current: SessionPhase): SessionPhase {
  const idx = PHASE_INDEX.get(current) ?? 0;
  return PHASE_ORDER[Math.min(idx + 1, PHASE_ORDER.length - 1)];
}

// ─── Feature Flag ────────────────────────────────────────────────────────────

/**
 * Guards all session engine operations.
 * Set `ENABLE_SESSION_ENGINE=1` (or `true`) in the environment to enable.
 */
export function isSessionEngineEnabled(): boolean {
  const flag = process.env.ENABLE_SESSION_ENGINE;
  return flag === '1' || flag === 'true';
}

// ─── Public Types ─────────────────────────────────────────────────────────────

/**
 * The canonical view of a StructuredSession returned by every engine operation.
 *
 * `currentPhase` is the authoritative field (per the architecture spec).
 * `state` is kept as an alias for backward-compatibility with existing
 * API consumers that were written before the spec rename.
 */
export interface SessionView {
  sessionId: string;
  /** The student who owns this session. */
  studentId: string;
  topicId: string;
  topicName: string;
  subject: string;
  chapter: string;
  /**
   * Canonical phase name (architecture spec).
   * One of: OVERVIEW | EXPLANATION | PRACTICE | TEST | HOMEWORK | COMPLETE
   */
  currentPhase: SessionPhase;
  /**
   * Backward-compatible alias for `currentPhase`.
   * New code should read `currentPhase`.
   */
  state: SessionPhase;
  /** 0-based index of the current phase among displayable phases. */
  phaseIndex: number;
  /** Total number of displayable phases (excludes COMPLETE). */
  totalPhases: number;
  startedAt: string;
  completedAt: string | null;
  /**
   * Set when the engine auto-generates a HomeworkAssignment on entering
   * the HOMEWORK phase. Null for all other phases.
   */
  homeworkId: string | null;
}

/** Describes the UI label and student-facing instruction for a phase. */
export interface PhaseContent {
  phase: SessionPhase;
  label: string;
  instruction: string;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Start (or resume) a structured learning session for `topicId`.
 *
 * - If the student already has an in-progress session for this topic it is
 *   returned immediately (idempotent).
 * - New sessions begin at the OVERVIEW phase.
 * - A bridged LearningSession is created so the recommendation engine receives
 *   recency and engagement signals.
 */
export async function startSession(
  studentId: string,
  topicId: string,
): Promise<SessionView> {
  // ── Resume existing session if one is in progress ───────────────────────
  const existing = await prisma.structuredSession.findFirst({
    where: { studentId, topicId, state: { not: 'COMPLETE' } },
    include: topicInclude,
  });

  if (existing) {
    // Keep the bridged LearningSession's lastAccessed fresh.
    touchBridgedLearningSession(existing.id).catch((err) =>
      logger.warn('[SESSION_BRIDGE_TOUCH_FAILED]', { sessionId: existing.id, error: err }),
    );

    logger.info('[SESSION_RESUMED]', {
      studentId,
      sessionId: existing.id,
      topicId,
      currentPhase: existing.state,
    });

    return toSessionView(existing);
  }

  // ── Create new session starting at OVERVIEW ─────────────────────────────
  const session = await prisma.structuredSession.create({
    data: {
      studentId,
      topicId,
      state: 'OVERVIEW',
      meta: { phaseTimestamps: { OVERVIEW: new Date().toISOString() } },
    },
    include: topicInclude,
  });

  // Bridge to LearningSession — fire-and-forget.
  createBridgedLearningSession(studentId, topicId, session.id).catch((err) =>
    logger.error('[SESSION_BRIDGE_CREATE_FAILED]', { sessionId: session.id, error: err }),
  );

  logger.info('[SESSION_STARTED]', { studentId, sessionId: session.id, topicId });

  return toSessionView(session);
}

/**
 * Advance the session to the next phase.
 *
 * Uses `transitionSessionPhase` which performs a guarded DB write — if two
 * concurrent requests both try to advance the same session the second write
 * will fail (session state will have already changed), surfacing a 409.
 *
 * Side-effects on specific transitions:
 *   → HOMEWORK: auto-generates a HomeworkAssignment and returns its id.
 *   → COMPLETE: persists a STUDY progress touch and invalidates the
 *               TopicRanker cache so the next dashboard load reflects the
 *               updated recency signal.
 */
export async function advanceSession(
  studentId: string,
  sessionId: string,
): Promise<SessionView> {
  const session = await prisma.structuredSession.findFirst({
    where: { id: sessionId, studentId },
    include: topicInclude,
  });

  if (!session) {
    throw new SessionError('Session not found', 404);
  }

  // No-op: already complete.
  if (session.state === 'COMPLETE') {
    return toSessionView(session);
  }

  const next = nextPhase(session.state as SessionPhase);

  // Validated, guarded transition — throws InvalidTransitionError on illegal moves.
  let transition;
  try {
    transition = await transitionSessionPhase(sessionId, next, studentId);
  } catch (err) {
    if (err instanceof InvalidTransitionError) {
      throw new SessionError(err.message, err.status);
    }
    throw err;
  }

  // Reload the full record after the transition so we return accurate state.
  const updated = await prisma.structuredSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: topicInclude,
  });

  // ── Phase-specific side-effects ─────────────────────────────────────────

  let homeworkId: string | null = null;

  if (next === 'HOMEWORK') {
    // Auto-generate homework on entry to HOMEWORK phase.
    try {
      const hw = await generateHomework(studentId, updated.topicId, sessionId);
      homeworkId = hw.id;
      logger.info('[SESSION_HOMEWORK_GENERATED]', { sessionId, homeworkId, studentId });
    } catch (err) {
      // Non-fatal: student still sees the homework phase, just without questions.
      logger.warn('[SESSION_HOMEWORK_SKIP]', { sessionId, error: err });
    }
  }

  if (transition.isComplete) {
    // Persist progress and invalidate the ranker cache — fire-and-forget
    // so they don't block the response.
    persistCompletionProgress(studentId, updated.topicId, sessionId);
  } else {
    touchBridgedLearningSession(sessionId).catch(() => {});
  }

  const view = toSessionView(updated);
  view.homeworkId = homeworkId;
  return view;
}

/**
 * Force-complete a session (e.g. student clicks "Finish early").
 *
 * Jumps directly to COMPLETE regardless of current phase.
 * Persists a STUDY progress touch and invalidates the TopicRanker cache.
 */
export async function completeSession(
  studentId: string,
  sessionId: string,
): Promise<SessionView> {
  const session = await prisma.structuredSession.findFirst({
    where: { id: sessionId, studentId },
  });

  if (!session) {
    throw new SessionError('Session not found', 404);
  }

  // Already complete — fetch with topic and return.
  if (session.state === 'COMPLETE') {
    const full = await prisma.structuredSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: topicInclude,
    });
    return toSessionView(full);
  }

  const updated = await prisma.structuredSession.update({
    where: { id: sessionId },
    data: {
      state: 'COMPLETE',
      completedAt: new Date(),
      meta: {
        ...(((session.meta as Record<string, unknown>) ?? {})),
        forceCompleted: true,
        forceCompletedAt: new Date().toISOString(),
        previousPhase: session.state,
      },
    },
    include: topicInclude,
  });

  // Persist progress and invalidate the ranker cache — fire-and-forget.
  persistCompletionProgress(studentId, updated.topicId, sessionId);

  logger.info('[SESSION_FORCE_COMPLETED]', {
    studentId,
    sessionId,
    previousPhase: session.state,
  });

  return toSessionView(updated);
}

/**
 * Returns the UI label and student-facing instruction for a given phase.
 * Used by API routes to populate the `phase` envelope in responses.
 */
export function getPhaseContent(phase: SessionPhase): PhaseContent {
  switch (phase) {
    case 'OVERVIEW':
      return {
        phase: 'OVERVIEW',
        label: 'Overview',
        instruction:
          'Review the topic summary and learning objectives, then start when you are ready.',
      };
    case 'EXPLANATION':
      return {
        phase: 'EXPLANATION',
        label: 'Learn',
        instruction: 'Read through the topic explanation and key concepts.',
      };
    case 'PRACTICE':
      return {
        phase: 'PRACTICE',
        label: 'Practice',
        instruction: 'Answer practice questions to reinforce what you learned.',
      };
    case 'TEST':
      return {
        phase: 'TEST',
        label: 'Quick Test',
        instruction: 'Take a short test to check your understanding.',
      };
    case 'HOMEWORK':
      return {
        phase: 'HOMEWORK',
        label: 'Homework',
        instruction: 'Complete the homework assignment for this topic.',
      };
    case 'COMPLETE':
      return {
        phase: 'COMPLETE',
        label: 'Complete',
        instruction: 'You have completed this topic. Well done!',
      };
  }
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Prisma include fragment shared by all queries that need topic metadata.
 */
const topicInclude = {
  topic: {
    select: {
      name: true,
      chapter: {
        select: { name: true, subject: { select: { name: true } } },
      },
    },
  },
} as const;

type SessionWithTopic = {
  id: string;
  studentId: string;
  topicId: string;
  state: string; // Prisma returns the raw enum string
  startedAt: Date;
  completedAt: Date | null;
  topic: {
    name: string;
    chapter: { name: string; subject: { name: string } };
  };
};

function toSessionView(s: SessionWithTopic): SessionView {
  const phase = s.state as SessionPhase;
  const phaseIdx = PHASE_INDEX.get(phase) ?? 0;

  return {
    sessionId: s.id,
    studentId: s.studentId,
    topicId: s.topicId,
    topicName: s.topic.name,
    subject: s.topic.chapter.subject.name,
    chapter: s.topic.chapter.name,
    currentPhase: phase,
    state: phase, // backward-compat alias
    phaseIndex: phaseIdx,
    totalPhases: DISPLAYABLE_PHASES.length,
    startedAt: s.startedAt.toISOString(),
    completedAt: s.completedAt?.toISOString() ?? null,
    homeworkId: null, // overwritten by advanceSession when HOMEWORK is entered
  };
}

/**
 * Touch StudentTopicProgress and invalidate the TopicRanker cache after a
 * session completes. Both operations are fire-and-forget: failures are logged
 * but must not surface to the student.
 */
function persistCompletionProgress(
  studentId: string,
  topicId: string,
  sessionId: string,
): void {
  // STUDY touch: updates lastStudiedAt so the recency signal in TopicRanker is
  // accurate. Actual mastery deltas come from practice/test answer submissions.
  updateStudentTopicProgress({
    studentId,
    topicId,
    correctAnswers: 0,
    totalAnswers: 0,
    activityType: 'STUDY',
  }).catch((err) =>
    logger.error('[SESSION_PROGRESS_UPDATE_FAILED]', { studentId, topicId, sessionId, error: err }),
  );

  // Invalidate cached recommendation so the next dashboard load reflects the
  // completed topic (recency penalty) and may surface the next curriculum topic.
  invalidateTopicRankerCache(studentId).catch((err) =>
    logger.warn('[SESSION_RANKER_INVALIDATE_FAILED]', { studentId, error: err }),
  );

  completeBridgedLearningSession(sessionId).catch((err) =>
    logger.error('[SESSION_BRIDGE_COMPLETE_FAILED]', { sessionId, error: err }),
  );
}

// ─── LearningSession Bridge ───────────────────────────────────────────────────
// Keeps the canonical LearningSession table in sync so the recommendation
// engine, TopicRanker, and "continue learning" signals work transparently.

const BRIDGE_ACTIVITY_TYPE = 'structured_session';

async function createBridgedLearningSession(
  studentId: string,
  topicId: string,
  structuredSessionId: string,
): Promise<void> {
  await prisma.learningSession.create({
    data: {
      studentId,
      activityType: BRIDGE_ACTIVITY_TYPE,
      activityRef: `topic:${topicId}`,
      difficultyLevel: 'medium',
      isCompleted: false,
      completionPercentage: 0,
      meta: { topicId, structuredSessionId, source: 'structured_session' },
    },
  });
  logger.info('[SESSION_BRIDGE_CREATED]', { studentId, topicId, structuredSessionId });
}

async function completeBridgedLearningSession(structuredSessionId: string): Promise<void> {
  const ls = await prisma.learningSession.findFirst({
    where: {
      activityType: BRIDGE_ACTIVITY_TYPE,
      meta: { path: ['structuredSessionId'], equals: structuredSessionId },
      isCompleted: false,
    },
  });

  if (!ls) return;

  const now = new Date();
  const elapsedMinutes = Math.max(
    1,
    Math.floor((now.getTime() - ls.startedAt.getTime()) / 60_000),
  );

  await prisma.learningSession.update({
    where: { id: ls.id },
    data: {
      isCompleted: true,
      completionPercentage: 100,
      lastAccessed: now,
      endedAt: now,
      actualTimeSpent: elapsedMinutes,
    },
  });

  logger.info('[SESSION_BRIDGE_COMPLETED]', {
    learningSessionId: ls.id,
    structuredSessionId,
    actualTimeSpent: elapsedMinutes,
  });
}

async function touchBridgedLearningSession(structuredSessionId: string): Promise<void> {
  const ls = await prisma.learningSession.findFirst({
    where: {
      activityType: BRIDGE_ACTIVITY_TYPE,
      meta: { path: ['structuredSessionId'], equals: structuredSessionId },
      isCompleted: false,
    },
  });

  if (!ls) return;

  await prisma.learningSession.update({
    where: { id: ls.id },
    data: { lastAccessed: new Date() },
  });
}

// ─── Error Class ──────────────────────────────────────────────────────────────

/**
 * Thrown by engine operations for predictable failure cases (not-found,
 * invalid state, etc.). API routes translate this into the appropriate
 * HTTP status code without logging a full stack trace.
 */
export class SessionError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SessionError';
    this.status = status;
  }
}
