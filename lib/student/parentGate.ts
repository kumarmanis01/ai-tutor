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
 */

import { prisma } from '@/lib/prisma';

export interface ParentGateResult {
  required: boolean;
  verified: boolean;
  parentEmail: string | null;
}

/**
 * Gate required when age is known and < 13 (DPDP / product policy).
 * Null/unknown age = no gate.
 */
function requiresGateByAge(age: number | null | undefined): boolean {
  if (age == null || !Number.isFinite(age)) return false;
  // Product decision: parents required for children under 13.
  return age < 13;
}

/**
 * Check if the student requires and has completed parent verification.
 * Required when: User.age indicates age < 18, OR User.requiresParentVerification = true.
 * Verified when: User.parentVerifiedAt is non-null.
 * Null/unknown age = no age-based gate (no DOB-style ambiguity).
 * Never throws -- returns { required: true, verified: false } on DB error.
 */
export async function checkParentGate(studentId: string): Promise<ParentGateResult> {
  const fallback: ParentGateResult = { required: true, verified: false, parentEmail: null };
  try {
    const user = await prisma.user.findUnique({
      where: { id: studentId },
      select: {
        age: true,
        parentEmail: true,
        parentVerifiedAt: true,
        requiresParentVerification: true,
      },
    });

    if (!user) return fallback;

    const verified = user.parentVerifiedAt != null;
    const requiredByAge = requiresGateByAge(user.age);
    const requiredByFlag = Boolean(user.requiresParentVerification);
    const required = requiredByAge || requiredByFlag;

    return {
      required,
      verified,
      parentEmail: user.parentEmail ?? null,
    };
  } catch {
    return fallback;
  }
}
