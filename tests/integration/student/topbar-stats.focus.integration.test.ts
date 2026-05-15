/**
 * FILE OBJECTIVE:
 * - Integration-style route test for GET /api/student/topbar-stats focus mapping
 *   across multiple Home Engine ruleId outputs in a table-driven suite.
 *
 * LINKED UNIT TEST:
 * - tests/integration/student/topbar-stats.focus.integration.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-09T00:00:00Z | copilot | add table-driven integration test for resume_session, spaced_revision, inactive_return focus mapping
 */

describe('GET /api/student/topbar-stats focus mapping (table-driven)', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  const cases = [
    {
      name: 'resume_session maps to active mode with continue label',
      action: {
        topicId: 'topic-resume',
        topicName: 'Linear Equations',
        subject: 'Math',
        chapter: 'Algebra',
        ruleId: 'resume_session',
        reasonLabel: 'Resume previous session',
        actionType: 'notes',
        sessionId: 'session-123',
      },
      expected: {
        mode: 'active',
        focusContains: 'Continue: Linear Equations',
        actionHref: '/session/session-123',
        askLabel: 'Ask Vidya',
      },
    },
    {
      name: 'spaced_revision maps to exam mode with revision label',
      action: {
        topicId: 'topic-revision',
        topicName: 'Trigonometry',
        subject: 'Math',
        chapter: 'Triangles',
        ruleId: 'spaced_revision',
        reasonLabel: 'Revision due',
        actionType: 'revision',
      },
      expected: {
        mode: 'exam',
        focusContains: 'Revision: Trigonometry',
        actionHref: '/learn',
        askLabel: 'Ask Vidya for quick revision',
      },
    },
    {
      name: 'inactive_return maps to recovery mode and comeback label',
      action: {
        topicId: 'topic-return',
        topicName: 'Fractions',
        subject: 'Math',
        chapter: 'Number System',
        ruleId: 'inactive_return',
        reasonLabel: 'Welcome back after gap',
        actionType: 'practice',
      },
      expected: {
        mode: 'recovery',
        focusContains: 'Continue: Fractions',
        actionHref: '/learn',
        askLabel: 'Need a quick recap? Ask Vidya',
      },
    },
  ] as const;

  it.each(cases)('$name', async ({ action, expected }) => {
    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn(async () => ({ user: { id: 'student-1' } })),
    }));

    jest.doMock('@/lib/homeEngine/getNextAction', () => ({
      getNextAction: jest.fn(async () => action),
    }));

    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: {
          findUnique: jest.fn(async () => ({
            currentStreak: 4,
            level: 3,
            cosmeticUnlocks: [],
            longestStreak: 7,
          })),
        },
      },
    }));

    jest.doMock('@/lib/student/streakShield', () => ({
      isShieldAvailable: jest.fn(async () => true),
    }));

    jest.doMock('@/lib/logger', () => ({
      logger: { logAPI: jest.fn(), error: jest.fn() },
    }));

    const { GET } = await import('@/app/api/student/topbar-stats/route');

    const response = await GET(new Request('http://localhost/api/student/topbar-stats'));
    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.focus.mode).toBe(expected.mode);
    expect(body.focus.focusLabel).toContain(expected.focusContains);
    expect(body.focus.actionHref).toBe(expected.actionHref);
    expect(body.focus.askLabel).toBe(expected.askLabel);
    expect(body.streak).toBe(4);
    expect(body.level).toBe(3);
    expect(body.shieldAvailable).toBe(true);
    expect(typeof body.generatedAt).toBe('string');
  });
});
