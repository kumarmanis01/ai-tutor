/**
 * FILE OBJECTIVE:
 * - API route to register a new user (email + password) and trigger welcome email.
 *
 * LINKED UNIT TEST:
 * - __tests__/app/api/auth/signup/route.ts.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EMAIL INFRA POLICY: All email sends must use lib/mail.ts (sendEmail, sendEmailBatch, sendEmailUnified, sendEmailUnifiedSafe). No direct sendMail/sendMailSafe allowed.
 *
 * EDIT LOG:
 * - 2026-04-16T00:00:00Z | copilot | create signup route that persists user and fires welcome email
 * - 2026-04-16T03:40:00Z | copilot | log validation/duplicate/success events and use `start` for duration
 * - 2026-05-13T00:00:00Z | copilot | emit student auth signup analytics on successful account creation
 * - 2026-05-20T00:00:00Z | copilot | refactor: use centralized sendEmailUnifiedSafe (lib/mail), remove direct sendMailSafe per infra policy
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { hash } from 'bcryptjs';
import { sendEmailUnifiedSafe } from '@/lib/mail';
import { welcomeEmailHtml } from '@/lib/email/templates';
import { emitServerAnalyticsEvent } from '@/lib/analytics/server';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';

// Lightweight input validation helper
function isEmail(s: unknown): s is string {
  return typeof s === 'string' && s.includes('@') && s.indexOf(' ') === -1;
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const body = await req.json().catch(() => ({}));

    const name = typeof body.name === 'string' ? String(body.name).trim() : undefined;
    const emailRaw = typeof body.email === 'string' ? String(body.email).trim() : undefined;
    const email = emailRaw ? emailRaw.toLowerCase() : undefined;
    const password = typeof body.password === 'string' ? String(body.password) : undefined;

    if (!email || !isEmail(email) || !password || password.length < 6) {
      logger.warn('/api/auth/signup validation failed', { className: 'api.auth.signup', methodName: 'POST', durationMs: Date.now() - start, reason: 'validation_failed' });
      return NextResponse.json({ error: 'validation_error', message: 'Invalid email or password' }, { status: 400 });
    }

    // Prevent account duplication
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      logger.warn('/api/auth/signup duplicate', { className: 'api.auth.signup', methodName: 'POST', email, durationMs: Date.now() - start });
      return NextResponse.json({ error: 'user_exists', message: 'Account already exists' }, { status: 409 });
    }

    // Hash password and create user record
    const passwordHash = await hash(password, 10);
    const created = await prisma.user.create({
      data: {
        email,
        name: name || undefined,
        passwordHash,
        language: 'en',
      },
      select: { id: true, email: true, name: true },
    });

    // Persist referral code at signup (if present in body or query param)
    try {
      const refFromBody = typeof body.ref === 'string' ? (body.ref as string).trim() : undefined
      const refFromQuery = typeof req.url === 'string' ? new URL(req.url).searchParams.get('ref') ?? undefined : undefined
      const ref = refFromBody || (refFromQuery ? String(refFromQuery).trim() : undefined)
      if (ref) {
        await prisma.user.update({ where: { id: created.id }, data: { preferences: { referredBy: ref } } })
      }
    } catch (err) {
      // Non-fatal: log and continue
      logger.warn('/api/auth/signup: failed to persist referral code', { err })
    }

    // Fire-and-forget welcome email. Centralized email infra: use sendEmailUnifiedSafe (no direct sendMail/sendMailSafe allowed).
    if (created?.email) {
      sendEmailUnifiedSafe({
        mode: 'raw',
        delivery: 'best_effort',
        to: created.email,
        subject: 'Welcome to Spinzy Academy!',
        // TODO(email-consolidation): this bypasses sendEmailUnified -- migrate to EMAIL_TEMPLATES catalog
        html: welcomeEmailHtml(created.name ?? 'there'),
        reason: 'student_signup_welcome',
      })
        .then(() => prisma.user.update({ where: { id: created.id }, data: { welcomeEmailSent: true } }))
        .catch((e) => logger.warn('/api/auth/signup: welcome email/update flag failed', { className: 'api.auth.signup', methodName: 'POST', error: String(e) }));
    }

    void emitServerAnalyticsEvent(
      {
        eventType: ANALYTICS_EVENTS.STUDENT.AUTH_SIGNUP,
        userId: created.id,
        metadata: { emailDomain: created.email.split('@')[1] ?? null },
      },
      'auth.signup',
    );

    logger.info('/api/auth/signup success', { className: 'api.auth.signup', methodName: 'POST', userId: created.id, durationMs: Date.now() - start });
    return NextResponse.json({ ok: true, user: { id: created.id, email: created.email } });
  } catch (err) {
    logger.error('/api/auth/signup error', { className: 'api.auth.signup', methodName: 'POST', error: String(err) });
    return NextResponse.json({ error: formatErrorForResponse(err), message: 'Failed to create account' }, { status: 500 });
  }
}
