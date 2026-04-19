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
 * - 2026-04-15T00:00:00Z | copilot | add minimal subscription helpers
 */

import { prisma } from '@/lib/prisma'

/**
 * Return true if the given userId is considered a paid/premium subscriber.
 * Conservative: treat any `subscriptionStatus` not equal to `'free'` as premium.
 */
export async function isPremiumUser(userId: string): Promise<boolean> {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { subscriptionStatus: true } })
    if (!u || !u.subscriptionStatus) return false
    return u.subscriptionStatus !== 'free'
  } catch {
    return false
  }
}

const Subscription = {
  isPremiumUser,
}

export default Subscription
