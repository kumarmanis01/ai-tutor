/**
 * Structured Learning Session Engine
 *
 * State machine: EXPLANATION → PRACTICE → TEST → HOMEWORK → COMPLETE
 *
 * Each phase maps to a concrete learning activity for the topic.
 * The engine owns transitions — callers never set state directly.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { generateHomework } from '@/lib/session/homework';
import { transitionSessionPhase, InvalidTransitionError } from '@/lib/session/transitionSessionPhase';
type SessionPhase = 'EXPLANATION' | 'PRACTICE' | 'TEST' | 'HOMEWORK' | 'COMPLETE';

// ─── State Machine ───────────────────────────────────────────────────────────

const PHASE_ORDER: SessionPhase[] = [
  'EXPLANATION',
  'PRACTICE',
  'TEST',
  'HOMEWORK',
  'COMPLETE',
];

const PHASE_INDEX = new Map(PHASE_ORDER.map((p, i) => [p, i]));

function nextPhase(current: SessionPhase): SessionPhase {
  const idx = PHASE_INDEX.get(current) ?? 0;
  return PHASE_ORDER[Math.min(idx + 1, PHASE_ORDER.length - 1)];
}

// ─── Feature Flag ────────────────────────────────────────────────────────────

export function isSessionEngineEnabled(): boolean {
  const flag = process.env.ENABLE_SESSION_ENGINE;
  return flag === '1' || flag === 'true';
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SessionView {
  sessionId: string;
  topicId: string;
  topicName: string;
  subject: string;
  chapter: string;
  state: SessionPhase;
  phaseIndex: number;
  totalPhases: number;
  startedAt: string;
  completedAt: string | null;
  homeworkId: string | null;
}

interface PhaseContent {
  phase: SessionPhase;
  label: string;
  instruction: string;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Start a new structured session for a topic.
 * If an incomplete session already exists for this student+topic, resume it.
 * Also creates a bridged LearningSession so recommendation signals fire.
 */
export async function startSession(
  studentId: string,
  topicId: string,
): Promise<SessionView> {
  const existing = await prisma.structuredSession.findFirst({
    where: { studentId, topicId, state: { not: 'COMPLETE' } },
    include: {
      topic: {
        select: {
          name: true,
          chapter: {
            select: { name: true, subject: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (existing) {
    // Touch the bridged LearningSession's lastAccessed so recency signals stay fresh
    await touchBridgedLearningSession(existing.id).catch((err) =>
      logger.warn('[SESSION_BRIDGE_TOUCH_FAILED]', { sessionId: existing.id, error: err }),
    );

    logger.info('[SESSION_RESUMED]', {
      studentId,
      sessionId: existing.id,
      topicId,
      state: existing.state,
    });
    return toSessionView(existing);
  }

  const session = await prisma.structuredSession.create({
    data: { studentId, topicId, state: 'EXPLANATION' },
    include: {
      topic: {
        select: {
          name: true,
          chapter: {
            select: { name: true, subject: { select: { name: true } } },
          },
        },
      },
    },
  });

  // Bridge: create a LearningSession so the recommendation engine picks up signals
  await createBridgedLearningSession(studentId, topicId, session.id).catch((err) =>
    logger.error('[SESSION_BRIDGE_CREATE_FAILED]', { sessionId: session.id, error: err }),
  );

  logger.info('[SESSION_STARTED]', {
    studentId,
    sessionId: session.id,
    topicId,
  });

  return toSessionView(session);
}

/**
 * Advance the session to the next phase.
 * Uses `transitionSessionPhase` for validated, strict-order transitions.
 * Returns the updated session view. No-ops if already COMPLETE.
 */
export async function advanceSession(
  studentId: string,
  sessionId: string,
): Promise<SessionView> {
  // Look up current state to determine the next phase
  const session = await prisma.structuredSession.findFirst({
    where: { id: sessionId, studentId },
    include: {
      topic: {
        select: {
          name: true,
          chapter: {
            select: { name: true, subject: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!session) {
    throw new SessionError('Session not found', 404);
  }

  if (session.state === 'COMPLETE') {
    return toSessionView(session);
  }

  const next = nextPhase(session.state);

  // Validated transition — throws InvalidTransitionError on illegal moves
  let transition;
  try {
    transition = await transitionSessionPhase(sessionId, next, studentId);
  } catch (err) {
    if (err instanceof InvalidTransitionError) {
      throw new SessionError(err.message, err.status);
    }
    throw err;
  }

  // Re-fetch the full session with topic data after the transition
  const updated = await prisma.structuredSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      topic: {
        select: {
          name: true,
          chapter: {
            select: { name: true, subject: { select: { name: true } } },
          },
        },
      },
    },
  });

  // Bridge: if session just completed, mark the LearningSession too
  if (transition.isComplete) {
    await completeBridgedLearningSession(sessionId).catch((err) =>
      logger.error('[SESSION_BRIDGE_COMPLETE_FAILED]', { sessionId, error: err }),
    );
  } else {
    await touchBridgedLearningSession(sessionId).catch(() => {});
  }

  // Auto-generate homework when entering HOMEWORK phase
  let homeworkId: string | null = null;
  if (next === 'HOMEWORK') {
    try {
      const hw = await generateHomework(studentId, updated.topicId, sessionId);
      homeworkId = hw.id;
    } catch (err) {
      logger.warn('[SESSION_HOMEWORK_SKIP]', { sessionId, error: err });
    }
  }

  const view = toSessionView(updated);
  view.homeworkId = homeworkId;
  return view;
}

/**
 * Force-complete a session (e.g. student clicks "Finish" early).
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

  if (session.state === 'COMPLETE') {
    const full = await prisma.structuredSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: {
        topic: {
          select: {
            name: true,
            chapter: {
              select: { name: true, subject: { select: { name: true } } },
            },
          },
        },
      },
    });
    return toSessionView(full);
  }

  const updated = await prisma.structuredSession.update({
    where: { id: sessionId },
    data: { state: 'COMPLETE', completedAt: new Date() },
    include: {
      topic: {
        select: {
          name: true,
          chapter: {
            select: { name: true, subject: { select: { name: true } } },
          },
        },
      },
    },
  });

  // Bridge: complete the paired LearningSession
  await completeBridgedLearningSession(sessionId).catch((err) =>
    logger.error('[SESSION_BRIDGE_COMPLETE_FAILED]', { sessionId, error: err }),
  );

  logger.info('[SESSION_COMPLETED]', {
    studentId,
    sessionId,
    previousState: session.state,
  });

  return toSessionView(updated);
}

/**
 * Get content/instructions for the current phase.
 */
export function getPhaseContent(state: SessionPhase): PhaseContent {
  switch (state) {
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

type SessionWithTopic = {
  id: string;
  studentId: string;
  topicId: string;
  state: SessionPhase;
  startedAt: Date;
  completedAt: Date | null;
  topic: {
    name: string;
    chapter: { name: string; subject: { name: string } };
  };
};

function toSessionView(s: SessionWithTopic): SessionView {
  return {
    sessionId: s.id,
    topicId: s.topicId,
    topicName: s.topic.name,
    subject: s.topic.chapter.subject.name,
    chapter: s.topic.chapter.name,
    state: s.state,
    phaseIndex: PHASE_INDEX.get(s.state) ?? 0,
    totalPhases: PHASE_ORDER.length - 1,
    startedAt: s.startedAt.toISOString(),
    completedAt: s.completedAt?.toISOString() ?? null,
    homeworkId: null,
  };
}

// ─── LearningSession Bridge ──────────────────────────────────────────────────
// Keeps the canonical LearningSession table in sync so recommendation engine,
// topic ranker, and "continue learning" signals all work transparently.

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
  // Find the paired LearningSession via meta.structuredSessionId
  const ls = await prisma.learningSession.findFirst({
    where: {
      activityType: BRIDGE_ACTIVITY_TYPE,
      meta: { path: ['structuredSessionId'], equals: structuredSessionId },
      isCompleted: false,
    },
  });

  if (!ls) return;

  const now = new Date();
  const elapsedMinutes = Math.max(1, Math.floor((now.getTime() - ls.startedAt.getTime()) / 60000));

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

export class SessionError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'SessionError';
    this.status = status;
  }
}
