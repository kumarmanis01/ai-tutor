/**
 * Unit tests for getNextAction — P1 session resume behaviour.
 *
 * Phase 2 aligned: P1 now checks StructuredSession first, then falls back to
 * LearningSession. Tests verify:
 *   1. resume PRACTICE session  — resumePhase: 'PRACTICE', actionType: 'practice'
 *   2. resume TEST session      — resumePhase: 'TEST',     actionType: 'practice'
 *   3. resume OVERVIEW session  — resumePhase: 'OVERVIEW', actionType: 'notes'
 *   4. EXPIRED sessions excluded — StructuredSession query uses notIn filter
 *   5. fallback to LearningSession when no StructuredSession
 *   6. StructuredSession takes priority over LearningSession when both exist
 *   7. no resumePhase for legacy LearningSession resume
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Mock dependencies ────────────────────────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  prisma: {
    homeworkAssignment: { findFirst: jest.fn() }, // P0 — must be mocked or P0 throws
    structuredSession: { findFirst: jest.fn() },
    learningSession: { findFirst: jest.fn() },
    studentTopicProgress: { findFirst: jest.fn(), findMany: jest.fn() }, // P2/P3/P4 — shared findMany
    // Legacy mocks kept so existing test setup code compiles without changes.
    dailyTask: { findFirst: jest.fn() },
    attentionFlag: { findFirst: jest.fn() },
    studentTopicMastery: { findFirst: jest.fn() },
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

const STUDENT_ID = 'student-phase2';

function makeStructuredSession(state: string) {
  return {
    id: 'ss-001',
    topicId: 'topic-001',
    state,
    topic: {
      name: "Newton's Laws",
      chapter: {
        name: 'Forces and Motion',
        subject: { name: 'Physics' },
      },
    },
  };
}

function makeLegacySession() {
  return {
    id: 'ls-001',
    activityType: 'lesson',
    activityRef: 'topic-legacy-001',
    meta: { subject: 'Chemistry', chapter: 'Periodic Table' },
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  // Default: no homework, no active session, no tasks, empty curriculum
  (prisma.homeworkAssignment.findFirst as jest.Mock).mockResolvedValue(null); // P0 — no blocking HW
  (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.learningSession.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.studentTopicProgress.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.studentTopicProgress.findMany as jest.Mock).mockResolvedValue([]); // P2/P3/P4 shared fetch
  (prisma.dailyTask.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.attentionFlag.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.studentTopicMastery.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
  (prisma.topicDef.findUnique as jest.Mock).mockResolvedValue(null);
  (prisma.topicDef.findMany as jest.Mock).mockResolvedValue([]);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getNextAction — P1 session resume', () => {
  // ── StructuredSession scenarios ────────────────────────────────────────────

  it('returns resumePhase PRACTICE and actionType practice when active PRACTICE session exists', async () => {
    (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue(
      makeStructuredSession('PRACTICE')
    );

    const result = unwrap(await getNextAction(STUDENT_ID));

    expect(result).toMatchObject({
      ruleId: 'resume_session',
      resumePhase: 'PRACTICE',
      actionType: 'practice',
      sessionId: 'ss-001',
      topicId: 'topic-001',
      topicName: "Newton's Laws",
      subject: 'Physics',
      chapter: 'Forces and Motion',
    });
  });

  it('returns resumePhase TEST and actionType practice when active TEST session exists', async () => {
    (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue(
      makeStructuredSession('TEST')
    );

    const result = unwrap(await getNextAction(STUDENT_ID));

    expect(result).toMatchObject({
      ruleId: 'resume_session',
      resumePhase: 'TEST',
      actionType: 'practice',
    });
  });

  it('returns resumePhase HOMEWORK and actionType practice when active HOMEWORK session exists', async () => {
    (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue(
      makeStructuredSession('HOMEWORK')
    );

    const result = unwrap(await getNextAction(STUDENT_ID));

    expect(result).toMatchObject({
      ruleId: 'resume_session',
      resumePhase: 'HOMEWORK',
      actionType: 'practice',
    });
  });

  it('returns resumePhase OVERVIEW and actionType notes when active OVERVIEW session exists', async () => {
    (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue(
      makeStructuredSession('OVERVIEW')
    );

    const result = unwrap(await getNextAction(STUDENT_ID));

    expect(result).toMatchObject({
      ruleId: 'resume_session',
      resumePhase: 'OVERVIEW',
      actionType: 'notes',
    });
  });

  it('returns resumePhase EXPLANATION and actionType notes when active EXPLANATION session exists', async () => {
    (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue(
      makeStructuredSession('EXPLANATION')
    );

    const result = unwrap(await getNextAction(STUDENT_ID));

    expect(result).toMatchObject({
      ruleId: 'resume_session',
      resumePhase: 'EXPLANATION',
      actionType: 'notes',
    });
  });

  // ── EXPIRED / COMPLETE session exclusion ───────────────────────────────────

  it('excludes EXPIRED sessions — queries StructuredSession with notIn filter', async () => {
    // Simulates DB returning null because EXPIRED sessions are filtered out
    (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue(null);

    await getNextAction(STUDENT_ID);

    expect(prisma.structuredSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          state: { notIn: ['COMPLETE', 'EXPIRED'] },
        }),
      })
    );
  });

  it('does not return a resume action when the only session is EXPIRED', async () => {
    // EXPIRED session is filtered by the query → findFirst returns null
    (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.learningSession.findFirst as jest.Mock).mockResolvedValue(null);

    const result = unwrap(await getNextAction(STUDENT_ID));

    expect(result?.ruleId).not.toBe('resume_session');
  });

  // ── LearningSession fallback ───────────────────────────────────────────────

  it('falls back to LearningSession when no active StructuredSession exists', async () => {
    (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.learningSession.findFirst as jest.Mock).mockResolvedValue(makeLegacySession());
    // enrichTopic call inside the legacy path
    (prisma.topicDef.findUnique as jest.Mock).mockResolvedValue({
      id: 'topic-legacy-001',
      name: 'Periodic Table Basics',
      chapter: { name: 'Periodic Table', subject: { name: 'Chemistry' } },
    });

    const result = unwrap(await getNextAction(STUDENT_ID));

    expect(result).toMatchObject({
      ruleId: 'resume_session',
      actionType: 'notes',
      sessionId: 'ls-001',
      topicId: 'topic-legacy-001',
    });
  });

  it('sets no resumePhase on a legacy LearningSession resume', async () => {
    (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.learningSession.findFirst as jest.Mock).mockResolvedValue(makeLegacySession());
    (prisma.topicDef.findUnique as jest.Mock).mockResolvedValue({
      id: 'topic-legacy-001',
      name: 'Periodic Table Basics',
      chapter: { name: 'Periodic Table', subject: { name: 'Chemistry' } },
    });

    const result = unwrap(await getNextAction(STUDENT_ID));

    // Legacy sessions do not have structured phases
    expect(result?.resumePhase).toBeUndefined();
  });

  // ── StructuredSession priority ─────────────────────────────────────────────

  it('prefers StructuredSession over LearningSession when both are active', async () => {
    (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue(
      makeStructuredSession('PRACTICE')
    );
    (prisma.learningSession.findFirst as jest.Mock).mockResolvedValue(makeLegacySession());

    const result = unwrap(await getNextAction(STUDENT_ID));

    // Must return the StructuredSession result with resumePhase
    expect(result).toMatchObject({
      ruleId: 'resume_session',
      resumePhase: 'PRACTICE',
      sessionId: 'ss-001',
    });
  });

  it('never queries LearningSession when a StructuredSession is found', async () => {
    (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue(
      makeStructuredSession('TEST')
    );

    await getNextAction(STUDENT_ID);

    // LearningSession query must be skipped entirely — sequential short-circuit
    expect(prisma.learningSession.findFirst).not.toHaveBeenCalled();
  });

  it('returns StructuredSession even when LearningSession has a more recent lastAccessed', async () => {
    // Simulates a student who has both:
    //   - An older StructuredSession (PRACTICE, started 2 hours ago)
    //   - A LearningSession accessed 5 minutes ago (would sort first by recency)
    // The engine must prefer StructuredSession regardless of which is newer.
    (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue({
      ...makeStructuredSession('PRACTICE'),
      id: 'ss-older',
      // startedAt would be 2h ago — not exposed to the test, but the mock
      // returns this session because the DB query orders by startedAt DESC
      // with the COMPLETE/EXPIRED filter — this IS the most recent active one.
    });
    (prisma.learningSession.findFirst as jest.Mock).mockResolvedValue({
      ...makeLegacySession(),
      id: 'ls-newer',
      // lastAccessed would be 5 minutes ago — more recent than the StructuredSession
    });

    const result = unwrap(await getNextAction(STUDENT_ID));

    // Must return the StructuredSession, not the newer LearningSession
    expect(result).toMatchObject({
      ruleId: 'resume_session',
      resumePhase: 'PRACTICE',
      sessionId: 'ss-older',
    });
    // LearningSession must never be consulted
    expect(prisma.learningSession.findFirst).not.toHaveBeenCalled();
  });
});
