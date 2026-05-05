/**
 * FILE OBJECTIVE:
 * - POST /api/auth/set-role
 * - Sets the authenticated user's role (student or parent) during the post-auth
 *   role selection step and returns the appropriate onboarding redirect URL.
 * - Called once by the /auth/role page immediately after the user picks their role.
 *
 * EDIT LOG:
 * - 2026-05-05 | staff-engineer | created for post-auth role selection flow
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const ALLOWED_ROLES = ['student', 'parent'] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

const ROLE_REDIRECT: Record<AllowedRole, string> = {
  student: '/student/onboarding',
  parent: '/parent/onboarding',
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

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { role },
    });

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
