/**
 * FILE OBJECTIVE:
 * - Validate a consent token and return mini-page bootstrap data for parent approval.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/v1/consent/validate.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created v1 consent validate endpoint
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const start = Date.now();
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'missing_token' }, { status: 400 });
    }

    const cr = await prisma.consentRequest.findUnique({
      where: { token },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            grade: true,
            board: true,
          },
        },
      },
    });

    if (!cr) {
      return NextResponse.json(
        { valid: false, error: 'invalid_token', status: 'INVALID' },
        { status: 404 }
      );
    }

    const isExpired = cr.expiresAt < new Date() && cr.status === 'PENDING';
    const status = isExpired ? 'EXPIRED' : String(cr.status).toUpperCase();

    const res = NextResponse.json({
      valid: status === 'PENDING',
      status,
      expiresAt: cr.expiresAt,
      child: cr.student
        ? {
            id: cr.student.id,
            name: cr.student.name,
            grade: cr.student.grade,
            board: cr.student.board,
          }
        : null,
      channel: cr.channel,
    });

    logger.logAPI(req, res, { className: 'ConsentValidateAPI', methodName: 'GET' }, start);
    return res;
  } catch (err) {
    logger.error('consent.validate failed', { error: String(err) });
    const res = NextResponse.json({ error: 'server_error' }, { status: 500 });
    logger.logAPI(req, res, { className: 'ConsentValidateAPI', methodName: 'GET' }, start);
    return res;
  }
}
