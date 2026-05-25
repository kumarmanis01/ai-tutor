/**
 * FILE OBJECTIVE:
 * - One-time bootstrap endpoint to promote the first user to admin.
 *   Only works while zero admin users exist in the database.
 *   Protected by ADMIN_BOOTSTRAP_SECRET env var.
 *
 * Usage (run once after first Google sign-in on /admin/login):
 *   curl -X POST https://<host>/api/admin/bootstrap \
 *     -H "Content-Type: application/json" \
 *     -H "Authorization: Bearer <ADMIN_BOOTSTRAP_SECRET>" \
 *     -d '{"email":"you@example.com"}'
 */

import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// Deliberately not auth-guarded -- this is the bootstrap mechanism for the
// very first admin. It is self-disabling once any admin account exists.
export async function POST(request: NextRequest) {
  const secret = process.env.ADMIN_BOOTSTRAP_SECRET;
  if (!secret) {
    return NextResponse.json(
      { code: 'NOT_CONFIGURED', message: 'Bootstrap is not enabled on this server.' },
      { status: 403 },
    );
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (provided !== secret) {
    logger.warn('bootstrap: invalid secret', { event: 'admin_bootstrap_rejected' });
    return NextResponse.json(
      { code: 'FORBIDDEN', message: 'Invalid bootstrap secret.' },
      { status: 403 },
    );
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: 'BAD_REQUEST', message: 'Request body must be JSON with an email field.' },
      { status: 400 },
    );
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { code: 'BAD_REQUEST', message: 'A valid email address is required.' },
      { status: 400 },
    );
  }

  // Safety gate: refuse if any admin already exists.
  const existingAdminCount = await prisma.user.count({
    where: { role: UserRole.admin },
  });
  if (existingAdminCount > 0) {
    logger.warn('bootstrap: attempted after admin already exists', {
      event: 'admin_bootstrap_blocked',
      context: { email },
    });
    return NextResponse.json(
      {
        code: 'ALREADY_BOOTSTRAPPED',
        message: 'An admin account already exists. Use the admin panel to manage roles.',
      },
      { status: 409 },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json(
      {
        code: 'USER_NOT_FOUND',
        message: `No account found for ${email}. Sign in at /admin/login first to create the account, then call this endpoint.`,
      },
      { status: 404 },
    );
  }

  await prisma.user.update({
    where: { email },
    data: { role: UserRole.admin },
  });

  logger.info('bootstrap: first admin promoted', {
    event: 'admin_bootstrap_success',
    context: { email },
  });

  return NextResponse.json({ ok: true, message: `${email} has been promoted to admin.` });
}
