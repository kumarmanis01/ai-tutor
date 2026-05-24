/**
 * FILE OBJECTIVE:
 * - Provide account-status helpers for onboarding and parent OTP gating.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/student/accountStatus.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-12T00:00:00Z | copilot | include pending_onboarding in parent OTP gate status checks
 */

import { prisma } from '@/lib/prisma'
import { DPDP_MINOR_AGE } from '@/lib/constants/age'

/**
 * Check if the student's account requires parent OTP gate.
 * @internal Auth-layer helper -- call only from layout.tsx and server-side gates.
 * Returns true when:
 *   User.accountStatus in ('pending_onboarding', 'pending_parent_verification')
 *   AND User.age is known and < DPDP_MINOR_AGE (Indian DPDP Act 2023).
 * Null/unknown age = no gate -- we don't gate on missing data.
 * Returns false on any DB error -- never throws.
 */
export async function requiresParentOTPGate(studentId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: studentId },
      select: { accountStatus: true, age: true },
    })
    if (!user) return false

    return (
      (user.accountStatus === 'pending_parent_verification' || user.accountStatus === 'pending_onboarding') &&
      user.age !== null &&
      user.age < DPDP_MINOR_AGE
    )
  } catch {
    return false
  }
}


