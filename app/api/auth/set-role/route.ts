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
import { logAuditEvent } from '@/lib/audit/log';

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
    // SECURITY: role selection is a one-shot operation that happens immediately
    // after signup. Once a role is persisted, this endpoint must NOT silently
    // swap it -- a student calling POST /api/auth/set-role { role: 'parent' }
    // would otherwise self-promote to a parent account and gain access to every
    // parent route, family billing, OTP issuance, etc.
    //
    // Lock the role once it is set to anything other than the default 'user',
    // and forbid changing 'user' -> 'parent' if the user has already passed
    // the academic onboarding gate.
    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, grade: true, board: true, accountStatus: true },
    });
    if (!current) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    const alreadySet = current.role && current.role !== UserRole.user;
    const alreadyOnboardedAsStudent =
      current.role === UserRole.user && (current.grade || current.board);
    if (alreadySet && current.role !== persistedRole) {
      logger.warn('set-role: blocked role swap attempt', {
        className: 'SetRoleAPI',
        methodName: 'POST',
        userId,
        currentRole: current.role,
        requestedRole: persistedRole,
      });
      return NextResponse.json({ error: 'Role already set for this account' }, { status: 409 });
    }
    if (alreadyOnboardedAsStudent && persistedRole === UserRole.parent) {
      logger.warn('set-role: blocked student->parent swap', {
        className: 'SetRoleAPI',
        methodName: 'POST',
        userId,
      });
      return NextResponse.json({ error: 'Role already set for this account' }, { status: 409 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { role: persistedRole },
    });

    // Security-relevant: persist an audit trail so a compromised support tool
    // or a missed role-swap regression in the future is reconstructible from
    // the AuditLog table alone.
    void logAuditEvent(prisma, {
      adminId: null,
      actorId: userId,
      targetEntity: 'User',
      targetId: userId,
      action: null,
      previousValue: { role: current.role },
      newValue: { role: persistedRole },
      details: { legacyAction: 'auth.set_role', source: 'set-role-route' },
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
