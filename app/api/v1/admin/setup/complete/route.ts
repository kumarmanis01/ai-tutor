/**
 * FILE OBJECTIVE:
 * - Complete admin invite setup by validating password and TOTP, then activating the admin account.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/setup/complete/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created admin setup complete endpoint
 */

import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  generateBackupCodes,
  validateAdminPassword,
  verifyTotp,
} from '@/lib/admin/authSecurity';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    password?: string;
    confirmPassword?: string;
    totpCode?: string;
    backupCodesSaved?: boolean;
  };

  const token = typeof body.token === 'string' ? body.token : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';
  const totpCode = typeof body.totpCode === 'string' ? body.totpCode : '';
  const backupCodesSaved = body.backupCodesSaved === true;

  if (!token || !password || !confirmPassword || !totpCode) {
    return NextResponse.json({ error: 'missing_required_fields' }, { status: 400 });
  }

  if (password !== confirmPassword) {
    return NextResponse.json({ error: 'password_mismatch' }, { status: 400 });
  }

  const passwordCheck = validateAdminPassword(password);
  if (!passwordCheck.valid) {
    return NextResponse.json({ error: 'weak_password', issues: passwordCheck.issues }, { status: 400 });
  }

  const admin = await prisma.adminUser.findUnique({ where: { inviteToken: token } });
  if (!admin || admin.status !== 'INVITED' || !admin.inviteExpiresAt || admin.inviteExpiresAt < new Date()) {
    return NextResponse.json({ error: 'invalid_or_expired_token' }, { status: 404 });
  }

  if (!admin.mfaSecret || !verifyTotp(admin.mfaSecret, totpCode, 1)) {
    return NextResponse.json({ error: 'invalid_mfa_code' }, { status: 400 });
  }

  if (!backupCodesSaved) {
    return NextResponse.json({ error: 'backup_codes_ack_required' }, { status: 400 });
  }

  const backupCodes = generateBackupCodes(10);
  const backupCodeHashes = await Promise.all(backupCodes.map((code) => bcrypt.hash(code, 12)));
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    await tx.adminUser.update({
      where: { id: admin.id },
      data: {
        passwordHash,
        mfaEnabled: true,
        status: 'ACTIVE',
        inviteToken: null,
        inviteExpiresAt: null,
        mfaBackupCodes: JSON.stringify(backupCodeHashes),
        failedLoginAttempts: 0,
        lockoutUntil: null,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminUserId: admin.id,
        action: 'admin.setup_complete',
        entityType: 'AdminUser',
        entityId: admin.id,
      },
    });
  });

  return NextResponse.json({
    ok: true,
    backupCodes,
    redirectTo: '/admin/login',
  });
}
