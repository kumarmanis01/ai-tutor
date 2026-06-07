/**
 * FILE OBJECTIVE:
 * - Issue a password-reset token for an admin user and email the reset link.
 *   Always returns 200 so the endpoint does not leak which emails exist.
 */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendEmailUnifiedSafe } from '@/lib/mail';
import { magicLinkHtml } from '@/lib/email/templates';

const RESET_TOKEN_TTL_MS = 1000 * 60 * 30; // 30 minutes
const RESET_IDENTIFIER_PREFIX = 'admin-pwreset:';

function isEmail(value: unknown): value is string {
  return typeof value === 'string' && value.includes('@') && !/\s/.test(value);
}

function buildResetUrl(token: string): string {
  const base = (process.env.NEXTAUTH_URL ?? '').replace(/\/$/, '');
  const path = `/admin/reset-password?token=${encodeURIComponent(token)}`;
  return base ? `${base}${path}` : path;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!isEmail(email)) {
      return NextResponse.json({ ok: true });
    }

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, name: true } });
    // Only issue reset tokens to existing admin accounts. Other roles silently no-op.
    if (!user || user.role !== 'admin') {
      logger.info('admin forgot-password no-op', { className: 'api.admin.auth.forgotPassword', methodName: 'POST' });
      return NextResponse.json({ ok: true });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    const identifier = `${RESET_IDENTIFIER_PREFIX}${email}`;

    await prisma.verificationToken.create({ data: { identifier, token, expires } });

    const resetUrl = buildResetUrl(token);
    await sendEmailUnifiedSafe({
      mode: 'raw',
      delivery: 'best_effort',
      to: email,
      subject: 'Reset your Spinzy admin password',
      html: magicLinkHtml(resetUrl),
      reason: 'admin_password_reset',
    }).catch((err) => logger.warn('admin reset email send failed', { className: 'api.admin.auth.forgotPassword', methodName: 'POST', error: String(err) }));

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('admin forgot-password failed', { className: 'api.admin.auth.forgotPassword', methodName: 'POST', error: String(err) });
    return NextResponse.json({ ok: true });
  }
}
