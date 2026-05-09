/**
 * Structured Learning Session Engine
 *
 * Implements the 6-phase learning flow defined in the Spinzy architecture:
 *
 *   OVERVIEW → EXPLANATION → PRACTICE → TEST → HOMEWORK → COMPLETE
 *
 * Design principles:
 *   1. The engine owns all state transitions -- callers never mutate state directly.
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
 *   OVERVIEW     - Student reads a topic summary and learning objectives.
 *                  Acts as an intentional entry gate; student must confirm before proceeding.
 *   EXPLANATION  - Full topic notes are displayed for deep reading.
 *   PRACTICE     - 5 practice questions drawn from the question bank.
 *   TEST         - A generated test (approved or draft fallback).
 *   HOMEWORK     - A homework assignment generated automatically on entry.
 *   COMPLETE     - Session closed; progress persisted; celebration shown.
 *
 * EDIT LOG:
 *   2026-03-07 | Manish Kumar | full rewrite: add OVERVIEW phase, move progress
 *                               update into engine, centralise StudentTopicProgress
 *                               touch, strengthen error handling and JSDoc.
 *   2026-05-08 | copilot      | proactively enqueue questions hydration on session start/resume
 *                               when no ACTIVE practice questions exist for the topic.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { contentReadinessService } from '@/lib/session/contentReadinessService';
import { contentHydrationTrigger } from '@/lib/session/contentHydrationTrigger';
import { enqueueQuestionsHydration } from '@/lib/execution-pipeline/enqueueTopicHydration';
import { generateHomework, type HomeworkResult } from '@/lib/session/homework';
import { transitionSessionPhase, InvalidTransitionError } from '@/lib/session/transitionSessionPhase';
import { validatePhaseCompletion } from '@/lib/session/phaseCompletionValidator';
import { updateStudentTopicProgress } from '@/lib/learning/updateTopicProgress';
import { emitSessionCompleted } from '@/lib/events/domainEvents';

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
  | 'COMPLETE'
  | 'EXPIRED'; // GAP-05: terminal state for archived/stale sessions

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

/** GAP-05: Sessions older than this are expired and archived. Default 48 hours. */
const SESSION_EXPIRY_MS = Number(process.env.SESSION_EXPIRY_HOURS ?? 48) * 60 * 60 * 1000;
const PRACTICE_HYDRATION_QUESTION_COUNT = 10;

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

/** Phases shown in the Overview "upcoming" list (after Overview, before Complete). */
export const UPCOMING_PHASES_ORDER: readonly SessionPhase[] = ['EXPLANATION', 'PRACTICE', 'TEST', 'HOMEWORK'];

/** ABSTRACTION-04: Canonical phase metadata. Single source of truth for labels and instructions. */
export const PHASE_METADATA: Record<
  SessionPhase,
  { label: string; instruction: string; upcomingLabel: string | null }
> = {
  OVERVIEW: {
    label: 'Overview',
    instruction: 'Review the topic summary and learning objectives, then start when you are ready.',
    upcomingLabel: null,
  },
  EXPLANATION: {
    label: 'Learn',
    instruction: 'Read through the topic explanation and key concepts.',
    upcomingLabel: 'Learn',
  },
  PRACTICE: {
    label: 'Practice',
    instruction: 'Answer practice questions to reinforce what you learned.',
    upcomingLabel: 'Practice',
  },
  TEST: {
    label: 'Quick Test',
    instruction: 'Take a short test to check your understanding.',
    upcomingLabel: 'Quick Test',
  },
  HOMEWORK: {
    label: 'Homework',
    instruction: 'Complete the homework assignment for this topic.',
    upcomingLabel: 'Homework',
  },
  COMPLETE: {
    label: 'Complete',
    instruction: 'You have completed this topic. Well done!',
    upcomingLabel: null,
  },
  EXPIRED: {
    label: 'Expired',
    instruction: 'This session has expired. Start a new session to continue.',
    upcomingLabel: null,
  },
};

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
  // ── Resume existing session if one is in progress (GAP-05: exclude EXPIRED) ──
  const existing = await prisma.structuredSession.findFirst({
    where: { studentId, topicId, state: { notIn: ['COMPLETE', 'EXPIRED'] } },
    include: topicInclude,
  });

  if (existing) {
    // GAP-05: If session is stale (>48h), archive it and create new session
    const ageMs = Date.now() - existing.startedAt.getTime();
    if (ageMs >= SESSION_EXPIRY_MS) {
      await prisma.structuredSession.update({
        where: { id: existing.id },
        data: {
          state: 'EXPIRED',
          completedAt: new Date(),
          meta: {
            ...((existing.meta as object) ?? {}),
            archivedAt: new Date().toISOString(),
            archivedReason: 'session_expired',
          },
        },
      });
      logger.info('[GAP-05] Session archived (expired)', {
        sessionId: existing.id,
        topicId,
        studentId,
        ageHours: Math.round(ageMs / (60 * 60 * 1000)),
      });
      // Fall through to create new session below
    } else {
      // Fresh session -- resume
      proactivelyHydratePracticeQuestions(topicId, studentId, 'session_resume');
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
  }

  // ── ABSTRACTION-01: Check content readiness before creating new session ──
  const readiness = await contentReadinessService.isTopicReady(topicId);

  // ── GAP-03: When MISSING, trigger hydration fire-and-forget; do not block session start ──
  if (readiness.status === 'MISSING') {
    logger.info('[HYDRATION_TRIGGER] content MISSING, triggering HydrationJobs', { topicId, studentId });
    contentHydrationTrigger.triggerForTopic(topicId);
  }

  proactivelyHydratePracticeQuestions(topicId, studentId, 'session_start');

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

  // Bridge to LearningSession -- fire-and-forget.
  createBridgedLearningSession(studentId, topicId, session.id).catch((err) =>
    logger.error('[SESSION_BRIDGE_CREATE_FAILED]', { sessionId: session.id, error: err }),
  );

  logger.info('[SESSION_STARTED]', { studentId, sessionId: session.id, topicId });

  return toSessionView(session);
}

function proactivelyHydratePracticeQuestions(
  topicId: string,
  studentId: string,
  triggerReason: 'session_start' | 'session_resume',
): void {
  void (async () => {
    try {
      const activePracticeQuestionCount = await prisma.question.count({
        where: { topicId, status: 'ACTIVE' },
      });

      if (activePracticeQuestionCount > 0) {
        return;
      }

      const enqueueResult = await enqueueQuestionsHydration({
        topicId,
        language: 'en',
        difficulty: 'medium',
        force: true,
        questionsPerDifficulty: PRACTICE_HYDRATION_QUESTION_COUNT,
      });

      logger.info('[SESSION_PRACTICE_HYDRATION_ENQUEUE]', {
        topicId,
        studentId,
        triggerReason,
        requestedQuestionCount: PRACTICE_HYDRATION_QUESTION_COUNT,
        enqueueResult,
      });
    } catch (error) {
      logger.error('[SESSION_PRACTICE_HYDRATION_ENQUEUE_FAILED]', {
        topicId,
        studentId,
        triggerReason,
        error,
      });
    }
  })();
}

/**
 * Advance the session to the next phase.
 *
 * Uses `transitionSessionPhase` which performs a guarded DB write -- if two
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

  // GAP-05: Expired sessions cannot be advanced.
  if (session.state === 'EXPIRED') {
    throw new SessionError('Session has expired. Please start a new session.', 410);
  }

  const next = nextPhase(session.state as SessionPhase);

  // ABSTRACTION-02: Validate phase completion before transitioning.
  const completion = await validatePhaseCompletion(
    session.state as SessionPhase,
    session,
    sessionId,
    studentId,
  );
  if (!completion.valid) {
    throw new SessionError(completion.message ?? 'Phase completion requirements not met', 400);
  }

  // Validated, guarded transition -- throws InvalidTransitionError on illegal moves.
  // On race lost (CAS count=0), transition returns raceLost: true; we reload and
  // return current state without running phase side-effects (RISK-03).
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

  // ── Race lost: return current state, skip side-effects ───────────────────
  // Another request advanced first. The winner already ran homework generation,
  // persistCompletionProgress, etc. We just return the reloaded view.
  if (transition.raceLost) {
    logger.info('[PHASE_TRANSITION_RACE_LOST]', {
      sessionId,
      studentId,
      currentPhase: updated.state,
      note: 'Returning current state; winner already applied side-effects.',
    });
    const view = toSessionView(updated);
    if (updated.state === 'HOMEWORK') {
      const existing = await prisma.homeworkAssignment.findFirst({
        where: { sessionId },
        select: { id: true },
      });
      view.homeworkId = existing?.id ?? null;
    }
    return view;
  }

  // ── Phase-specific side-effects ─────────────────────────────────────────

  let homeworkId: string | null = null;

  if (next === 'HOMEWORK') {
    // Prevent duplicate homework: another request may have won a prior race.
    const existing = await prisma.homeworkAssignment.findFirst({
      where: { sessionId },
      select: { id: true },
    });
    if (existing) {
      homeworkId = existing.id;
      logger.info('[SESSION_HOMEWORK_EXISTS]', {
        sessionId,
        homeworkId,
        studentId,
        note: 'Reusing existing assignment; duplicate creation prevented.',
      });
    } else {
      // Auto-generate homework on entry to HOMEWORK phase.
      // generateHomeworkWithRetry() guarantees a HomeworkAssignment row is
      // created (stub if necessary) so resolvePhaseContent never returns
      // PendingContent and the student is never permanently stuck here.
      const hw = await generateHomeworkWithRetry(studentId, updated.topicId, sessionId);
      if (hw) {
        homeworkId = hw.id;
        if (hw.isStub) {
          logger.warn('[SESSION_HOMEWORK_STUB]', {
            sessionId,
            homeworkId,
            studentId,
            note: 'Stub assignment created; no questions available.',
          });
        } else {
          logger.info('[SESSION_HOMEWORK_GENERATED]', {
            sessionId,
            homeworkId,
            studentId,
            questionCount: hw.questionCount,
          });
        }
      }
    }
  }

  if (transition.isComplete) {
    // Persist progress and invalidate the ranker cache -- fire-and-forget
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
 * Get session view by id (COUPLING-03).
 *
 * Returns the same SessionView format as startSession and advanceSession.
 * Throws SessionError 404 when not found, 410 when expired (details.topicId for client redirect).
 */
export async function getSessionView(
  studentId: string,
  sessionId: string,
): Promise<SessionView> {
  const session = await prisma.structuredSession.findFirst({
    where: { id: sessionId, studentId },
    include: {
      ...topicInclude,
      homework: {
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!session) {
    throw new SessionError('Session not found', 404);
  }

  if (session.state === 'EXPIRED') {
    throw new SessionError('Session expired', 410, { topicId: session.topicId });
  }

  const view = toSessionView(session);
  view.homeworkId = (session as { homework?: { id: string }[] }).homework?.[0]?.id ?? null;
  return view;
}

/**
 * Navigate a session back to a previously completed phase.
 *
 * Rules:
 *   - Target phase must be before the current phase in PHASE_ORDER (no skipping forward).
 *   - COMPLETE and EXPIRED sessions cannot be navigated.
 *   - No side-effects: no progress events, no phase-completion markers touched.
 *
 * Returns the SessionView with the updated phase so the client can reload content.
 */
export async function navigateSessionBack(
  studentId: string,
  sessionId: string,
  targetPhase: SessionPhase,
): Promise<SessionView> {
  const session = await prisma.structuredSession.findFirst({
    where: { id: sessionId, studentId },
    include: topicInclude,
  });

  if (!session) throw new SessionError('Session not found', 404);
  if (session.state === 'COMPLETE') throw new SessionError('Session already complete', 400);
  if (session.state === 'EXPIRED') throw new SessionError('Session has expired', 410);

  const currentIdx = PHASE_INDEX.get(session.state as SessionPhase) ?? 0;
  const targetIdx = PHASE_INDEX.get(targetPhase);

  if (targetIdx === undefined || targetIdx >= currentIdx) {
    throw new SessionError('Cannot navigate to that phase', 400);
  }

  await prisma.structuredSession.update({
    where: { id: sessionId },
    data: { state: targetPhase },
  });

  // Re-fetch so toSessionView reflects the updated state.
  const updated = await prisma.structuredSession.findFirst({
    where: { id: sessionId, studentId },
    include: topicInclude,
  });

  return toSessionView(updated!);
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

  // Already complete -- fetch with topic and return.
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

  // Persist progress and invalidate the ranker cache -- fire-and-forget.
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
  const meta = PHASE_METADATA[phase];
  return { phase, label: meta.label, instruction: meta.instruction };
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

/** Delay between homework generation attempts (ms). */
const HOMEWORK_RETRY_DELAY_MS = 1_000;

/**
 * Attempt homework generation with one retry on infrastructure failure.
 *
 * generateHomework() only throws for real infrastructure errors (DB write
 * failure) -- it handles "no questions" internally by creating a stub.
 * This wrapper adds one retry after HOMEWORK_RETRY_DELAY_MS and, if that
 * also fails, attempts a direct minimal stub creation as a last resort.
 *
 * Returns null only when the DB is completely unavailable (catastrophic).
 * In that case the session will remain in HOMEWORK state with no assignment
 * row -- the only scenario where PendingContent could still appear.
 */
async function generateHomeworkWithRetry(
  studentId: string,
  topicId: string,
  sessionId: string,
): Promise<HomeworkResult | null> {
  try {
    return await generateHomework(studentId, topicId, sessionId);
  } catch (firstErr) {
    logger.warn('[SESSION_HOMEWORK_RETRY]', {
      sessionId,
      studentId,
      topicId,
      error: firstErr,
      note: 'Retrying after delay.',
    });
  }

  await new Promise<void>((resolve) => setTimeout(resolve, HOMEWORK_RETRY_DELAY_MS));

  try {
    return await generateHomework(studentId, topicId, sessionId);
  } catch (secondErr) {
    logger.error('[SESSION_HOMEWORK_RETRY_FAILED]', {
      sessionId,
      studentId,
      topicId,
      error: secondErr,
      note: 'Both attempts failed. Attempting last-resort stub.',
    });
  }

  // Last resort: write a minimal stub directly, bypassing homework.ts.
  // This fires only when generateHomework() itself throws on DB write --
  // i.e. the DB is degraded but not completely down.
  try {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 2);
    const stub = await prisma.homeworkAssignment.create({
      data: {
        studentId,
        topicId,
        sessionId,
        questions: [],
        status: 'PENDING',
        dueDate,
      },
    });
    logger.warn('[SESSION_HOMEWORK_LAST_RESORT_STUB]', {
      sessionId,
      studentId,
      topicId,
      homeworkId: stub.id,
    });
    return { id: stub.id, questionCount: 0, isStub: true };
  } catch (stubErr) {
    // DB is completely unavailable. Nothing more we can do.
    logger.error('[SESSION_HOMEWORK_EXHAUSTED]', {
      sessionId,
      studentId,
      topicId,
      error: stubErr,
      note: 'DB unavailable. Student may see PendingContent until DB recovers.',
    });
    return null;
  }
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

  // COUPLING-01: Emit domain event; TopicRanker and engagement listen.
  emitSessionCompleted({ studentId, sessionId });

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
  /** Optional details for API responses (e.g. topicId for 410 SESSION_EXPIRED). */
  readonly details?: Record<string, unknown>;

  constructor(message: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'SessionError';
    this.status = status;
    this.details = details;
  }
}
