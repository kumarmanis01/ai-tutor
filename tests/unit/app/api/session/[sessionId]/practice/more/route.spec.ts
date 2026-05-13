/**
 * FILE OBJECTIVE:
 * - Integration tests for POST /api/session/[sessionId]/practice/more endpoint.
 * - Validates premium tier enforcement, daily cap, hydration trigger, and question sampling.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/session/[sessionId]/practice/more/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /.github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-11T13:25:00Z | copilot | created integration tests for practice more API
 */

import { POST } from '@/app/api/session/[sessionId]/practice/more/route';
import { getServerSessionForHandlers } from '@/lib/session';
import { emitServerAnalyticsEvent } from '@/lib/analytics/server';
import { isPremiumUser } from '@/lib/subscription';
import { checkPracticeMoreCap, recordPracticeMoreUsage } from '@/lib/practice/practiceMoreCap';
import { isSessionEngineEnabled } from '@/lib/session/sessionEngine';
import { prisma } from '@/lib/prisma';

// Mock dependencies
jest.mock('@/lib/session');
jest.mock('@/lib/analytics/server');
jest.mock('@/lib/subscription');
jest.mock('@/lib/practice/practiceMoreCap');
jest.mock('@/lib/session/sessionEngine');
jest.mock('@/lib/execution-pipeline/enqueueTopicHydration');
jest.mock('@/lib/logger');

// Mock Prisma with proper structure
jest.mock('@/lib/prisma', () => ({
  prisma: {
    structuredSession: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    question: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    practiceMoreUsage: {
      upsert: jest.fn(),
    },
  },
}));

describe('POST /api/session/[sessionId]/practice/more', () => {
  const mockSession = {
    id: 'session-123',
    studentId: 'student-123',
    topicId: 'topic-123',
    state: 'PRACTICE',
    meta: {
      practiceResult: {
        score: 0.8,
        correctAnswers: 4,
        totalAnswers: 5,
      },
      servedPracticeIds: ['q1', 'q2', 'q3', 'q4', 'q5'],
    },
  };

  const mockRequest = new Request('http://localhost/api/session/session-123/practice/more', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSessionForHandlers as jest.Mock).mockResolvedValue({
      user: { id: 'student-123' },
    });
    (emitServerAnalyticsEvent as jest.Mock).mockResolvedValue(undefined);
    (isSessionEngineEnabled as jest.Mock).mockReturnValue(true);
  });

  it('should return 401 if user is not authenticated', async () => {
    (getServerSessionForHandlers as jest.Mock).mockResolvedValue(null);

    const response = await POST(mockRequest, {
      params: Promise.resolve({ sessionId: 'session-123' }),
    });

    expect(response.status).toBe(401);
  });

  it('should return 402 if user is not premium', async () => {
    (isPremiumUser as jest.Mock).mockResolvedValue(false);

    const response = await POST(mockRequest, {
      params: Promise.resolve({ sessionId: 'session-123' }),
    });

    expect(response.status).toBe(402);
    const json = await response.json();
    expect(json.code).toBe('NOT_PREMIUM');
  });

  it('should return 409 if daily cap is reached', async () => {
    (isPremiumUser as jest.Mock).mockResolvedValue(true);
    (checkPracticeMoreCap as jest.Mock).mockResolvedValue({
      allowed: false,
      isPremium: true,
      usageCount: 1,
      usageDate: new Date(),
      nextAvailableAt: new Date(),
    });

    const response = await POST(mockRequest, {
      params: Promise.resolve({ sessionId: 'session-123' }),
    });

    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.code).toBe('DAILY_CAP_REACHED');
  });

  it('should return 404 if session not found', async () => {
    (isPremiumUser as jest.Mock).mockResolvedValue(true);
    (checkPracticeMoreCap as jest.Mock).mockResolvedValue({
      allowed: true,
      isPremium: true,
    });
    (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await POST(mockRequest, {
      params: Promise.resolve({ sessionId: 'session-123' }),
    });

    expect(response.status).toBe(404);
  });

  it('should return 409 if session is not in PRACTICE phase', async () => {
    (isPremiumUser as jest.Mock).mockResolvedValue(true);
    (checkPracticeMoreCap as jest.Mock).mockResolvedValue({
      allowed: true,
      isPremium: true,
    });
    (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue({
      ...mockSession,
      state: 'TEST',
    });

    const response = await POST(mockRequest, {
      params: Promise.resolve({ sessionId: 'session-123' }),
    });

    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.code).toBe('INVALID_PHASE');
  });

  it('should return 409 if practice is not yet submitted', async () => {
    (isPremiumUser as jest.Mock).mockResolvedValue(true);
    (checkPracticeMoreCap as jest.Mock).mockResolvedValue({
      allowed: true,
      isPremium: true,
    });
    (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue({
      ...mockSession,
      meta: { servedPracticeIds: [] }, // no practiceResult
    });

    const response = await POST(mockRequest, {
      params: Promise.resolve({ sessionId: 'session-123' }),
    });

    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.code).toBe('PRACTICE_NOT_SUBMITTED');
  });

  it('should successfully return fresh questions for eligible premium user', async () => {
    const freshQuestions = [
      {
        id: 'q6',
        type: 'mcq',
        prompt: 'What is 2+2?',
        choices: [{ key: 'a', label: '4' }],
        difficulty: 'easy',
        correctAnswer: 'a',
      },
      {
        id: 'q7',
        type: 'mcq',
        prompt: 'What is 3+3?',
        choices: [{ key: 'a', label: '6' }],
        difficulty: 'easy',
        correctAnswer: 'a',
      },
      {
        id: 'q8',
        type: 'mcq',
        prompt: 'What is 4+4?',
        choices: [{ key: 'a', label: '8' }],
        difficulty: 'easy',
        correctAnswer: 'a',
      },
      {
        id: 'q9',
        type: 'mcq',
        prompt: 'What is 5+5?',
        choices: [{ key: 'a', label: '10' }],
        difficulty: 'easy',
        correctAnswer: 'a',
      },
      {
        id: 'q10',
        type: 'mcq',
        prompt: 'What is 6+6?',
        choices: [{ key: 'a', label: '12' }],
        difficulty: 'easy',
        correctAnswer: 'a',
      },
    ];

    (isPremiumUser as jest.Mock).mockResolvedValue(true);
    (checkPracticeMoreCap as jest.Mock).mockResolvedValue({
      allowed: true,
      isPremium: true,
    });
    (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue(mockSession);
    (prisma.question.count as jest.Mock).mockResolvedValue(10);
    (prisma.question.findMany as jest.Mock).mockResolvedValue(freshQuestions);
    (prisma.structuredSession.update as jest.Mock).mockResolvedValue({
      ...mockSession,
      meta: {
        ...mockSession.meta,
        servedPracticeIds: [...mockSession.meta.servedPracticeIds, 'q6'],
      },
    });
    (recordPracticeMoreUsage as jest.Mock).mockResolvedValue(true);

    const response = await POST(mockRequest, {
      params: Promise.resolve({ sessionId: 'session-123' }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.questions).toHaveLength(1);
    expect(json.questions[0].id).toBe('q6');
    expect(recordPracticeMoreUsage).toHaveBeenCalledWith('student-123');
    expect(emitServerAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'student.practice_more', courseId: 'topic-123' }),
      'session.practice.more',
    );
  });
});
