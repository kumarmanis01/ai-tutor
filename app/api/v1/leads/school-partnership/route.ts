/**
 * FILE OBJECTIVE:
 * - POST /api/v1/leads/school-partnership: accepts school enquiry form data,
 *   rate-limits per IP, writes to SchoolLead model. Public route -- no auth required.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/leads/school-partnership/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T00:00:00Z | copilot | created for v3 landing page SchoolsBanner
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import RedisRateLimiter from '@/lib/alerts/redisRateLimiter';

// 5 submissions per IP per hour
const rateLimiter = new RedisRateLimiter({ capacity: 5, windowSeconds: 60 * 60 });

const LeadSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').max(100),
  schoolName: z.string().min(2, 'School name must be at least 2 characters.').max(200),
  email: z.string().email('Please enter a valid email address.'),
  phone: z
    .string()
    .regex(/^\d{10}$/, 'Phone number must be exactly 10 digits.')
    .optional(),
  message: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const allowed = await rateLimiter.allow(`school-lead:${ip}`);
  if (!allowed) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
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

  const parsed = LeadSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.errors[0]?.message ?? 'Invalid request.';
    return NextResponse.json({ code: 'VALIDATION_ERROR', message }, { status: 400 });
  }

  const { name, schoolName, email, phone, message } = parsed.data;

  try {
    await prisma.schoolLead.create({
      data: {
        name,
        schoolName,
        email,
        phone: phone ?? '',
        notes: message ?? '',
        // status defaults to NEW per LeadStatus enum
      },
    });
  } catch (err) {
    logger.error('school_lead.create.db_error', { error: err });
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Could not submit enquiry. Please try again.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
