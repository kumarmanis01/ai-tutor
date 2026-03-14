import { prisma } from '@/lib/prisma'

export type AccountStatus = 'ACTIVE' | 'PENDING_PARENT_VERIFY' | 'SUSPENDED' | 'DEACTIVATED'

/**
 * Under-13 rule: gate only when age is known and < 13. Null/unknown age = no gate.
 */
function isUnder13(age: number | null | undefined): boolean {
  if (age == null || !Number.isFinite(age)) return false
  return age < 13
}

/**
 * Check if the student's account requires parent OTP gate.
 * Returns true when:
 *   User.accountStatus = 'pending_parent_verification'
 *   AND User.age indicates age < 13 (under-13 rule).
 * Null/unknown age = no age-based gate.
 * Returns false on any DB error — never throws.
 */
export async function requiresParentOTPGate(studentId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: studentId },
      select: { accountStatus: true, age: true },
    })
    if (!user) return false

    const status = String(user.accountStatus || '').toLowerCase()
    if (status !== 'pending_parent_verification') return false

    return isUnder13(user.age ?? null)
  } catch {
    return false
  }
}

