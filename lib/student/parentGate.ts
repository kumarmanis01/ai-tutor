import { prisma } from '@/lib/prisma'

export interface ParentGateResult {
  required: boolean
  verified: boolean
  parentEmail: string | null
}

function isUnder18(dob: Date | null): boolean {
  if (!dob) return true
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const m = now.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1
  return age < 18
}

/**
 * Check if the student requires and has completed parent verification.
 * Required when: User.dateOfBirth indicates age < 18, OR User.requiresParentVerification = true.
 * Verified when: User.parentVerifiedAt is non-null.
 * If dateOfBirth is missing — treat as requiring verification (safe default).
 * Never throws — returns { required: true, verified: false } on DB error.
 */
export async function checkParentGate(studentId: string): Promise<ParentGateResult> {
  const fallback: ParentGateResult = { required: true, verified: false, parentEmail: null }
  try {
    const user = await prisma.user.findUnique({
      where: { id: studentId },
      select: {
        dateOfBirth: true,
        parentEmail: true,
        parentVerifiedAt: true,
        requiresParentVerification: true,
      },
    })

    if (!user) return fallback

    const verified = user.parentVerifiedAt != null
    const requiredByDob = isUnder18(user.dateOfBirth)
    const requiredByFlag = Boolean(user.requiresParentVerification)
    const required = requiredByDob || requiredByFlag

    return {
      required,
      verified,
      parentEmail: user.parentEmail ?? null,
    }
  } catch {
    return fallback
  }
}
