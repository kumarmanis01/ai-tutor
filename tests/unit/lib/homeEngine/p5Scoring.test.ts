/**
 * Unit tests for the P5 topic scoring step in the Home Tutor Engine.
 *
 * Tests target rankTopics() from lib/recommendations/topicRanker — the function
 * called by p5_scoredTopic() inside getNextAction.
 *
 * Covers:
 *   1. Returns highest-scoring topic first
 *   2. Skips fully mastered topics (mastery >= 0.8 AND practiceCount >= 5)
 *   3. Applies WEAK_TOPIC_BOOST for struggling topics (mastery < 0.4 AND in weakTopicIds)
 *   4. Applies PREREQUISITE_PENALTY when prerequisites are not met
 *   5. Caps scoring to FRONTIER_SIZE (50) topics from the frontier
 *   6. Scores only topics that have at least one active Concept
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Mock dependencies ────────────────────────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    concept: { findMany: jest.fn() },
    studentLearningProfile: { findUnique: jest.fn() },
    studentTopicProgress: { findMany: jest.fn(), aggregate: jest.fn() },
    learningSession: { count: jest.fn() },
    homeworkAssignment: { groupBy: jest.fn() },
  },
}));

jest.mock('@/lib/redis', () => ({
  getRedis: jest.fn(() => ({ del: jest.fn() })),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/learning/momentumScore', () => ({
  computeMomentumScore: jest.fn(),
}));

jest.mock('@/lib/learning/getWeakTopics', () => ({
  getWeakTopicIds: jest.fn(),
}));

jest.mock('@/lib/curriculum/curriculumGraph', () => ({
  getCurriculumGraph: jest.fn(),
  arePrerequisitesMet: jest.fn(),
}));

jest.mock('@/lib/mail', () => ({
  sendTopicRankerCoverageAlertSafe: jest.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma';
import { computeMomentumScore } from '@/lib/learning/momentumScore';
import { getWeakTopicIds } from '@/lib/learning/getWeakTopics';
import { getCurriculumGraph, arePrerequisitesMet } from '@/lib/curriculum/curriculumGraph';
import { sendTopicRankerCoverageAlertSafe } from '@/lib/mail';
import { rankTopics, WEIGHTS, FRONTIER_SIZE } from '@/lib/recommendations/topicRanker';
import type { OrderedTopic } from '@/lib/homeEngine/getOrderedTopicsForStudent';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const STUDENT_ID = 'student-001';

/** Build a minimal OrderedTopic fixture (cast from a partial shape). */
function makeTopic(
  id: string,
  chapterOrder: number,
  topicOrder: number,
  parentId: string | null = null,
): OrderedTopic {
  return {
    id,
    name: `Topic ${id}`,
    order: topicOrder,
    parentId,
    chapter: {
      id: `chapter-${chapterOrder}`,
      name: `Chapter ${chapterOrder}`,
      order: chapterOrder,
      subject: { id: 'sub-1', name: 'Mathematics' },
    },
  } as unknown as OrderedTopic;
}

/** Shared default mocks used by most tests. */
function setDefaultMocks() {
  (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
  (prisma.concept.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.studentLearningProfile.findUnique as jest.Mock).mockResolvedValue(null);
  (prisma.studentTopicProgress.findMany as jest.Mock).mockResolvedValue([]);
  (computeMomentumScore as jest.Mock).mockResolvedValue({ score: 0 });
  (getWeakTopicIds as jest.Mock).mockResolvedValue(new Set<string>());
  (getCurriculumGraph as jest.Mock).mockResolvedValue({ topics: [], edges: [] });
  (arePrerequisitesMet as jest.Mock).mockReturnValue(true);
  (sendTopicRankerCoverageAlertSafe as jest.Mock).mockResolvedValue(undefined);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('rankTopics — P5 scoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setDefaultMocks();
  });

  // ── 1. Returns highest-scoring topic first ──────────────────────────────────
  it('returns the highest-scoring topic first', async () => {
    const topics = [
      makeTopic('topic-A', 1, 1), // plain topic
      makeTopic('topic-B', 1, 2), // will get WEAK_TOPIC_BOOST
    ];

    // topic-B has been practised but is still weak
    (prisma.studentTopicProgress.findMany as jest.Mock).mockResolvedValue([
      { topicId: 'topic-B', mastery: 0.2, practiceCount: 8, lastStudiedAt: null },
    ]);

    // topic-B flagged as weak → +40 boost
    (getWeakTopicIds as jest.Mock).mockResolvedValue(new Set(['topic-B']));
    (prisma.concept.findMany as jest.Mock).mockResolvedValue([
      { topicId: 'topic-A' },
      { topicId: 'topic-B' },
    ]);

    const results = await rankTopics(STUDENT_ID, { preloadedOrderedTopics: topics });

    expect(results.length).toBeGreaterThanOrEqual(1);
    // topic-A is the frontier (first unstarted) → CURRICULUM_NEXT_BOOST +30
    // topic-B has WEAK_TOPIC_BOOST +40, but no CURRICULUM_NEXT_BOOST
    // topic-A score: BASE(10) + CURRICULUM_NEXT_BOOST(30) = 40
    // topic-B score: BASE(10) + WEAK_TOPIC_BOOST(40) = 50
    expect(results[0].topicId).toBe('topic-B');
    expect(results[0].score).toBeGreaterThan(results[1]?.score ?? -Infinity);
  });

  // ── 2. Skips fully mastered topics ─────────────────────────────────────────
  it('skips topics where mastery >= 0.8 AND practiceCount >= 5', async () => {
    const topics = [
      makeTopic('mastered-topic', 1, 1),
      makeTopic('next-topic', 1, 2),
    ];

    (prisma.studentTopicProgress.findMany as jest.Mock).mockResolvedValue([
      { topicId: 'mastered-topic', mastery: 0.9, practiceCount: 6, lastStudiedAt: null },
    ]);
    (prisma.concept.findMany as jest.Mock).mockResolvedValue([
      { topicId: 'mastered-topic' },
      { topicId: 'next-topic' },
    ]);

    const results = await rankTopics(STUDENT_ID, { preloadedOrderedTopics: topics });

    const ids = results.map((r) => r.topicId);
    expect(ids).not.toContain('mastered-topic');
    expect(ids).toContain('next-topic');
  });

  it('does NOT skip a topic with mastery >= 0.8 but practiceCount < 5', async () => {
    const topics = [makeTopic('nearly-mastered', 1, 1)];

    (prisma.studentTopicProgress.findMany as jest.Mock).mockResolvedValue([
      { topicId: 'nearly-mastered', mastery: 0.85, practiceCount: 3, lastStudiedAt: null },
    ]);
    (prisma.concept.findMany as jest.Mock).mockResolvedValue([{ topicId: 'nearly-mastered' }]);

    const results = await rankTopics(STUDENT_ID, { preloadedOrderedTopics: topics });

    expect(results.map((r) => r.topicId)).toContain('nearly-mastered');
  });

  // ── 3. WEAK_TOPIC_BOOST applies correctly ───────────────────────────────────
  it('adds WEAK_TOPIC_BOOST signal when topic is in the weak set', async () => {
    const topics = [makeTopic('struggling-topic', 1, 1)];

    (prisma.studentTopicProgress.findMany as jest.Mock).mockResolvedValue([
      { topicId: 'struggling-topic', mastery: 0.3, practiceCount: 7, lastStudiedAt: null },
    ]);
    (getWeakTopicIds as jest.Mock).mockResolvedValue(new Set(['struggling-topic']));
    (prisma.concept.findMany as jest.Mock).mockResolvedValue([{ topicId: 'struggling-topic' }]);

    const results = await rankTopics(STUDENT_ID, { preloadedOrderedTopics: topics });

    expect(results).toHaveLength(1);
    expect(results[0].signals.weakTopicBoost).toBe(WEIGHTS.WEAK_TOPIC_BOOST);
    expect(results[0].score).toBeGreaterThanOrEqual(WEIGHTS.BASE + WEIGHTS.WEAK_TOPIC_BOOST);
  });

  it('does NOT add WEAK_TOPIC_BOOST when topic is NOT in the weak set', async () => {
    const topics = [makeTopic('normal-topic', 1, 1)];

    (getWeakTopicIds as jest.Mock).mockResolvedValue(new Set<string>());
    (prisma.concept.findMany as jest.Mock).mockResolvedValue([{ topicId: 'normal-topic' }]);

    const results = await rankTopics(STUDENT_ID, { preloadedOrderedTopics: topics });

    expect(results[0].signals.weakTopicBoost).toBeUndefined();
  });

  // ── 4. PREREQUISITE_PENALTY applies correctly ───────────────────────────────
  it('adds PREREQUISITE_PENALTY signal when prerequisites are not met', async () => {
    const topics = [makeTopic('gated-topic', 1, 1)];

    (arePrerequisitesMet as jest.Mock).mockReturnValue(false);
    (prisma.concept.findMany as jest.Mock).mockResolvedValue([{ topicId: 'gated-topic' }]);

    const results = await rankTopics(STUDENT_ID, { preloadedOrderedTopics: topics });

    expect(results[0].signals.prerequisitePenalty).toBe(WEIGHTS.PREREQUISITE_PENALTY);
    expect(results[0].score).toBeLessThan(WEIGHTS.BASE); // penalty drives score below base
  });

  it('does NOT add PREREQUISITE_PENALTY when prerequisites are met', async () => {
    const topics = [makeTopic('open-topic', 1, 1)];

    (arePrerequisitesMet as jest.Mock).mockReturnValue(true);
    (prisma.concept.findMany as jest.Mock).mockResolvedValue([{ topicId: 'open-topic' }]);

    const results = await rankTopics(STUDENT_ID, { preloadedOrderedTopics: topics });

    expect(results[0].signals.prerequisitePenalty).toBeUndefined();
  });

  // ── 5. Scoring capped at FRONTIER_SIZE topics ───────────────────────────────
  it(`scores at most FRONTIER_SIZE (${FRONTIER_SIZE}) topics from the frontier`, async () => {
    // Build FRONTIER_SIZE + 10 topics, all unstarted.
    const total = FRONTIER_SIZE + 10;
    const topics = Array.from({ length: total }, (_, i) =>
      makeTopic(`topic-${i}`, 1, i + 1),
    );

    // No progress — all topics are unstarted, frontier starts at index 0.
    (prisma.studentTopicProgress.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.concept.findMany as jest.Mock).mockResolvedValue(
      topics.map((topic) => ({ topicId: topic.id })),
    );

    const results = await rankTopics(STUDENT_ID, { preloadedOrderedTopics: topics });

    expect(results.length).toBeLessThanOrEqual(FRONTIER_SIZE);
  });

  it('starts scoring from the first unstarted topic (skips already-started ones)', async () => {
    // 3 topics: first 2 have been started, 3rd is unstarted.
    const topics = [
      makeTopic('started-1', 1, 1),
      makeTopic('started-2', 1, 2),
      makeTopic('unstarted-3', 1, 3),
    ];

    (prisma.studentTopicProgress.findMany as jest.Mock).mockResolvedValue([
      { topicId: 'started-1', mastery: 0.9, practiceCount: 6, lastStudiedAt: null },
      { topicId: 'started-2', mastery: 0.9, practiceCount: 6, lastStudiedAt: null },
    ]);
    (prisma.concept.findMany as jest.Mock).mockResolvedValue([
      { topicId: 'started-1' },
      { topicId: 'started-2' },
      { topicId: 'unstarted-3' },
    ]);

    const results = await rankTopics(STUDENT_ID, { preloadedOrderedTopics: topics });

    // Mastered topics are skipped by the skip guard, but the frontier starts at
    // the first unstarted topic — so 'unstarted-3' should be scored.
    const ids = results.map((r) => r.topicId);
    expect(ids).toContain('unstarted-3');
    expect(ids).not.toContain('started-1');
    expect(ids).not.toContain('started-2');
  });

  // ── 6. MOMENTUM_BOOST applies proportionally ────────────────────────────────
  it('adds a proportional MOMENTUM_BOOST when momentum score > 0', async () => {
    const topics = [makeTopic('any-topic', 1, 1)];

    (computeMomentumScore as jest.Mock).mockResolvedValue({ score: 0.5 });
    (prisma.concept.findMany as jest.Mock).mockResolvedValue([{ topicId: 'any-topic' }]);

    const results = await rankTopics(STUDENT_ID, { preloadedOrderedTopics: topics });

    const expectedBoost = Math.round(WEIGHTS.MOMENTUM_BOOST * 0.5);
    expect(results[0].signals.momentumBoost).toBe(expectedBoost);
  });

  it('does NOT add MOMENTUM_BOOST when momentum score is 0', async () => {
    const topics = [makeTopic('any-topic', 1, 1)];

    (computeMomentumScore as jest.Mock).mockResolvedValue({ score: 0 });
    (prisma.concept.findMany as jest.Mock).mockResolvedValue([{ topicId: 'any-topic' }]);

    const results = await rankTopics(STUDENT_ID, { preloadedOrderedTopics: topics });

    expect(results[0].signals.momentumBoost).toBeUndefined();
  });

  // ── 7. Returns empty array when all topics are mastered ─────────────────────
  it('returns an empty array when all topics in the frontier are fully mastered', async () => {
    const topics = [makeTopic('mastered', 1, 1)];

    (prisma.studentTopicProgress.findMany as jest.Mock).mockResolvedValue([
      { topicId: 'mastered', mastery: 1.0, practiceCount: 10, lastStudiedAt: null },
    ]);
    (prisma.concept.findMany as jest.Mock).mockResolvedValue([{ topicId: 'mastered' }]);

    const results = await rankTopics(STUDENT_ID, { preloadedOrderedTopics: topics });

    expect(results).toHaveLength(0);
  });

  // ── 8. BASE signal is always present ───────────────────────────────────────
  it('includes the BASE signal for every scored topic', async () => {
    const topics = [makeTopic('base-topic', 1, 1)];
    (prisma.concept.findMany as jest.Mock).mockResolvedValue([{ topicId: 'base-topic' }]);

    const results = await rankTopics(STUDENT_ID, { preloadedOrderedTopics: topics });

    expect(results[0].signals.base).toBe(WEIGHTS.BASE);
  });

  it('filters out topics that do not have an active concept', async () => {
    const topics = [
      makeTopic('topic-with-concept', 1, 1),
      makeTopic('topic-without-concept', 1, 2),
    ];

    (prisma.concept.findMany as jest.Mock).mockResolvedValue([{ topicId: 'topic-with-concept' }]);

    const results = await rankTopics(STUDENT_ID, { preloadedOrderedTopics: topics });

    expect(results.map((r) => r.topicId)).toEqual(['topic-with-concept']);
    expect(prisma.concept.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isSuspended: false,
          topicId: { in: expect.arrayContaining(['topic-with-concept', 'topic-without-concept']) },
        }),
      }),
    );
    expect(sendTopicRankerCoverageAlertSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: STUDENT_ID,
        frontierSize: 2,
        rankableFrontierSize: 1,
        filteredTopicIds: ['topic-without-concept'],
      }),
    );
  });

  it('returns empty when frontier has no active concepts', async () => {
    const topics = [
      makeTopic('topic-1', 1, 1),
      makeTopic('topic-2', 1, 2),
    ];

    (prisma.concept.findMany as jest.Mock).mockResolvedValue([]);

    const results = await rankTopics(STUDENT_ID, { preloadedOrderedTopics: topics });

    expect(results).toHaveLength(0);
    expect(sendTopicRankerCoverageAlertSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: STUDENT_ID,
        frontierSize: 2,
        rankableFrontierSize: 0,
        filteredTopicIds: ['topic-1', 'topic-2'],
      }),
    );
  });

  it('does not send coverage alert when all frontier topics have active concepts', async () => {
    const topics = [
      makeTopic('topic-1', 1, 1),
      makeTopic('topic-2', 1, 2),
    ];

    (prisma.concept.findMany as jest.Mock).mockResolvedValue([
      { topicId: 'topic-1' },
      { topicId: 'topic-2' },
    ]);

    await rankTopics(STUDENT_ID, { preloadedOrderedTopics: topics });

    expect(sendTopicRankerCoverageAlertSafe).not.toHaveBeenCalled();
  });
});
