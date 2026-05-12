/**
 * FILE OBJECTIVE:
 * - Unit tests for daily "practice more" cap enforcement for paid users.
 * - Validates once-per-day feature gate and usage tracking.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/practice/practiceMoreCap.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /.github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-11T13:20:00Z | copilot | created unit tests for practice more cap
 */

import { checkPracticeMoreCap, recordPracticeMoreUsage } from '@/lib/practice/practiceMoreCap';
import { prisma } from '@/lib/prisma';
import * as subscriptionModule from '@/lib/subscription';

// Mock the prisma client and subscription module
jest.mock('@/lib/prisma', () => ({
  prisma: {
    practiceMoreUsage: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

jest.mock('@/lib/subscription', () => ({
  isPremiumUser: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('practiceMoreCap', () => {
  const studentId = 'test-student-123';
  const todayDate = new Date();
  todayDate.setUTCHours(0, 0, 0, 0);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkPracticeMoreCap', () => {
    it('should reject free tier users', async () => {
      (subscriptionModule.isPremiumUser as jest.Mock).mockResolvedValue(false);

      const result = await checkPracticeMoreCap(studentId);

      expect(result.allowed).toBe(false);
      expect(result.isPremium).toBe(false);
      expect(subscriptionModule.isPremiumUser).toHaveBeenCalledWith(studentId);
    });

    it('should allow premium users who have not used feature today', async () => {
      (subscriptionModule.isPremiumUser as jest.Mock).mockResolvedValue(true);
      (prisma.practiceMoreUsage.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await checkPracticeMoreCap(studentId);

      expect(result.allowed).toBe(true);
      expect(result.isPremium).toBe(true);
      expect(result.usageCount).toBe(0);
      expect(result.usageDate).toEqual(todayDate);
    });

    it('should reject premium users who already used feature today', async () => {
      (subscriptionModule.isPremiumUser as jest.Mock).mockResolvedValue(true);
      (prisma.practiceMoreUsage.findUnique as jest.Mock).mockResolvedValue({
        studentId,
        usageDate: todayDate,
        usageCount: 1,
      });

      const result = await checkPracticeMoreCap(studentId);

      expect(result.allowed).toBe(false);
      expect(result.isPremium).toBe(true);
      expect(result.usageCount).toBe(1);
    });

    it('should return fallback on database error', async () => {
      (subscriptionModule.isPremiumUser as jest.Mock).mockRejectedValue(
        new Error('DB error'),
      );

      const result = await checkPracticeMoreCap(studentId);

      expect(result.allowed).toBe(false);
      expect(result.isPremium).toBe(false);
    });

    it('should provide correct nextAvailableAt time (tomorrow UTC midnight)', async () => {
      (subscriptionModule.isPremiumUser as jest.Mock).mockResolvedValue(true);
      (prisma.practiceMoreUsage.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await checkPracticeMoreCap(studentId);

      const tomorrowDate = new Date(todayDate);
      tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);

      expect(result.nextAvailableAt.getTime()).toBe(tomorrowDate.getTime());
    });
  });

  describe('recordPracticeMoreUsage', () => {
    it('should create new usage record on first call', async () => {
      (prisma.practiceMoreUsage.upsert as jest.Mock).mockResolvedValue({
        studentId,
        usageDate: todayDate,
        usageCount: 1,
      });

      const result = await recordPracticeMoreUsage(studentId);

      expect(result).toBe(true);
      expect(prisma.practiceMoreUsage.upsert).toHaveBeenCalledWith({
        where: {
          studentId_usageDate: {
            studentId,
            usageDate: todayDate,
          },
        },
        update: {
          usageCount: { increment: 1 },
          updatedAt: expect.any(Date),
        },
        create: {
          studentId,
          usageDate: todayDate,
          usageCount: 1,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should increment usageCount on subsequent calls same day', async () => {
      (prisma.practiceMoreUsage.upsert as jest.Mock).mockResolvedValue({
        studentId,
        usageDate: todayDate,
        usageCount: 2,
      });

      const result = await recordPracticeMoreUsage(studentId);

      expect(result).toBe(true);
      // upsert is idempotent, increments on update
      expect(prisma.practiceMoreUsage.upsert).toHaveBeenCalled();
    });

    it('should return false on database error', async () => {
      (prisma.practiceMoreUsage.upsert as jest.Mock).mockRejectedValue(
        new Error('DB error'),
      );

      const result = await recordPracticeMoreUsage(studentId);

      expect(result).toBe(false);
    });
  });
});
