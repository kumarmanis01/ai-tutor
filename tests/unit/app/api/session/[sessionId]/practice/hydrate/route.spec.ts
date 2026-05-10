/**
 * FILE OBJECTIVE:
 * - Unit tests for GET/POST /api/session/[sessionId]/practice/hydrate handlers.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/session/[sessionId]/practice/hydrate/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - /.github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-08T00:00:00Z | copilot | add tests for practice hydration status + manual enqueue endpoint
 * - 2026-05-09T00:00:00Z | copilot | assert hydration request emails are sent to the operations inbox
 * - 2026-05-09T00:00:00Z | copilot | replace hardcoded hydration alert inbox with centralized email constant
 * - 2026-05-10T00:00:00Z | copilot | add dedup regression test for on-demand GeneratedQuestion promotion
 */

import { PRACTICE_HYDRATION_ALERT_EMAIL } from '@/lib/email/functionalityEmails';

describe('GET /api/session/[sessionId]/practice/hydrate', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn(async () => null) }));
    jest.doMock('@/lib/session/sessionEngine', () => ({ isSessionEngineEnabled: jest.fn(() => true) }));
    jest.doMock('@/lib/prisma', () => ({ prisma: {} }));
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), info: jest.fn(), error: jest.fn() } }));

    const { GET } = await import('@/app/api/session/[sessionId]/practice/hydrate/route');
    const res = await GET(new Request('http://localhost') as any, {
      params: Promise.resolve({ sessionId: 's1' }),
    });

    expect(res.status).toBe(401);
  });

  it('returns hydration running status when job exists and no active questions', async () => {
    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn(async () => ({ user: { id: 'student-1' } })),
    }));
    jest.doMock('@/lib/session/sessionEngine', () => ({ isSessionEngineEnabled: jest.fn(() => true) }));
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        structuredSession: {
          findFirst: jest.fn(async () => ({ id: 's1', topicId: 't1', state: 'PRACTICE' })),
        },
        question: {
          count: jest.fn(async () => 0),
        },
        hydrationJob: {
          findFirst: jest.fn(async () => ({ id: 'h1' })),
        },
      },
    }));
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), info: jest.fn(), error: jest.fn() } }));

    const { GET } = await import('@/app/api/session/[sessionId]/practice/hydrate/route');
    const res = await GET(new Request('http://localhost') as any, {
      params: Promise.resolve({ sessionId: 's1' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.hasActiveQuestions).toBe(false);
    expect(body.isHydrationRunning).toBe(true);
    expect(body.runningJobId).toBe('h1');
  });

  it('promotes only unique GeneratedQuestion content when no active questions and no running job', async () => {
    const questionFindMany = jest
      .fn(async () => [])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const questionUpsert = jest.fn(async () => ({}));

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn(async () => ({ user: { id: 'student-1' } })),
    }));
    jest.doMock('@/lib/session/sessionEngine', () => ({ isSessionEngineEnabled: jest.fn(() => true) }));
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        structuredSession: {
          findFirst: jest.fn(async () => ({ id: 's1', topicId: 't1', state: 'PRACTICE' })),
        },
        question: {
          count: jest.fn(async () => 0),
          findMany: questionFindMany,
          upsert: questionUpsert,
        },
        generatedQuestion: {
          findMany: jest.fn(async () => [
            {
              id: 'gq-1',
              type: 'mcq',
              question: 'What is 2 + 2?',
              options: ['3', '4'],
              answer: '4',
              test: {
                difficulty: 'medium',
                topicId: 't1',
                topic: {
                  chapter: {
                    name: 'Numbers',
                    subject: {
                      name: 'Math',
                      class: {
                        grade: 7,
                        board: { slug: 'cbse' },
                      },
                    },
                  },
                },
              },
            },
            {
              id: 'gq-2',
              type: 'mcq',
              question: 'What is 2 + 2?',
              options: ['3', '4'],
              answer: '4',
              test: {
                difficulty: 'medium',
                topicId: 't1',
                topic: {
                  chapter: {
                    name: 'Numbers',
                    subject: {
                      name: 'Math',
                      class: {
                        grade: 7,
                        board: { slug: 'cbse' },
                      },
                    },
                  },
                },
              },
            },
          ]),
        },
        hydrationJob: {
          findFirst: jest.fn(async () => null),
        },
      },
    }));
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), info: jest.fn(), error: jest.fn() } }));

    const { GET } = await import('@/app/api/session/[sessionId]/practice/hydrate/route');
    const res = await GET(new Request('http://localhost') as any, {
      params: Promise.resolve({ sessionId: 's1' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.hasActiveQuestions).toBe(true);
    expect(questionUpsert).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/session/[sessionId]/practice/hydrate', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('returns already_running when there is a pending/running job', async () => {
    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn(async () => ({ user: { id: 'student-1' } })),
    }));
    jest.doMock('@/lib/session/sessionEngine', () => ({ isSessionEngineEnabled: jest.fn(() => true) }));
    jest.doMock('@/lib/execution-pipeline/enqueueTopicHydration', () => ({
      enqueueQuestionsHydration: jest.fn(),
    }));
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        structuredSession: {
          findFirst: jest.fn(async () => ({ id: 's1', topicId: 't1', state: 'PRACTICE' })),
        },
        question: {
          count: jest.fn(async () => 0),
        },
        hydrationJob: {
          findFirst: jest.fn(async () => ({ id: 'h-running' })),
        },
      },
    }));
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), info: jest.fn(), error: jest.fn() } }));

    const { POST } = await import('@/app/api/session/[sessionId]/practice/hydrate/route');
    const res = await POST(new Request('http://localhost', { method: 'POST' }) as any, {
      params: Promise.resolve({ sessionId: 's1' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.enqueued).toBe(false);
    expect(body.reason).toBe('already_running');
    expect(body.jobId).toBe('h-running');
  });

  it('enqueues questions hydration with force and 10-question target when no job is running', async () => {
    const enqueueQuestionsHydration = jest.fn(async () => ({ created: true, jobId: 'h2' }));
    const sendMailSafe = jest.fn();

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn(async () => ({ user: { id: 'student-1' } })),
    }));
    jest.doMock('@/lib/session/sessionEngine', () => ({ isSessionEngineEnabled: jest.fn(() => true) }));
    jest.doMock('@/lib/execution-pipeline/enqueueTopicHydration', () => ({
      enqueueQuestionsHydration,
    }));
    jest.doMock('@/lib/mailer', () => ({
      sendMailSafe,
    }));
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        structuredSession: {
          findFirst: jest.fn(async () => ({ id: 's1', topicId: 't1', state: 'PRACTICE' })),
        },
        question: {
          count: jest.fn(async () => 0),
        },
        hydrationJob: {
          findFirst: jest.fn(async () => null),
        },
      },
    }));
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), info: jest.fn(), error: jest.fn() } }));

    const { POST } = await import('@/app/api/session/[sessionId]/practice/hydrate/route');
    const res = await POST(new Request('http://localhost', { method: 'POST' }) as any, {
      params: Promise.resolve({ sessionId: 's1' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.enqueued).toBe(true);
    expect(body.reason).toBe('enqueued');
    expect(sendMailSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        to: PRACTICE_HYDRATION_ALERT_EMAIL,
        subject: expect.stringContaining('Practice hydration requested for topic t1'),
      }),
    );
    expect(enqueueQuestionsHydration).toHaveBeenCalledWith({
      topicId: 't1',
      language: 'en',
      difficulty: 'medium',
      force: true,
      questionsPerDifficulty: 10,
    });
  });
});
