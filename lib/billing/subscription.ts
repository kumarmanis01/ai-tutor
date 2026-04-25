/**
 * FILE OBJECTIVE:
 * - Small subscription helper utilities (e.g. `isPremiumUser`) used across the app and tests.
 *
 * LINKED UNIT TEST:
 * - tests/auto/lib/subscription.ts.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | copilot | moved helpers from lib/subscription.ts
 * - 2026-04-15T12:00:00Z | copilot | replace anonymous default export with named const
 * - 2026-04-24T00:00:00Z | copilot | strict-mode: annotate callback param to remove implicit any
 */

import { prisma } from '@/lib/prisma';

/**
 * Check if a user has an active premium subscription.
 * Also checks if the user is covered by a parent's family plan.
 */
export async function isPremiumUser(userId: string): Promise<boolean> {
  const now = new Date();

  // Direct active subscription for the user
  const directSub = await prisma.subscription.findFirst({
    where: {
      userId,
      active: true,
      startDate: { lte: now },
      endDate: { gte: now },
    },
    select: { id: true },
  });

  if (directSub) return true;

  // Check parent links to see if covered by a parent's family plan
  const parentLinks = await prisma.parentStudent.findMany({
    where: { studentId: userId, status: 'active' },
    select: { parentId: true },
  });
  if (parentLinks.length === 0) return false;

  // Annotate callback param to satisfy strict-mode (no implicit any)
  const parentIds = parentLinks.map((l: { parentId: string }) => l.parentId);
  const familySub = await prisma.subscription.findFirst({
    where: {
      userId: { in: parentIds },
      active: true,
      plan: 'family',
      startDate: { lte: now },
      endDate: { gte: now },
    },
    select: { id: true },
  });

  return familySub != null;
}

/**
 * Count the number of user-initiated chats/questions asked today.
 * Used for free-tier enforcement.
 */
export async function getTodaysQuestionCount(userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const count = await prisma.chat.count({ where: { userId, createdAt: { gte: today } } });
  return count;
}

const SubscriptionHelpers = { isPremiumUser, getTodaysQuestionCount };

export default SubscriptionHelpers;
