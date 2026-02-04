import { prisma } from './prisma';

/**
 * Check if a user has an active premium subscription.
 * Also checks if user is covered by a parent's family plan.
 */
export async function isPremiumUser(userId: string): Promise<boolean> {
  const now = new Date();

  // Direct subscription
  const directSub = await prisma.subscription.findFirst({
    where: {
      userId,
      active: true,
      plan: { not: 'free' },
      startDate: { lte: now },
      endDate: { gte: now },
    },
  });
  if (directSub) return true;

  // Check if covered by parent's family plan
  const parentLinks = await prisma.parentStudent.findMany({
    where: { studentId: userId, status: 'active' },
    select: { parentId: true },
  });

  for (const link of parentLinks) {
    const familySub = await prisma.subscription.findFirst({
      where: {
        userId: link.parentId,
        active: true,
        plan: 'family',
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });
    if (familySub) return true;
  }

  return false;
}

/**
 * Count today's asked questions (for free tier enforcement).
 */
export async function getTodaysQuestionCount(userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const count = await prisma.chat.count({
    where: {
      userId,
      createdAt: { gte: today },
    },
  });

  return count;
}
