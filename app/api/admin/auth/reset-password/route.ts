/**
 * FILE OBJECTIVE:
 * - Consume an admin password-reset token and update the admin's passwordHash.
 *   Token consumption is atomic (delete-first inside a transaction) so a stolen
 *   token can only be redeemed once even under concurrent requests.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/auth/reset-password/route.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-06-07T00:00:00Z | claude | create admin password reset consume endpoint with delete-first atomic token
 *     consumption (P2025 inside the transaction => invalid/already-used)
 */

import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { invalidateUserSessionCache } from '@/lib/sessionCacheUtils';

const MIN_PASSWORD_LENGTH = 8;
const RESET_IDENTIFIER_PREFIX = 'admin-pwreset:';

function isPrismaRecordNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { code?: string };
  return maybe.code === 'P2025';
}

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

    const passwordHash = await hash(password, 10);

    // Atomic single-use semantics: consume the token by delete inside a
    // transaction before updating the password. Two concurrent requests can
    // both pass a pre-check, but only one delete will succeed -- the loser
    // throws P2025 (RecordNotFound) and is rejected as invalid. This also
    // covers the expired/non-existent token cases.
    let email: string;
    try {
      const result = await prisma.$transaction(async (tx) => {
        const consumed = await tx.verificationToken.delete({ where: { token } });
        if (!consumed.identifier.startsWith(RESET_IDENTIFIER_PREFIX)) {
          throw new Error('not_a_reset_token');
        }
        if (consumed.expires.getTime() < Date.now()) {
          throw new Error('expired_reset_token');
        }
        const targetEmail = consumed.identifier.slice(RESET_IDENTIFIER_PREFIX.length);
        const user = await tx.user.findUnique({
          where: { email: targetEmail },
          select: { id: true, role: true },
        });
        if (!user || user.role !== 'admin') {
          throw new Error('not_an_admin');
        }
        await tx.user.update({ where: { email: targetEmail }, data: { passwordHash } });
        return { email: targetEmail, userId: user.id };
      });
      email = result.email;
      logger.info('admin password reset complete', {
        className: 'api.admin.auth.resetPassword',
        methodName: 'POST',
        userId: result.userId,
      });
    } catch (txErr) {
      if (isPrismaRecordNotFoundError(txErr) || txErr instanceof Error) {
        logger.info('admin reset-password rejected', {
          className: 'api.admin.auth.resetPassword',
          methodName: 'POST',
          reason: isPrismaRecordNotFoundError(txErr) ? 'token_not_found' : (txErr as Error).message,
        });
        return NextResponse.json(
          { error: 'invalid_token', message: 'This reset link is invalid or has expired.' },
          { status: 400 },
        );
      }
      throw txErr;
    }

    await invalidateUserSessionCache(email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('admin reset-password failed', { className: 'api.admin.auth.resetPassword', methodName: 'POST', error: String(err) });
    return NextResponse.json({ error: 'server_error', message: 'Could not reset password.' }, { status: 500 });
  }
}
