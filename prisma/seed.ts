/**
 * FILE OBJECTIVE:
 * - Idempotent seed to create an initial Super Admin from environment variables.
 *
 * LINKED UNIT TEST:
 * - tests/unit/prisma/seed.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-29T00:00:00Z | copilot | created initial super-admin seed
 */

import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export function validateInitialPassword(pw: string): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (pw.length < 16) issues.push('minimum 16 characters');
  if (!/[A-Z]/.test(pw)) issues.push('at least one uppercase letter');
  if (!/[a-z]/.test(pw)) issues.push('at least one lowercase letter');
  if (!/\d/.test(pw)) issues.push('at least one number');
  if (!/[^A-Za-z0-9]/.test(pw)) issues.push('at least one special character');
  return { ok: issues.length === 0, issues };
}

export async function seedSuperAdmin(): Promise<void> {
  const email = process.env.INITIAL_SUPER_ADMIN_EMAIL;
  const name = process.env.INITIAL_SUPER_ADMIN_NAME;
  const password = process.env.INITIAL_SUPER_ADMIN_PASSWORD;

  if (!email || !name || !password) {
    console.error('Missing one of required env vars: INITIAL_SUPER_ADMIN_EMAIL / NAME / PASSWORD');
    throw new Error('missing_initial_super_admin_env');
  }

  // Idempotent: skip if any SUPER_ADMIN exists
  const existing = await prisma.adminUser.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (existing) {
    console.log('ℹ️ Super Admin already exists. Skipping creation.');
    return;
  }

  // Validate password according to acceptance criteria
  const { ok, issues } = validateInitialPassword(password);
  if (!ok) {
    console.error('Initial super admin password does not meet requirements:', issues.join(', '));
    throw new Error('initial_super_admin_password_policy_failed');
  }

  // Hash password (bcrypt cost factor 12). DO NOT log the password.
  const passwordHash = await bcrypt.hash(password, 12);

  // Create a linked User and AdminUser in a transaction.
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        role: 'admin',
        passwordHash,
        accountStatus: 'active',
      },
    });

    await tx.adminUser.create({
      data: {
        userId: user.id,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        passwordHash,
        mfaEnabled: false,
      },
    });
  });

  // Console-only informational log per acceptance criteria
  console.log(`✅ Initial Super Admin created: ${email}`);
}

// If the script is executed directly (e.g., `tsx prisma/seed.ts`), run the seed.
if (typeof require !== 'undefined' && require.main === module) {
  void seedSuperAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
      // Ensure we surface errors to the console but do NOT print secrets.
      console.error('seedSuperAdmin failed:', err && err.message ? err.message : String(err));
      process.exit(1);
    });
}
