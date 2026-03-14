import { prisma } from '@/lib/prisma'

export interface ParentGateResult {
  required: boolean
  verified: boolean
  parentEmail: string | null
}

/**
 * Gate required when age is known and < 18. Null/unknown age = no gate.
 */
function requiresGateByAge(age: number | null | undefined): boolean {
  if (age == null || !Number.isFinite(age)) return false
  return age < 18
}

/**
 * Check if the student requires and has completed parent verification.
 * Required when: User.age indicates age < 18, OR User.requiresParentVerification = true.
 * Verified when: User.parentVerifiedAt is non-null.
 * Null/unknown age = no age-based gate (no DOB-style ambiguity).
 * Never throws — returns { required: true, verified: false } on DB error.
 */
export async function checkParentGate(studentId: string): Promise<ParentGateResult> {
  const fallback: ParentGateResult = { required: true, verified: false, parentEmail: null }
  try {
    const user = await prisma.user.findUnique({
      where: { id: studentId },
      select: {
        age: true,
        parentEmail: true,
        parentVerifiedAt: true,
        requiresParentVerification: true,
      },
    })

    if (!user) return fallback

    const verified = user.parentVerifiedAt != null
    const requiredByAge = requiresGateByAge(user.age)
    const requiredByFlag = Boolean(user.requiresParentVerification)
    const required = requiredByAge || requiredByFlag

    return {
      required,
      verified,
      parentEmail: user.parentEmail ?? null,
    }
  } catch {
    return fallback
  }
}
