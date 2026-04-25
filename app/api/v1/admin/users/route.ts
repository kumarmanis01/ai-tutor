/**
 * FILE OBJECTIVE:
 * - Admin management endpoint for creating invited admin accounts and listing admin users.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/users/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created v1 admin users invite/list endpoint for A0.1
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendAdminInvite } from '@/lib/mailer';
import { requireSuperAdmin } from '@/lib/admin/guards';
import {
  generateInviteToken,
  isCorporateEmail,
  normalizeEmail,
  validateAdminName,
} from '@/lib/admin/authSecurity';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['CONTENT_ADMIN', 'SUPPORT_ADMIN'] as const;

function getSetupBaseUrl(): string {
  return process.env.NEXT_PUBLIC_ADMIN_APP_URL ?? 'https://admin.spinzy.academy';
}

export async function GET(req: Request) {
  const start = Date.now();
  try {
    const guard = await requireSuperAdmin();
    if (!guard.ok) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const rows = await prisma.adminUser.findMany({
      select: {
        id: true,
        role: true,
        status: true,
        invitedAt: true,
        inviteExpiresAt: true,
        lastLoginAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const res = NextResponse.json({ ok: true, items: rows });
    logger.logAPI(req, res, { className: 'AdminUsersAPI', methodName: 'GET' }, start);
    return res;
  } catch (err) {
    logger.error('admin.users.get failed', { error: String(err) });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const start = Date.now();
  try {
    const guard = await requireSuperAdmin();
    if (!guard.ok || !guard.adminUserId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      name?: string;
      role?: string;
    };

    const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!email || !name || !body.role) {
      return NextResponse.json({ error: 'missing_required_fields' }, { status: 400 });
    }

    if (!validateAdminName(name)) {
      return NextResponse.json({ error: 'invalid_name_length' }, { status: 400 });
    }

    if (!isCorporateEmail(email)) {
      return NextResponse.json({ error: 'free_email_domain_blocked' }, { status: 400 });
    }

    if (!body.role || !ALLOWED_ROLES.includes(body.role as (typeof ALLOWED_ROLES)[number])) {
      return NextResponse.json({ error: 'invalid_role' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { adminUser: true },
    });

    if (existingUser?.adminUser) {
      return NextResponse.json({ error: 'admin_already_exists' }, { status: 409 });
    }

    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const admin = await prisma.$transaction(async (tx) => {
      const user =
        existingUser ??
        (await tx.user.create({
          data: {
            email,
            name,
            role: 'admin',
          },
        }));

      const adminUser = await tx.adminUser.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          role: body.role,
          status: 'INVITED',
          inviteToken: token,
          inviteExpiresAt: expiresAt,
          invitedAt: new Date(),
          mfaEnabled: false,
        },
        update: {
          role: body.role,
          status: 'INVITED',
          inviteToken: token,
          inviteExpiresAt: expiresAt,
          invitedAt: new Date(),
          mfaEnabled: false,
          failedLoginAttempts: 0,
          lockoutUntil: null,
        },
      });

      await tx.adminAuditLog.create({
        data: {
          adminUserId: guard.adminUserId,
          action: 'admin.invite_created',
          entityType: 'AdminUser',
          entityId: adminUser.id,
          payload: {
            invitedEmail: email,
            invitedRole: body.role,
          },
        },
      });

      return {
        id: adminUser.id,
        userId: user.id,
        email: user.email,
        name: user.name,
        role: adminUser.role,
        status: adminUser.status,
        inviteExpiresAt: adminUser.inviteExpiresAt,
      };
    });

    const setupLink = `${getSetupBaseUrl()}/setup?token=${token}`;
    await sendAdminInvite(email, setupLink, admin.role);

    const res = NextResponse.json({ ok: true, admin });
    logger.logAPI(req, res, { className: 'AdminUsersAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('admin.users.post failed', { error: String(err) });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
