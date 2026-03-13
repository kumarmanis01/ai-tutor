import { prisma } from '@/lib/prisma'

export type AccountStatus = 'ACTIVE' | 'PENDING_PARENT_VERIFY' | 'SUSPENDED' | 'DEACTIVATED'

function isUnder13(dob: Date | null | undefined): boolean {
  // Null DOB = no gate; only enforce under-13 rule when DOB is known.
  if (!dob) return false
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--
  }
  return age < 13
}

/**
 * Check if the student's account requires parent OTP gate.
 * Returns true when:
 *   User.accountStatus = 'PENDING_PARENT_VERIFY'
 *   AND User.dateOfBirth indicates age < 13 (under-13 rule)
 *   OR accountStatus = 'PENDING_PARENT_VERIFY' with no DOB (safe default)
 * Returns false on any DB error — never throws.
 */
export async function requiresParentOTPGate(studentId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: studentId },
      select: { accountStatus: true, dateOfBirth: true },
    })
    if (!user) return false

    const status = String(user.accountStatus || '').toLowerCase()
    if (status !== 'pending_parent_verification') return false

    return isUnder13(user.dateOfBirth ?? null)
  } catch {
    return false
  }
}

