/**
 * Unit tests for Phase 5 adaptive difficulty.
 *
 * Covers:
 *   Part 1 — resolveTargetDifficulty() pure function
 *     • Spec-mandated thresholds: 0.30 → easy, 0.60 → medium, 0.85 → hard
 *     • Null input → medium (safe default for new students)
 *     • Boundary values: 0.50 (easy→medium) and 0.75 (medium→hard)
 *     • Edge values: 0.0 (floor) and 1.0 (ceiling)
 *
 *   Part 2 — resolvePhaseContent() PRACTICE integration
 *     • DB query includes difficulty: 'easy' | 'medium' | 'hard' from mastery
 *     • Fallback to any-difficulty when target band is empty
 *     • Returns 'pending' when topic has no questions at all
 *     • Backward-compatible: omitting studentMastery defaults to medium
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Mock dependencies ────────────────────────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  prisma: {
    question: { findMany: jest.fn() },
    generatedTest: { findFirst: jest.fn() },
    topicNote: { findFirst: jest.fn() },
    topicDef: { findUnique: jest.fn() },
    homeworkAssignment: { findFirst: jest.fn() },
    structuredSession: { findUnique: jest.fn().mockResolvedValue({ meta: null }) },
  },
}));

jest.mock('@/lib/session/sessionEngine', () => ({
  PHASE_METADATA: {},
  UPCOMING_PHASES_ORDER: [],
}));

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { resolveTargetDifficulty } from '@/lib/ai/adaptiveDifficulty';
import { resolvePhaseContent } from '@/lib/session/getPhaseContent';
import { prisma } from '@/lib/prisma';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal question fixture returned by the mock DB. */
function makeQuestion(difficulty: string, id = 'q-001') {
  return { id, type: 'mcq', prompt: `Q-${id}?`, choices: null, correctAnswer: id, difficulty };
}

const TOPIC_ID = 'topic-phase5';
const SESSION_ID = 'sess-phase5';
const STUDENT_ID = 'student-phase5';

// ─── Part 1: resolveTargetDifficulty() ───────────────────────────────────────

describe('resolveTargetDifficulty', () => {

  // ── Spec-mandated thresholds ──────────────────────────────────────────────

  it('returns "easy" for accuracy 0.30 (< 0.50)', () => {
    expect(resolveTargetDifficulty(0.30)).toBe('easy');
  });

  it('returns "medium" for accuracy 0.60 (in [0.50, 0.75))', () => {
    expect(resolveTargetDifficulty(0.60)).toBe('medium');
  });

  it('returns "hard" for accuracy 0.85 (>= 0.75)', () => {
    expect(resolveTargetDifficulty(0.85)).toBe('hard');
  });

  it('returns "medium" for null (no mastery record — safe default)', () => {
    expect(resolveTargetDifficulty(null)).toBe('medium');
  });

  // ── Boundary values ───────────────────────────────────────────────────────

  it('returns "medium" for accuracy exactly 0.50 (lower bound of medium band)', () => {
    expect(resolveTargetDifficulty(0.50)).toBe('medium');
  });

  it('returns "hard" for accuracy exactly 0.75 (lower bound of hard band)', () => {
    expect(resolveTargetDifficulty(0.75)).toBe('hard');
  });

  it('returns "easy" for accuracy 0.49 (just below medium band)', () => {
    expect(resolveTargetDifficulty(0.49)).toBe('easy');
  });

  it('returns "medium" for accuracy 0.74 (just below hard band)', () => {
    expect(resolveTargetDifficulty(0.74)).toBe('medium');
  });

  // ── Edge values ───────────────────────────────────────────────────────────

  it('returns "easy" for accuracy 0.0 (absolute floor)', () => {
    expect(resolveTargetDifficulty(0.0)).toBe('easy');
  });

  it('returns "hard" for accuracy 1.0 (absolute ceiling)', () => {
    expect(resolveTargetDifficulty(1.0)).toBe('hard');
  });

});

// ─── Part 2: resolvePhaseContent PRACTICE — difficulty selector integration ───

describe('resolvePhaseContent PRACTICE — adaptive difficulty integration', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: questions available at every difficulty band
    (prisma.question.findMany as jest.Mock).mockResolvedValue([
      makeQuestion('medium'),
    ]);
  });

  // ── Difficulty selection from mastery ─────────────────────────────────────

  it('queries "easy" questions for studentMastery 0.30', async () => {
    await resolvePhaseContent('PRACTICE', TOPIC_ID, SESSION_ID, STUDENT_ID, 0.30);

    expect(prisma.question.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ topicId: TOPIC_ID, difficulty: 'easy' }),
      }),
    );
  });

  it('queries "medium" questions for studentMastery 0.60', async () => {
    await resolvePhaseContent('PRACTICE', TOPIC_ID, SESSION_ID, STUDENT_ID, 0.60);

    expect(prisma.question.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ topicId: TOPIC_ID, difficulty: 'medium' }),
      }),
    );
  });

  it('queries "hard" questions for studentMastery 0.85', async () => {
    await resolvePhaseContent('PRACTICE', TOPIC_ID, SESSION_ID, STUDENT_ID, 0.85);

    expect(prisma.question.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ topicId: TOPIC_ID, difficulty: 'hard' }),
      }),
    );
  });

  // ── Null / omitted mastery defaults to medium ─────────────────────────────

  it('queries "medium" questions when studentMastery is null', async () => {
    await resolvePhaseContent('PRACTICE', TOPIC_ID, SESSION_ID, STUDENT_ID, null);

    expect(prisma.question.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ difficulty: 'medium' }),
      }),
    );
  });

  it('queries "medium" questions when studentMastery is omitted (backward compat)', async () => {
    await resolvePhaseContent('PRACTICE', TOPIC_ID, SESSION_ID, STUDENT_ID);

    expect(prisma.question.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ difficulty: 'medium' }),
      }),
    );
  });

  // ── Fallback behavior ─────────────────────────────────────────────────────

  it('falls back to any-difficulty query when target band returns no questions', async () => {
    (prisma.question.findMany as jest.Mock)
      .mockResolvedValueOnce([])                        // primary (hard) → empty
      .mockResolvedValueOnce([makeQuestion('easy')]);   // fallback → returns something

    const result = await resolvePhaseContent('PRACTICE', TOPIC_ID, SESSION_ID, STUDENT_ID, 0.85);

    expect(result.type).toBe('practice');
    // Two queries: one with difficulty filter, one without
    expect(prisma.question.findMany).toHaveBeenCalledTimes(2);
    // Second call must NOT have a difficulty filter
    const secondCall = (prisma.question.findMany as jest.Mock).mock.calls[1][0];
    expect(secondCall.where).not.toHaveProperty('difficulty');
  });

  it('returns pending when topic has no questions at any difficulty', async () => {
    (prisma.question.findMany as jest.Mock).mockResolvedValue([]); // both queries fail

    const result = await resolvePhaseContent('PRACTICE', TOPIC_ID, SESSION_ID, STUDENT_ID, 0.60);

    expect(result.type).toBe('pending');
    expect(prisma.question.findMany).toHaveBeenCalledTimes(2);
  });

  // ── Return shape ──────────────────────────────────────────────────────────

  it('returns type "practice" with questions array when content is found', async () => {
    (prisma.question.findMany as jest.Mock).mockResolvedValue([
      makeQuestion('medium', 'q-001'),
      makeQuestion('medium', 'q-002'),
    ]);

    const result = await resolvePhaseContent('PRACTICE', TOPIC_ID, SESSION_ID, STUDENT_ID, 0.60);

    expect(result.type).toBe('practice');
    if (result.type === 'practice') {
      expect(result.questions).toHaveLength(2);
    }
  });

});
