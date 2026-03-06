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
import type { SessionPhase } from '@prisma/client';

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

  logger.info('[SESSION_STARTED]', {
    studentId,
    sessionId: session.id,
    topicId,
  });

  return toSessionView(session);
}

/**
 * Advance the session to the next phase.
 * Returns the updated session view. No-ops if already COMPLETE.
 */
export async function advanceSession(
  studentId: string,
  sessionId: string,
): Promise<SessionView> {
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
  const isComplete = next === 'COMPLETE';

  const updated = await prisma.structuredSession.update({
    where: { id: sessionId },
    data: {
      state: next,
      ...(isComplete ? { completedAt: new Date() } : {}),
    },
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

  logger.info('[SESSION_ADVANCED]', {
    studentId,
    sessionId,
    from: session.state,
    to: next,
  });

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

export class SessionError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'SessionError';
    this.status = status;
  }
}
