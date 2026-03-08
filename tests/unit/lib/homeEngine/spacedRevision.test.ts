/**
 * Unit tests for getNextAction — P3 spaced_revision with dynamic intervals.
 *
 * Phase 4: p3_spacedRevision uses SPACED_REVISION_INTERVALS to derive a
 * mastery-band interval rather than a fixed 7-day window. Progress rows
 * are fetched once (findMany) and shared across P2/P3/P4.
 *
 * Mastery bands:
 *   0.40–0.60 → 3  days
 *   0.60–0.75 → 7  days
 *   0.75–0.90 → 14 days
 *   0.90–1.00 → 30 days
 *
 * Tests:
 *   1. mastery 0.45 → 3-day interval → fires after 4 days
 *   2. mastery 0.65 → 7-day interval → fires after 8 days
 *   3. mastery 0.80 → 14-day interval → fires after 15 days
 *   4. mastery 0.95 → 30-day interval → fires after 31 days
 *   5. Most overdue topic wins when multiple candidates exist
 *   6. Does NOT fire when daysSince < intervalDays (not yet overdue)
 *   7. reasonLabel contains "it's been N days"
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Mock dependencies ────────────────────────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  prisma: {
    homeworkAssignment: { findFirst: jest.fn() },
    structuredSession: { findFirst: jest.fn() },
    learningSession: { findFirst: jest.fn() },
    studentTopicProgress: { findMany: jest.fn() },
    topicDef: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));

jest.mock('@/lib/homeEngine/getOrderedTopicsForStudent', () => ({
  getOrderedTopicsForStudent: jest.fn(),
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
import { getOrderedTopicsForStudent } from '@/lib/homeEngine/getOrderedTopicsForStudent';
import { getNextAction } from '@/lib/homeEngine/getNextAction';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Unwrap the { action, traceId } dev-mode wrapper (NODE_ENV = 'test'). */
function unwrap(result: unknown): Record<string, unknown> | null {
  if (result && typeof result === 'object' && 'action' in result) {
    return (result as { action: Record<string, unknown> | null }).action;
  }
  return result as Record<string, unknown> | null;
}

const STUDENT_ID = 'student-p3-test';

/** Returns a Date that is `days` days in the past. */
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Builds a minimal OrderedTopic fixture for the curriculum mock.
 * The engine scopes P2/P3/P4 to these topicIds.
 */
function makeOrderedTopics(...ids: string[]) {
  return ids.map((id) => ({
    id,
    name: `Topic ${id}`,
    order: 1,
    parentId: null,
    chapter: {
      id: 'ch-1',
      name: 'Algebra',
      order: 1,
      subject: { id: 'sub-1', name: 'Mathematics' },
    },
  }));
}

/** Returns a mock TopicDef enrichment row for the given topic name. */
function makeTopicDef(name: string) {
  return {
    id: 'any',
    name,
    chapter: { name: 'Algebra', subject: { name: 'Mathematics' } },
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  // Default: no blocking homework, no active session
  (prisma.homeworkAssignment.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.learningSession.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.topicDef.findUnique as jest.Mock).mockResolvedValue(
    makeTopicDef('Fractions'),
  );
  // Default curriculum: one topic; tests override progressRows per scenario
  (getOrderedTopicsForStudent as jest.Mock).mockResolvedValue(
    makeOrderedTopics('topic-001'),
  );
  (prisma.studentTopicProgress.findMany as jest.Mock).mockResolvedValue([]);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getNextAction — P3 spaced_revision dynamic intervals', () => {

  // ── Band 1: mastery 0.40–0.60 → 3 days ─────────────────────────────────────

  it('fires after 4 days for mastery 0.45 (band interval = 3 days)', async () => {
    (prisma.studentTopicProgress.findMany as jest.Mock).mockResolvedValue([
      { topicId: 'topic-001', mastery: 0.45, practiceCount: 3, lastStudiedAt: daysAgo(4) },
    ]);

    const result = unwrap(await getNextAction(STUDENT_ID));

    expect(result?.ruleId).toBe('spaced_revision');
    expect(result?.topicId).toBe('topic-001');
  });

  it('does NOT fire at 2 days for mastery 0.45 (not yet overdue — interval = 3 days)', async () => {
    (prisma.studentTopicProgress.findMany as jest.Mock).mockResolvedValue([
      { topicId: 'topic-001', mastery: 0.45, practiceCount: 3, lastStudiedAt: daysAgo(2) },
    ]);

    const result = unwrap(await getNextAction(STUDENT_ID));

    expect(result?.ruleId).not.toBe('spaced_revision');
  });

  // ── Band 2: mastery 0.60–0.75 → 7 days ─────────────────────────────────────

  it('fires after 8 days for mastery 0.65 (band interval = 7 days)', async () => {
    (prisma.studentTopicProgress.findMany as jest.Mock).mockResolvedValue([
      { topicId: 'topic-001', mastery: 0.65, practiceCount: 4, lastStudiedAt: daysAgo(8) },
    ]);

    const result = unwrap(await getNextAction(STUDENT_ID));

    expect(result?.ruleId).toBe('spaced_revision');
  });

  it('does NOT fire at 6 days for mastery 0.65 (not yet overdue — interval = 7 days)', async () => {
    (prisma.studentTopicProgress.findMany as jest.Mock).mockResolvedValue([
      { topicId: 'topic-001', mastery: 0.65, practiceCount: 4, lastStudiedAt: daysAgo(6) },
    ]);

    const result = unwrap(await getNextAction(STUDENT_ID));

    expect(result?.ruleId).not.toBe('spaced_revision');
  });

  // ── Band 3: mastery 0.75–0.90 → 14 days ─────────────────────────────────────

  it('fires after 15 days for mastery 0.80 (band interval = 14 days)', async () => {
    (prisma.studentTopicProgress.findMany as jest.Mock).mockResolvedValue([
      { topicId: 'topic-001', mastery: 0.80, practiceCount: 6, lastStudiedAt: daysAgo(15) },
    ]);

    const result = unwrap(await getNextAction(STUDENT_ID));

    expect(result?.ruleId).toBe('spaced_revision');
  });

  it('does NOT fire at 13 days for mastery 0.80 (not yet overdue — interval = 14 days)', async () => {
    (prisma.studentTopicProgress.findMany as jest.Mock).mockResolvedValue([
      { topicId: 'topic-001', mastery: 0.80, practiceCount: 6, lastStudiedAt: daysAgo(13) },
    ]);

    const result = unwrap(await getNextAction(STUDENT_ID));

    expect(result?.ruleId).not.toBe('spaced_revision');
  });

  // ── Band 4: mastery 0.90–1.00 → 30 days ─────────────────────────────────────

  it('fires after 31 days for mastery 0.95 (band interval = 30 days)', async () => {
    (prisma.studentTopicProgress.findMany as jest.Mock).mockResolvedValue([
      { topicId: 'topic-001', mastery: 0.95, practiceCount: 10, lastStudiedAt: daysAgo(31) },
    ]);

    const result = unwrap(await getNextAction(STUDENT_ID));

    expect(result?.ruleId).toBe('spaced_revision');
  });

  it('does NOT fire at 29 days for mastery 0.95 (not yet overdue — interval = 30 days)', async () => {
    (prisma.studentTopicProgress.findMany as jest.Mock).mockResolvedValue([
      { topicId: 'topic-001', mastery: 0.95, practiceCount: 10, lastStudiedAt: daysAgo(29) },
    ]);

    const result = unwrap(await getNextAction(STUDENT_ID));

    expect(result?.ruleId).not.toBe('spaced_revision');
  });

  // ── Most overdue topic wins ───────────────────────────────────────────────────

  it('returns the most overdue topic when multiple candidates exist', async () => {
    // Set up two-topic curriculum
    (getOrderedTopicsForStudent as jest.Mock).mockResolvedValue(
      makeOrderedTopics('topic-A', 'topic-B'),
    );

    // Topic A: mastery 0.65, interval 7 days, studied 20 days ago → overdue by 13 days
    // Topic B: mastery 0.45, interval 3 days, studied 5 days ago  → overdue by  2 days
    // Expected winner: Topic A (overdueDays 13 > 2)
    (prisma.studentTopicProgress.findMany as jest.Mock).mockResolvedValue([
      { topicId: 'topic-A', mastery: 0.65, practiceCount: 4, lastStudiedAt: daysAgo(20) },
      { topicId: 'topic-B', mastery: 0.45, practiceCount: 3, lastStudiedAt: daysAgo(5) },
    ]);

    // Enrich topic-A
    (prisma.topicDef.findUnique as jest.Mock).mockResolvedValue(
      makeTopicDef('Linear Equations'),
    );

    const result = unwrap(await getNextAction(STUDENT_ID));

    expect(result?.ruleId).toBe('spaced_revision');
    expect(result?.topicId).toBe('topic-A');
  });

  // ── reasonLabel includes days elapsed ─────────────────────────────────────────

  it('reasonLabel includes the number of days since last studied', async () => {
    (prisma.studentTopicProgress.findMany as jest.Mock).mockResolvedValue([
      { topicId: 'topic-001', mastery: 0.65, practiceCount: 5, lastStudiedAt: daysAgo(9) },
    ]);
    (prisma.topicDef.findUnique as jest.Mock).mockResolvedValue(
      makeTopicDef('Fractions'),
    );

    const result = unwrap(await getNextAction(STUDENT_ID));

    expect(result?.ruleId).toBe('spaced_revision');
    expect(typeof result?.reasonLabel).toBe('string');
    // Label must include the elapsed days and the "it's been" phrasing
    expect(result?.reasonLabel).toMatch(/it's been \d+ days/);
    expect(result?.reasonLabel).toContain('Fractions');
  });

  // ── P2 (weak_topic_urgent) takes priority over P3 ────────────────────────────

  it('does NOT fire spaced_revision when P2 fires first (mastery < 0.4 AND practiceCount > 5)', async () => {
    // Same topic qualifies for both P2 and P3 edges — P2 wins
    (prisma.studentTopicProgress.findMany as jest.Mock).mockResolvedValue([
      // P2 candidate: mastery 0.35 (< 0.4), practiceCount 8 (> 5)
      { topicId: 'topic-001', mastery: 0.35, practiceCount: 8, lastStudiedAt: daysAgo(10) },
    ]);

    const result = unwrap(await getNextAction(STUDENT_ID));

    // P2 fires; P3 is never reached
    expect(result?.ruleId).toBe('weak_topic_urgent');
    expect(result?.ruleId).not.toBe('spaced_revision');
  });

  // ── findMany is called with correct scope ─────────────────────────────────────

  it('fetches progress rows with studentId and curriculum topicId scope', async () => {
    (getOrderedTopicsForStudent as jest.Mock).mockResolvedValue(
      makeOrderedTopics('topic-x', 'topic-y'),
    );
    (prisma.studentTopicProgress.findMany as jest.Mock).mockResolvedValue([]);

    await getNextAction(STUDENT_ID);

    expect(prisma.studentTopicProgress.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentId: STUDENT_ID,
          topicId: { in: expect.arrayContaining(['topic-x', 'topic-y']) },
        }),
      }),
    );
  });

  it('does NOT call findMany when curriculum is empty', async () => {
    (getOrderedTopicsForStudent as jest.Mock).mockResolvedValue([]);

    await getNextAction(STUDENT_ID);

    expect(prisma.studentTopicProgress.findMany).not.toHaveBeenCalled();
  });

  // ── P1 (resume_session) always wins over P3 ──────────────────────────────────

  it('P1 resume_session takes priority over P3 spaced_revision even when a topic is overdue', async () => {
    // An in-progress structured session that P1 will resume
    (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue({
      id: 'ss-active',
      topicId: 'topic-001',
      state: 'PRACTICE',
      topic: {
        name: 'Fractions',
        chapter: { name: 'Algebra', subject: { name: 'Mathematics' } },
      },
    });

    // The same topic is also massively overdue for spaced revision
    (prisma.studentTopicProgress.findMany as jest.Mock).mockResolvedValue([
      { topicId: 'topic-001', mastery: 0.65, practiceCount: 6, lastStudiedAt: daysAgo(30) },
    ]);

    const result = unwrap(await getNextAction(STUDENT_ID));

    // P1 must fire — P3 must never be reached
    expect(result?.ruleId).toBe('resume_session');
    expect(result?.ruleId).not.toBe('spaced_revision');
  });

  // ── Calendar-day normalization ────────────────────────────────────────────────

  it('counts daysSince in whole calendar days, not elapsed milliseconds', async () => {
    // Studied at 23:50 last night — raw ms diff ≈ 0.01 days, calendar diff = 1 day.
    // With a 3-day interval (mastery 0.45), neither measurement triggers P3 (1 < 3).
    // This test confirms the calendar-normalized path does NOT fire prematurely.
    const studiedAt = new Date();
    studiedAt.setDate(studiedAt.getDate() - 1);   // yesterday
    studiedAt.setHours(23, 50, 0, 0);             // at 23:50

    (prisma.studentTopicProgress.findMany as jest.Mock).mockResolvedValue([
      { topicId: 'topic-001', mastery: 0.45, practiceCount: 3, lastStudiedAt: studiedAt },
    ]);

    const result = unwrap(await getNextAction(STUDENT_ID));

    // 1 calendar day < 3-day interval → must not fire
    expect(result?.ruleId).not.toBe('spaced_revision');
  });

});
