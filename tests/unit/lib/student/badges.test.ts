/**
 * FILE OBJECTIVE:
 * - Unit tests for `checkSessionBadges` to ensure parent milestone notifications
 *   are invoked when badges are awarded.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/student/badges.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-11T00:00:00Z | copilot | created tests for badge -> parent notify wiring
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('checkSessionBadges', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('awards streak badge and notifies parents', async () => {
    const sendMock = jest.fn(async () => ({ sent: true }));

    const prismaMock: any = {
      userBadge: {
        findMany: jest.fn(async () => []),
        createMany: jest.fn(async () => ({ count: 1 })),
      },
      learningSession: { count: jest.fn(async () => 1), findFirst: jest.fn(async () => null) },
      badge: { upsert: jest.fn(async () => ({})) },
      user: {
        findUnique: jest.fn(async () => ({ name: 'Asha', cosmeticUnlocks: [] })),
        update: jest.fn(async () => ({})),
      },
      parentStudent: {
        findMany: jest.fn(async () => [
          {
            parent: {
              id: 'p1',
              email: 'p@example.test',
              phone: null,
              name: 'Parent',
              language: 'en',
            },
          },
        ]),
      },
      $transaction: jest.fn(async () => []),
    };

    // Minimal prisma mock used by the module
    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));
    jest.doMock('@/lib/notifications/delivery', () => ({
      sendParentMilestoneNotification: sendMock,
    }));

    const { checkSessionBadges } = await import('@/lib/student/badges');

    const awarded = await checkSessionBadges({
      studentId: 's1',
      sessionId: 'sess1',
      currentStreak: 7,
      masteryAfter: 0,
    });

    // Expect at least the 7-day streak to be awarded
    expect(awarded.some((b: any) => b.key === 'streak_7')).toBe(true);
    // Parent notification should be invoked
    expect(sendMock).toHaveBeenCalled();
  });
});
import { BADGE_DEFINITIONS } from '@/lib/student/badges';

// Pure-logic tests: verify badge definitions are correct and complete.
// checkSessionBadges() is DB-dependent and covered by integration tests.

describe('BADGE_DEFINITIONS', () => {
  test('should contain all required badge types', () => {
    const keys = BADGE_DEFINITIONS.map((b) => b.key);
    expect(keys).toContain('streak_7');
    expect(keys).toContain('streak_14');
    expect(keys).toContain('streak_30');
    expect(keys).toContain('streak_60');
    expect(keys).toContain('streak_100');
    expect(keys).toContain('consistency');
    expect(keys).toContain('comeback');
    expect(keys).toContain('chapter_master');
    expect(keys).toContain('mock_complete');
    expect(keys).toContain('speedster');
  });

  test('every badge has non-empty key, name, description, and icon', () => {
    for (const badge of BADGE_DEFINITIONS) {
      expect(badge.key.length).toBeGreaterThan(0);
      expect(badge.name.length).toBeGreaterThan(0);
      expect(badge.description.length).toBeGreaterThan(0);
      expect(badge.icon.length).toBeGreaterThan(0);
    }
  });

  test('badge keys are unique', () => {
    const keys = BADGE_DEFINITIONS.map((b) => b.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  test('streak milestone badges are ordered 7, 14, 30, 60, 100', () => {
    const streakBadges = BADGE_DEFINITIONS.filter((b) => b.key.startsWith('streak_'));
    const thresholds = streakBadges.map((b) => parseInt(b.key.replace('streak_', ''), 10));
    expect(thresholds).toEqual([7, 14, 30, 60, 100]);
  });

  test('badge names do not contain "failed", "missed", "broke" (copy rules)', () => {
    const forbidden = ['failed', 'missed', 'broke'];
    for (const badge of BADGE_DEFINITIONS) {
      for (const word of forbidden) {
        expect(badge.name.toLowerCase()).not.toContain(word);
        expect(badge.description.toLowerCase()).not.toContain(word);
      }
    }
  });
});
