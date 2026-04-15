/**
 * FILE OBJECTIVE:
 * - Billing-related subscription helpers (isPremiumUser, usage counters).
 *
 * LINKED UNIT TEST:
 * - __tests__/lib/subscription.ts.test.ts (updated to check new path)
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | copilot | moved helpers from lib/subscription.ts
 * - 2026-04-15T12:00:00Z | copilot | replace anonymous default export with named const
 */

import { prisma } from '@/lib/prisma'

/**
 * Check if a user has an active premium subscription.
 * Also checks if user is covered by a parent's family plan.
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

const SubscriptionHelpers = { isPremiumUser, getTodaysQuestionCount }

export default SubscriptionHelpers
