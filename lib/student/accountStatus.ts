import { prisma } from '@/lib/prisma';
import { DPDP_MINOR_AGE } from '@/lib/constants/age';

export type AccountStatus = 'ACTIVE' | 'PENDING_PARENT_VERIFY' | 'SUSPENDED' | 'DEACTIVATED';

/**
 * Check if the student's account requires parent OTP gate.
 * Returns true when:
 *   User.accountStatus = 'pending_parent_verification'
 *   AND User.age is known and < DPDP_MINOR_AGE (Indian DPDP Act 2023).
 * Null/unknown age = no gate -- we don't gate on missing data.
 * Returns false on any DB error -- never throws.
 */
export async function requiresParentOTPGate(studentId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: studentId },
      select: { accountStatus: true, age: true },
    });
    if (!user) return false;

    return (
      user.accountStatus === 'pending_parent_verification' &&
      user.age !== null &&
      user.age < DPDP_MINOR_AGE
    );
  } catch {
    return false;
  }
}
