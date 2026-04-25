/**
 * Unit tests for getNextAction — P0 homework_pending blocker.
 *
 * Phase 3: P0 fires before all other rules when a HomeworkAssignment is
 * PENDING or OVERDUE and dueDate is within the next 48 hours.
 *
 * Tests:
 *   1. homework_pending fires when status=PENDING and dueDate < 48h
 *   2. homework_pending ignored when status=SUBMITTED
 *   3. homework_pending ignored when dueDate > 48h
 *   4. homework_pending overrides resume_session (P0 before P1)
 *   5. OVERDUE assignment within 48h also fires homework_pending
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Mock dependencies ────────────────────────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  prisma: {
    homeworkAssignment: { findFirst: jest.fn() },
    structuredSession: { findFirst: jest.fn() },
    learningSession: { findFirst: jest.fn() },
    studentTopicProgress: { findFirst: jest.fn(), findMany: jest.fn() }, // P2/P3/P4 shared fetch
    topicDef: { findUnique: jest.fn(), findMany: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));

jest.mock('@/lib/homeEngine/getOrderedTopicsForStudent', () => ({
  getOrderedTopicsForStudent: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/recommendations/topicRanker', () => ({
  rankTopics: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma';
import { getNextAction } from '@/lib/homeEngine/getNextAction';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Unwrap the { action, traceId } dev-mode wrapper (NODE_ENV = 'test'). */
function unwrap(result: unknown): Record<string, unknown> | null {
  if (result && typeof result === 'object' && 'action' in result) {
    return (result as { action: Record<string, unknown> | null }).action;
  }
  return result as Record<string, unknown> | null;
}

const STUDENT_ID = 'student-hw-test';

/** Builds a HomeworkAssignment mock with the given status and dueDate offset (ms from now). */
function makeHomeworkAssignment(status: string, dueDateOffsetMs: number) {
  return {
    id: 'hw-001',
    topicId: 'topic-hw-001',
    status,
    dueDate: new Date(Date.now() + dueDateOffsetMs),
    topic: {
      name: 'Quadratic Equations',
      chapter: {
        name: 'Algebra',
        subject: { name: 'Mathematics' },
      },
    },
  };
}

function makeStructuredSession() {
  return {
    id: 'ss-001',
    topicId: 'topic-001',
    state: 'PRACTICE',
    topic: {
      name: "Newton's Laws",
      chapter: {
        name: 'Forces and Motion',
        subject: { name: 'Physics' },
      },
    },
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  // Default: no homework, no session, no curriculum
  (prisma.homeworkAssignment.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.learningSession.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.studentTopicProgress.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.studentTopicProgress.findMany as jest.Mock).mockResolvedValue([]); // P2/P3/P4 shared fetch
  (prisma.topicDef.findUnique as jest.Mock).mockResolvedValue(null);
  (prisma.topicDef.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getNextAction — P0 homework_pending blocker', () => {
  it('fires homework_pending when assignment is PENDING and dueDate is within 48h', async () => {
    const twentyFourHours = 24 * 60 * 60 * 1000;
    (prisma.homeworkAssignment.findFirst as jest.Mock).mockResolvedValue(
      makeHomeworkAssignment('PENDING', twentyFourHours)
    );

    const result = unwrap(await getNextAction(STUDENT_ID));

    expect(result).toMatchObject({
      ruleId: 'homework_pending',
      actionType: 'homework',
      assignmentId: 'hw-001',
      topicId: 'topic-hw-001',
      topicName: 'Quadratic Equations',
      subject: 'Mathematics',
      chapter: 'Algebra',
    });
  });

  it('does NOT fire homework_pending when assignment status is SUBMITTED', async () => {
    // SUBMITTED is not in ['PENDING','OVERDUE'] — engine must not return P0
    (prisma.homeworkAssignment.findFirst as jest.Mock).mockResolvedValue(null);

    const result = unwrap(await getNextAction(STUDENT_ID));

    expect(result?.ruleId).not.toBe('homework_pending');
    // Verify the query was called with the correct status filter
    expect(prisma.homeworkAssignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['PENDING', 'OVERDUE'] },
        }),
      })
    );
  });

  it('does NOT fire homework_pending when dueDate is more than 48h away', async () => {
    // dueDate = 72 hours from now — outside the 48h window
    const seventyTwoHours = 72 * 60 * 60 * 1000;
    // The DB filters by dueDate <= cutoff, so findFirst returns null for future due dates
    (prisma.homeworkAssignment.findFirst as jest.Mock).mockResolvedValue(null);

    // Verify the 48h cutoff is passed in the query
    const result = unwrap(await getNextAction(STUDENT_ID));

    expect(result?.ruleId).not.toBe('homework_pending');
    expect(prisma.homeworkAssignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dueDate: expect.objectContaining({ lte: expect.any(Date) }),
        }),
      })
    );
    // Verify the cutoff date is approximately 48h from now (within 5s tolerance)
    const callArgs = (prisma.homeworkAssignment.findFirst as jest.Mock).mock.calls[0][0];
    const cutoff: Date = callArgs.where.dueDate.lte;
    const fortyEightHoursMs = 48 * 60 * 60 * 1000;
    expect(cutoff.getTime()).toBeGreaterThan(Date.now() + fortyEightHoursMs - 5000);
    expect(cutoff.getTime()).toBeLessThan(Date.now() + fortyEightHoursMs + 5000);

    // Simulate the 72h case — DB would return null because 72h > 48h cutoff
    expect(seventyTwoHours).toBeGreaterThan(fortyEightHoursMs);
  });

  it('homework_pending overrides resume_session — P0 fires before P1', async () => {
    // Both homework (P0) and an active session (P1) exist — P0 must win
    const oneHour = 60 * 60 * 1000;
    (prisma.homeworkAssignment.findFirst as jest.Mock).mockResolvedValue(
      makeHomeworkAssignment('PENDING', oneHour)
    );
    (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue(makeStructuredSession());

    const result = unwrap(await getNextAction(STUDENT_ID));

    expect(result?.ruleId).toBe('homework_pending');
    expect(result?.assignmentId).toBe('hw-001');
    // P1 (StructuredSession) must never be queried because P0 short-circuited
    expect(prisma.structuredSession.findFirst).not.toHaveBeenCalled();
  });

  it('fires homework_pending when assignment is OVERDUE and dueDate is within 48h', async () => {
    // OVERDUE assignment — dueDate in the past but within 48h window
    const oneHourAgo = -1 * 60 * 60 * 1000;
    (prisma.homeworkAssignment.findFirst as jest.Mock).mockResolvedValue(
      makeHomeworkAssignment('OVERDUE', oneHourAgo)
    );

    const result = unwrap(await getNextAction(STUDENT_ID));

    expect(result).toMatchObject({
      ruleId: 'homework_pending',
      actionType: 'homework',
      assignmentId: 'hw-001',
    });
  });
});
