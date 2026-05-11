/**
 * FILE OBJECTIVE:
 * - Check and track daily usage of "practice more" feature for paid users.
 * - Ensures feature is usable only once per calendar day.
 * - Free users are rejected before cap check; premium users require tier verification.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/practice/practiceMoreCap.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /.github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-11T12:50:00Z | copilot | created practice more cap tracking for once-per-day paid feature
 */

import { prisma } from '@/lib/prisma';
import { isPremiumUser } from '@/lib/subscription';
import { logger } from '@/lib/logger';

export interface PracticeMoreCapStatus {
  allowed: boolean;
  isPremium: boolean;
  usageCount: number;
  usageDate: Date;
  nextAvailableAt: Date;
}

/**
 * Get today's UTC date (date-only, no time component).
 */
function getTodayDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Check if a paid user can use "practice more" today.
 * Returns status with allowed flag and usage details.
 *
 * Rules:
 * - Free users always get allowed: false
 * - Premium users can use once per UTC day
 * - Second use same day is rejected
 * - Resets at UTC midnight
 */
export async function checkPracticeMoreCap(studentId: string): Promise<PracticeMoreCapStatus> {
  const fallback: PracticeMoreCapStatus = {
    allowed: false,
    isPremium: false,
    usageCount: 0,
    usageDate: getTodayDate(),
    nextAvailableAt: new Date(),
  };

  try {
    // Check if user is premium
    const isPremium = await isPremiumUser(studentId);
    if (!isPremium) {
      return {
        ...fallback,
        isPremium: false,
      };
    }

    const todayDate = getTodayDate();
    const tomorrowDate = new Date(todayDate);
    tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);

    // Find or create usage record for today
    let usage = await prisma.practiceMoreUsage.findUnique({
      where: {
        studentId_usageDate: {
          studentId,
          usageDate: todayDate,
        },
      },
    });

    // If no usage record exists, user hasn't used the feature today
    if (!usage) {
      return {
        allowed: true,
        isPremium: true,
        usageCount: 0,
        usageDate: todayDate,
        nextAvailableAt: tomorrowDate,
      };
    }

    // If usage count is 0 or not yet 1, allow (shouldn't happen, but defensive)
    if (usage.usageCount < 1) {
      return {
        allowed: true,
        isPremium: true,
        usageCount: usage.usageCount,
        usageDate: todayDate,
        nextAvailableAt: tomorrowDate,
      };
    }

    // Feature already used today
    return {
      allowed: false,
      isPremium: true,
      usageCount: usage.usageCount,
      usageDate: todayDate,
      nextAvailableAt: tomorrowDate,
    };
  } catch (err) {
    logger.error('checkPracticeMoreCap failed', {
      studentId,
      error: err instanceof Error ? err.message : String(err),
    });
    return fallback;
  }
}

/**
 * Record a "practice more" usage for the student today.
 * Idempotent: increments usageCount if already used today.
 * Returns true on success, false on failure.
 */
export async function recordPracticeMoreUsage(studentId: string): Promise<boolean> {
  try {
    const todayDate = getTodayDate();

    await prisma.practiceMoreUsage.upsert({
      where: {
        studentId_usageDate: {
          studentId,
          usageDate: todayDate,
        },
      },
      update: {
        usageCount: { increment: 1 },
        updatedAt: new Date(),
      },
      create: {
        studentId,
        usageDate: todayDate,
        usageCount: 1,
        updatedAt: new Date(),
      },
    });

    return true;
  } catch (err) {
    logger.error('recordPracticeMoreUsage failed', {
      studentId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
