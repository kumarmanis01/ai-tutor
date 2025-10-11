import { prisma } from './prisma';

/**
 * Check if a user has an active premium subscription.
 * Returns true if the user has a paid plan, is active, and within the subscription period.
 */
export async function isPremiumUser(userId: string): Promise<boolean> {
  const now = new Date();
  const sub = await prisma.subscription.findFirst({
    where: {
      userId,
      active: true,
      plan: { not: 'free' },
      startDate: { lte: now },
      endDate: { gte: now },
    },
  });
  return !!sub;
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
