/**
 * FILE OBJECTIVE:
 * - Shared admin authorization guards for v1 admin routes.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/admin/guards.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created admin role guards for v1 endpoints
 */

import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { verifyAdminAccessToken } from '@/lib/auth/token.service';

export interface GuardResult {
  ok: boolean;
  userId?: string;
  adminUserId?: string;
  role?: 'SUPER_ADMIN' | 'CONTENT_ADMIN' | 'SUPPORT_ADMIN' | 'BILLING_ADMIN';
}

export async function requireActiveAdmin(): Promise<GuardResult> {
  // Primary: verify the HTTP-only cookie set by the admin JWT auth endpoints
  let userId: string | undefined;
  try {
    const cookieStore = await cookies();
    const tok = cookieStore.get('__admin_tok')?.value;
    if (tok) {
      const payload = await verifyAdminAccessToken(tok);
      if (payload.scope === 'admin') userId = payload.sub;
    }
  } catch {
    // invalid or missing cookie -- fall through to NextAuth
  }

  // Fallback: NextAuth session (supports legacy admin accounts and test harness)
  if (!userId) {
    const session = await getServerSessionForHandlers();
    userId = (session?.user as { id?: string } | undefined)?.id;
  }

  if (!userId) return { ok: false };

  const admin = await prisma.adminUser.findUnique({
    where: { userId },
    select: { id: true, role: true, status: true },
  });

  if (!admin || admin.status !== 'ACTIVE') return { ok: false };
  return {
    ok: true,
    userId,
    adminUserId: admin.id,
    role: admin.role,
  };
}

export async function requireSuperAdmin(): Promise<GuardResult> {
  const result = await requireActiveAdmin();
  if (!result.ok || result.role !== 'SUPER_ADMIN') return { ok: false };
  return result;
}
