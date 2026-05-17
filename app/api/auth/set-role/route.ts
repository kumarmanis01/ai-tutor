/**
 * FILE OBJECTIVE:
 * - POST /api/auth/set-role persists the authenticated user's selected onboarding role
 *   using the Prisma UserRole enum contract and returns the next onboarding redirect.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/auth/set-role.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-05-05T00:00:00Z | staff-engineer | created for post-auth role selection flow
 * - 2026-05-05T00:00:00Z | copilot | mapped selected student role to persisted Prisma user enum value
 */

import { UserRole } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { invalidateUserSessionCache } from '@/lib/auth';

const ALLOWED_ROLES = ['student', 'parent'] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

const ROLE_REDIRECT: Record<AllowedRole, string> = {
  student: '/student/onboarding',
  parent: '/parent/onboarding',
};

const PERSISTED_ROLE_BY_SELECTION: Record<AllowedRole, UserRole> = {
  student: UserRole.user,
  parent: UserRole.parent,
};

export async function POST(req: NextRequest) {
  const start = Date.now();
  const session = await getServerSessionForHandlers();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const role = typeof body.role === 'string' ? (body.role.trim() as AllowedRole) : null;

  if (!role || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'role must be "student" or "parent"' }, { status: 400 });
  }

  const persistedRole = PERSISTED_ROLE_BY_SELECTION[role];

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { role: persistedRole },
    });

    // Invalidate short-lived session cache so JWT reflects updated role
    try {
      await invalidateUserSessionCache((session.user as any)?.email);
    } catch (e) {
      logger.warn('set-role: cache invalidation failed', { className: 'SetRoleAPI', methodName: 'POST', error: String(e) });
    }

    const redirect = ROLE_REDIRECT[role];
    const res = NextResponse.json({ ok: true, role, redirect });
    logger.logAPI(req, res, { className: 'SetRoleAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('[set-role] error', {
      className: 'SetRoleAPI',
      methodName: 'POST',
      userId,
      error: String((err as Error)?.message ?? err),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
