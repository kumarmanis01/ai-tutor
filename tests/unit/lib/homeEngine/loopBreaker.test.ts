/**
 * FILE OBJECTIVE:
 * - Unit tests for getNextAction's P0 homework_pending circuit breaker -- the
 *   "loop breaker" that prevents the dashboard from gating a student forever
 *   on the same homework decision.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/homeEngine/loopBreaker.test.ts (self)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-06-07T00:00:00Z | claude | initial creation with standard header.
 *
 * Description:
 * Unit tests for getNextAction -- P0 homework_pending circuit breaker.
 *
 * The circuit breaker counts *consecutive* repeats of the same
 * (ruleId, topicId) homework_pending decision. After LOOP_BREAK_THRESHOLD (3)
 * consecutive hits it opens, skipping P0 and falling through to P1-P5 so the
 * student gets a usable action instead of being hard-gated forever.
 *
 * Tests:
 *   1. The same assignment returned >= 3 times in a row opens the circuit
 *      (4th call no longer returns homework_pending).
 *   2. A different topicId interleaved resets the consecutive count (no open).
 *   3. Resolving the homework (no P0) clears state so the circuit re-arms.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    homeworkAssignment: { findFirst: jest.fn() },
    structuredSession: { findFirst: jest.fn() },
    learningSession: { findFirst: jest.fn() },
    studentTopicProgress: { findFirst: jest.fn(), findMany: jest.fn() },
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
  logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

import { prisma } from '@/lib/prisma';
import { getNextAction } from '@/lib/homeEngine/getNextAction';

function unwrap(result: unknown): Record<string, unknown> | null {
  if (result && typeof result === 'object' && 'action' in result) {
    return (result as { action: Record<string, unknown> | null }).action;
  }
  return result as Record<string, unknown> | null;
}

/** HomeworkAssignment within the 48h window so P0 matches. */
function makeHomework(id: string, topicId: string) {
  return {
    id,
    topicId,
    status: 'PENDING',
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    topic: { name: 'T', chapter: { name: 'C', subject: { name: 'Mathematics' } } },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.homeworkAssignment.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.learningSession.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.studentTopicProgress.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.studentTopicProgress.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.topicDef.findUnique as jest.Mock).mockResolvedValue(null);
  (prisma.topicDef.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
});

describe('getNextAction -- P0 circuit breaker', () => {
  it('opens after 3 consecutive identical homework_pending decisions and falls through', async () => {
    const studentId = 'student-loop-open';
    (prisma.homeworkAssignment.findFirst as jest.Mock).mockResolvedValue(
      makeHomework('hw-1', 'topic-1'),
    );

    // First 3 calls: homework_pending returned and recorded.
    for (let i = 0; i < 3; i++) {
      const r = unwrap(await getNextAction(studentId));
      expect(r?.ruleId).toBe('homework_pending');
    }

    // 4th call: circuit open -> P0 skipped, falls through (no homework_pending).
    const fourth = unwrap(await getNextAction(studentId));
    expect(fourth?.ruleId).not.toBe('homework_pending');
  });

  it('does not open when a different topicId is interleaved (non-consecutive)', async () => {
    const studentId = 'student-loop-interleave';
    const hwA = makeHomework('hw-a', 'topic-a');
    const hwB = makeHomework('hw-b', 'topic-b');

    // A, A, B, A, A -- topic-a never reaches 3 in a row.
    const sequence = [hwA, hwA, hwB, hwA, hwA];
    for (const hw of sequence) {
      (prisma.homeworkAssignment.findFirst as jest.Mock).mockResolvedValue(hw);
      const r = unwrap(await getNextAction(studentId));
      expect(r?.ruleId).toBe('homework_pending');
    }
  });

  it('re-arms after the homework resolves (P0 returns null clears state)', async () => {
    const studentId = 'student-loop-rearm';
    const hw = makeHomework('hw-x', 'topic-x');
    (prisma.homeworkAssignment.findFirst as jest.Mock).mockResolvedValue(hw);

    // Open the circuit (3 consecutive hits).
    for (let i = 0; i < 3; i++) {
      await getNextAction(studentId);
    }
    // Confirm open.
    expect(unwrap(await getNextAction(studentId))?.ruleId).not.toBe('homework_pending');

    // Homework resolves -> P0 returns null -> state cleared.
    (prisma.homeworkAssignment.findFirst as jest.Mock).mockResolvedValue(null);
    await getNextAction(studentId);

    // New pending homework -> circuit re-armed, fires again.
    (prisma.homeworkAssignment.findFirst as jest.Mock).mockResolvedValue(
      makeHomework('hw-y', 'topic-y'),
    );
    expect(unwrap(await getNextAction(studentId))?.ruleId).toBe('homework_pending');
  });
});
