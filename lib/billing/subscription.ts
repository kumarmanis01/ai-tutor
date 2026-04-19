/**
 * FILE OBJECTIVE:
 * - Billing-related subscription helpers (isPremiumUser, usage counters).
 *
 * LINKED UNIT TEST:
 * - __tests__/lib/subscription.ts.test.ts (updated to check new path)
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | copilot | moved helpers from lib/subscription.ts
 */

import { prisma } from '@/lib/prisma'

/**
 * Return true if the given userId is considered a paid/premium subscriber.
 * Conservative: treat any `subscriptionStatus` not equal to `'free'` as premium.
 */
export async function isPremiumUser(userId: string): Promise<boolean> {
  const now = new Date()

  // Direct subscription
  const directSub = await prisma.subscription.findFirst({
    where: {
      userId,
      active: true,
      plan: { not: 'free' },
      startDate: { lte: now },
      endDate: { gte: now },
    },
  })
  if (directSub) return true

  // Check if covered by a parent's family plan (single batch query)
  const parentLinks = await prisma.parentStudent.findMany({
    where: { studentId: userId, status: 'active' },
    select: { parentId: true },
  })

  if (parentLinks.length === 0) return false

  const parentIds = parentLinks.map((l) => l.parentId)
  const familySub = await prisma.subscription.findFirst({
    where: {
      userId: { in: parentIds },
      active: true,
      plan: 'family',
      startDate: { lte: now },
      endDate: { gte: now },
    },
  })
  return familySub !== null
}

/**
 * Count today's asked questions (for free tier enforcement).
 */
export async function getTodaysQuestionCount(userId: string): Promise<number> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const count = await prisma.chat.count({
    where: {
      userId,
      createdAt: { gte: today },
    },
  })

  return count
}

export default { isPremiumUser, getTodaysQuestionCount }
