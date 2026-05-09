/**
 * FILE OBJECTIVE:
 * - Unit tests for GET /api/student/topbar-focus route auth and payload mapping.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/student/topbar-focus/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-09T00:00:00Z | copilot | add topbar-focus route tests for unauthorized and mapped weak-topic payload
 */

describe('GET /api/student/topbar-focus', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn(async () => null),
    }));
    jest.doMock('@/lib/homeEngine/getNextAction', () => ({ getNextAction: jest.fn(async () => null) }));
    jest.doMock('@/lib/prisma', () => ({ prisma: { user: { findUnique: jest.fn(async () => null) } } }));
    jest.doMock('@/lib/logger', () => ({
      logger: { logAPI: jest.fn(), error: jest.fn() },
    }));

    const { GET } = await import('@/app/api/student/topbar-focus/route');

    const response = await GET(new Request('http://localhost/api/student/topbar-focus') as any);
    expect(response.status).toBe(401);
  });

  it('returns weak-topic focus payload from getNextAction output', async () => {
    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn(async () => ({ user: { id: 'u1' } })),
    }));
    jest.doMock('@/lib/homeEngine/getNextAction', () => ({
      getNextAction: jest.fn(async () => ({
        topicId: 'topic-1',
        topicName: 'Fractions',
        subject: 'Math',
        chapter: 'Rational Numbers',
        ruleId: 'weak_topic_urgent',
        reasonLabel: 'Low mastery detected',
        actionType: 'practice',
      })),
    }));
    jest.doMock('@/lib/prisma', () => ({
      prisma: { user: { findUnique: jest.fn(async () => ({ currentStreak: 4 })) } },
    }));
    jest.doMock('@/lib/logger', () => ({
      logger: { logAPI: jest.fn(), error: jest.fn() },
    }));

    const { GET } = await import('@/app/api/student/topbar-focus/route');

    const response = await GET(new Request('http://localhost/api/student/topbar-focus') as any);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.focus.mode).toBe('weak');
    expect(body.focus.focusLabel).toContain('Fractions');
    expect(body.focus.askLabel).toBe('Ask Vidya to explain step by step');
    expect(body.focus.actionHref).toBe('/learn');
    expect(body.focus.sourceRuleId).toBe('weak_topic_urgent');
    expect(typeof body.generatedAt).toBe('string');
  });
});
