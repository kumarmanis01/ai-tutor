/**
 * FILE OBJECTIVE:
 * - Determine whether a student requires parent verification and whether the
 *   parent has already been verified.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/parentGate.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-09T00:00:00Z | copilot | align age gate threshold from <18 to <13 per spec
 * - 2026-05-05T00:00:00Z | copilot | replace hardcoded age threshold with DPDP_MINOR_AGE constant
 */

import { prisma } from '@/lib/prisma'
import { DPDP_MINOR_AGE } from '@/lib/constants/age'

export interface ParentGateResult {
  required: boolean
  verified: boolean
  parentEmail: string | null
}

/**
 * Gate required when age is known and < DPDP_MINOR_AGE (DPDP / product policy).
 * Null/unknown age = no gate.
 */
function requiresGateByAge(age: number | null | undefined): boolean {
  if (age == null || !Number.isFinite(age)) return false
  return age < DPDP_MINOR_AGE
}

/**
 * Check if the student requires and has completed parent verification.
 * Required when: User.age indicates age < DPDP_MINOR_AGE, OR User.requiresParentVerification = true.
 * Verified when: User.parentVerifiedAt is non-null.
 * Null/unknown age = no age-based gate (no DOB-style ambiguity).
 * Never throws -- returns { required: true, verified: false } on DB error.
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
