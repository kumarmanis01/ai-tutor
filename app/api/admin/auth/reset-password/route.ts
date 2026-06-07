/**
 * FILE OBJECTIVE:
 * - Consume an admin password-reset token and update the admin's passwordHash.
 */

import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { invalidateUserSessionCache } from '@/lib/sessionCacheUtils';

const MIN_PASSWORD_LENGTH = 8;
const RESET_IDENTIFIER_PREFIX = 'admin-pwreset:';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!token || password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: 'validation_error', message: `Provide the reset token and a password of at least ${MIN_PASSWORD_LENGTH} characters.` },
        { status: 400 },
      );
    }

    const record = await prisma.verificationToken.findUnique({ where: { token } });
    if (!record || !record.identifier.startsWith(RESET_IDENTIFIER_PREFIX) || record.expires.getTime() < Date.now()) {
      // Clean up an expired token if we found one.
      if (record) {
        await prisma.verificationToken.delete({ where: { token } }).catch(() => undefined);
      }
      return NextResponse.json({ error: 'invalid_token', message: 'This reset link is invalid or has expired.' }, { status: 400 });
    }

    const email = record.identifier.slice(RESET_IDENTIFIER_PREFIX.length);
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
    if (!user || user.role !== 'admin') {
      await prisma.verificationToken.delete({ where: { token } }).catch(() => undefined);
      return NextResponse.json({ error: 'invalid_token', message: 'This reset link is invalid or has expired.' }, { status: 400 });
    }

    const passwordHash = await hash(password, 10);
    await prisma.$transaction([
      prisma.user.update({ where: { email }, data: { passwordHash } }),
      prisma.verificationToken.delete({ where: { token } }),
    ]);
    await invalidateUserSessionCache(email);
    logger.info('admin password reset complete', { className: 'api.admin.auth.resetPassword', methodName: 'POST', userId: user.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('admin reset-password failed', { className: 'api.admin.auth.resetPassword', methodName: 'POST', error: String(err) });
    return NextResponse.json({ error: 'server_error', message: 'Could not reset password.' }, { status: 500 });
  }
}
