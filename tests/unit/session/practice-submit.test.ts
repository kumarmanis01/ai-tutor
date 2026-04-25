/**
 * Unit tests for POST /api/session/[sessionId]/practice/submit
 *
 * Covers:
 *   1. Successful first submission — correct score, mastery update scheduled, result in meta
 *   2. Idempotent re-submission   — returns cached result, no mastery re-update
 *   3. Wrong phase (not PRACTICE) — 409 when no prior result exists
 *   4. Session not found          — 404
 *   5. Unauthorized               — 401
 *   6. Missing / empty answers    — 400
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Mock dependencies ────────────────────────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  prisma: {
    structuredSession: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    question: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/session', () => ({
  getServerSessionForHandlers: jest.fn(),
}));

jest.mock('@/lib/session/sessionEngine', () => ({
  isSessionEngineEnabled: jest.fn(),
}));

jest.mock('@/lib/learning/updateTopicProgress', () => ({
  updateStudentTopicProgress: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/session/sessionEvents', () => ({
  recordSessionEvents: jest.fn(),
}));

jest.mock('@/lib/tests', () => ({
  normalizeAnswer: (s: string) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' '),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    logAPI: jest.fn(),
  },
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { isSessionEngineEnabled } from '@/lib/session/sessionEngine';
import { updateStudentTopicProgress } from '@/lib/learning/updateTopicProgress';
import { POST } from '../../../app/api/session/[sessionId]/practice/submit/route';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const USER_ID = 'user-abc';
const SESSION_ID = 'session-xyz';
const TOPIC_ID = 'topic-1';

const mockUser = { id: USER_ID, email: 'student@test.com' };

/** An MCQ question stored in the Question bank. */
const questionA = {
  id: 'q-1',
  type: 'mcq',
  choices: ['Newton', 'Joule', 'Watt', 'Pascal'],
  correctAnswer: 'Newton',
};
const questionB = {
  id: 'q-2',
  type: 'mcq',
  choices: ['Photosynthesis', 'Respiration', 'Transpiration', 'Osmosis'],
  correctAnswer: 'Photosynthesis',
};

const practiceSession = {
  id: SESSION_ID,
  studentId: USER_ID,
  topicId: TOPIC_ID,
  state: 'PRACTICE',
  meta: { phaseTimestamps: { PRACTICE: '2026-03-07T10:00:00.000Z' } },
};

/** Build a mock Request with a JSON body. */
function makeRequest(body: unknown): Request {
  return {
    json: () => Promise.resolve(body),
  } as unknown as Request;
}

/** Build the params object Next.js passes to the route handler. */
function makeParams(sessionId = SESSION_ID) {
  return { params: Promise.resolve({ sessionId }) };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  (getServerSessionForHandlers as jest.Mock).mockResolvedValue({ user: mockUser });
  (isSessionEngineEnabled as jest.Mock).mockReturnValue(true);
  (prisma.question.findMany as jest.Mock).mockResolvedValue([questionA, questionB]);
  (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue(practiceSession);
  (prisma.structuredSession.update as jest.Mock).mockResolvedValue({});
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/session/[sessionId]/practice/submit', () => {
  // ── Case 1: Successful first submission ─────────────────────────────────

  it('grades answers, stores result in meta, schedules mastery update', async () => {
    const body = {
      answers: [
        { questionId: 'q-1', answer: 'Newton' }, // correct
        { questionId: 'q-2', answer: 'Respiration' }, // wrong
      ],
    };

    const res = await POST(makeRequest(body), makeParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.correctAnswers).toBe(1);
    expect(data.totalAnswers).toBe(2);
    expect(data.score).toBeCloseTo(0.5);
    expect(data.percentage).toBe(50);
    expect(data.nextPhase).toBe('TEST');
    expect(data.results).toHaveLength(2);

    // Individual result shapes.
    const q1Result = data.results.find((r: any) => r.questionId === 'q-1');
    expect(q1Result.isCorrect).toBe(true);
    expect(q1Result.correctAnswer).toBe('Newton');

    const q2Result = data.results.find((r: any) => r.questionId === 'q-2');
    expect(q2Result.isCorrect).toBe(false);

    // practiceResult persisted into session meta.
    const updateCall = (prisma.structuredSession.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.where.id).toBe(SESSION_ID);
    expect(updateCall.data.meta.practiceResult.score).toBeCloseTo(0.5);
    expect(updateCall.data.meta.practiceResult.correctAnswers).toBe(1);
    expect(updateCall.data.meta.practiceResult.gradedAt).toBeDefined();

    // Mastery update scheduled fire-and-forget.
    expect(updateStudentTopicProgress).toHaveBeenCalledWith({
      studentId: USER_ID,
      topicId: TOPIC_ID,
      correctAnswers: 1,
      totalAnswers: 2,
      activityType: 'PRACTICE',
    });
  });

  // ── Case 2: Idempotent re-submission ────────────────────────────────────

  it('returns cached result and does NOT re-update mastery on re-submission', async () => {
    const cachedResult = {
      score: 0.8,
      correctAnswers: 4,
      totalAnswers: 5,
      gradedAt: '2026-03-07T10:05:00.000Z',
      answers: [],
    };

    // Session meta already contains a practiceResult.
    (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue({
      ...practiceSession,
      meta: { ...practiceSession.meta, practiceResult: cachedResult },
    });

    const body = { answers: [{ questionId: 'q-1', answer: 'Newton' }] };

    const res = await POST(makeRequest(body), makeParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.score).toBeCloseTo(0.8);
    expect(data.correctAnswers).toBe(4);
    expect(data.nextPhase).toBe('TEST');

    // Must NOT touch the DB again or re-update mastery.
    expect(prisma.structuredSession.update).not.toHaveBeenCalled();
    expect(prisma.question.findMany).not.toHaveBeenCalled();
    expect(updateStudentTopicProgress).not.toHaveBeenCalled();
  });

  // ── Case 3: Wrong phase — no prior result ───────────────────────────────

  it('returns 409 when session is not in PRACTICE state and no cached result exists', async () => {
    (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue({
      ...practiceSession,
      state: 'TEST', // session has already advanced
      meta: { phaseTimestamps: {} }, // no practiceResult
    });

    const body = { answers: [{ questionId: 'q-1', answer: 'Newton' }] };
    const res = await POST(makeRequest(body), makeParams());
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.currentPhase).toBe('TEST');
    expect(prisma.structuredSession.update).not.toHaveBeenCalled();
    expect(updateStudentTopicProgress).not.toHaveBeenCalled();
  });

  // ── Case 4: Session not found ───────────────────────────────────────────

  it('returns 404 when session does not exist or belongs to another student', async () => {
    (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue(null);

    const body = { answers: [{ questionId: 'q-1', answer: 'Newton' }] };
    const res = await POST(makeRequest(body), makeParams());

    expect(res.status).toBe(404);
    expect(prisma.structuredSession.update).not.toHaveBeenCalled();
  });

  // ── Case 5: Unauthorized ─────────────────────────────────────────────────

  it('returns 401 when user is not authenticated', async () => {
    (getServerSessionForHandlers as jest.Mock).mockResolvedValue(null);

    const body = { answers: [{ questionId: 'q-1', answer: 'Newton' }] };
    const res = await POST(makeRequest(body), makeParams());

    expect(res.status).toBe(401);
    expect(prisma.structuredSession.findFirst).not.toHaveBeenCalled();
  });

  // ── Case 6: Missing / empty answers ─────────────────────────────────────

  it('returns 400 when answers array is missing', async () => {
    const body = {}; // no answers field
    const res = await POST(makeRequest(body), makeParams());
    expect(res.status).toBe(400);
  });

  it('returns 400 when answers array is empty', async () => {
    const body = { answers: [] };
    const res = await POST(makeRequest(body), makeParams());
    expect(res.status).toBe(400);
  });

  // ── Case 7: Unknown questionId is silently skipped ───────────────────────

  it('skips answers for unknown questionIds and only grades known ones', async () => {
    const body = {
      answers: [
        { questionId: 'q-1', answer: 'Newton' }, // known — correct
        { questionId: 'q-UNKNOWN', answer: 'X' }, // unknown — skipped
      ],
    };

    const res = await POST(makeRequest(body), makeParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.totalAnswers).toBe(1); // only q-1 counted
    expect(data.correctAnswers).toBe(1);
    expect(data.results).toHaveLength(1);
  });
});
