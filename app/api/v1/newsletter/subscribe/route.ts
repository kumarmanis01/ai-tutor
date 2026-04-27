/**
 * FILE OBJECTIVE:
 * - POST /api/v1/newsletter/subscribe: accepts email + DPDP consent, rate-limits per IP,
 *   upserts a NewsletterSubscriber record. Public route -- no auth required.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/newsletter/subscribe/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T00:00:00Z | copilot | created for v3 landing page newsletter signup
 * - 2026-04-27T10:45:00Z | copilot | standardize source value to snake_case for analytics consistency
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import RedisRateLimiter from '@/lib/alerts/redisRateLimiter';

const rateLimiter = new RedisRateLimiter({ capacity: 3, windowSeconds: 5 * 60 });

const SubscribeSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  consentGiven: z.literal(true, {
    errorMap: () => ({ message: 'Consent is required to subscribe.' }),
  }),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Rate limit by IP: 3 requests per 5 minutes
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const allowed = await rateLimiter.allow(`newsletter:${ip}`);
  if (!allowed) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: 'Too many requests. Please try again shortly.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  const parsed = SubscribeSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.errors[0]?.message ?? 'Invalid request.';
    return NextResponse.json({ code: 'VALIDATION_ERROR', message }, { status: 400 });
  }

  const { email } = parsed.data;

  try {
    await prisma.newsletterSubscriber.upsert({
      where: { email },
      update: { consentGiven: true, source: 'newsletter_section' },
      create: { email, consentGiven: true, source: 'newsletter_section' },
    });
  } catch (err) {
    logger.error('newsletter.subscribe.db_error', { error: err });
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Could not save subscription. Please try again.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
