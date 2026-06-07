/**
 * FILE OBJECTIVE:
 * - Create a new admin user (email + password). Gated by ADMIN_SIGNUP_CODE
 *   so /admin/signup is not an open admin promotion endpoint.
 * - One credential, one account: if the email is already registered under
 *   a non-admin role (student/parent), the request is rejected with 409.
 *   Only existing admin accounts (OAuth-only, no passwordHash) may set a
 *   password via this endpoint.
 *
 * ENV VARS:
 * - ADMIN_SIGNUP_CODE (required) - shared secret callers must present. When
 *   unset, the endpoint returns 503 and admin signup is effectively disabled.
 *   Must be declared in `.env` and `.env.production` per project policy.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/auth/signup/route.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-06-07T00:00:00Z | claude | create admin signup route gated by ADMIN_SIGNUP_CODE; refuse when env unset; allow
 *     upgrading an existing OAuth-only account
 * - 2026-06-07T00:00:00Z | claude | enforce one-credential-one-account: reject signup when email is already registered
 *     under a student or parent role; OAuth-only admin path no longer overwrites role field
 */

import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { invalidateUserSessionCache } from '@/lib/sessionCacheUtils';

const MIN_PASSWORD_LENGTH = 8;

function isEmail(value: unknown): value is string {
  return typeof value === 'string' && value.includes('@') && !/\s/.test(value);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : undefined;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const adminCode = typeof body.adminCode === 'string' ? body.adminCode : '';

    if (!isEmail(email) || password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: 'validation_error', message: `Provide a valid email and a password of at least ${MIN_PASSWORD_LENGTH} characters.` },
        { status: 400 },
      );
    }

    const expectedCode = process.env.ADMIN_SIGNUP_CODE;
    if (!expectedCode) {
      logger.error('admin signup attempted with ADMIN_SIGNUP_CODE unset', { className: 'api.admin.auth.signup', methodName: 'POST' });
      return NextResponse.json({ error: 'admin_signup_disabled', message: 'Admin signup is disabled. Contact the system administrator.' }, { status: 503 });
    }
    if (adminCode !== expectedCode) {
      return NextResponse.json({ error: 'invalid_code', message: 'Invalid admin signup code.' }, { status: 403 });
    }

    const passwordHash = await hash(password, 10);

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, passwordHash: true } });
    if (existing) {
      // One credential, one account: reject if this email belongs to a non-admin role.
      // Promoting a student or parent account to admin via this endpoint is not allowed --
      // the admin signup path must only create new admins or set a password for an existing
      // admin who previously signed in via OAuth only.
      if (existing.role !== 'admin') {
        logger.warn('admin signup blocked: email belongs to non-admin account', {
          className: 'api.admin.auth.signup',
          methodName: 'POST',
          userId: existing.id,
          existingRole: existing.role,
        });
        return NextResponse.json(
          { error: 'user_exists', message: 'This email is already registered under a different account type. Use a different email address for the admin account.' },
          { status: 409 },
        );
      }
      if (existing.passwordHash) {
        return NextResponse.json({ error: 'user_exists', message: 'An account with this email already exists. Try signing in or resetting the password.' }, { status: 409 });
      }
      // Set password for an existing admin who previously authenticated via OAuth only.
      await prisma.user.update({
        where: { email },
        data: {
          passwordHash,
          accountStatus: 'active',
          name: name || undefined,
        },
      });
      await invalidateUserSessionCache(email);
      logger.info('admin signup set password for existing admin account', { className: 'api.admin.auth.signup', methodName: 'POST', userId: existing.id });
      return NextResponse.json({ ok: true });
    }

    const created = await prisma.user.create({
      data: {
        email,
        name: name || undefined,
        passwordHash,
        role: 'admin',
        accountStatus: 'active',
        language: 'en',
      },
      select: { id: true },
    });
    logger.info('admin signup created account', { className: 'api.admin.auth.signup', methodName: 'POST', userId: created.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('admin signup failed', { className: 'api.admin.auth.signup', methodName: 'POST', error: String(err) });
    return NextResponse.json({ error: 'server_error', message: 'Could not create admin account.' }, { status: 500 });
  }
}
