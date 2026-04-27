/**
 * FILE OBJECTIVE:
 * - Soft-delete/anonymize a student profile during Explore Mode cancellation flow.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/students/[id]/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T00:00:00Z | copilot | created DELETE /api/v1/students/{id} soft-delete endpoint for S0.4 cancel request flow
 */

import { NextResponse } from 'next/server';
import { AccountStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(req: Request, context: RouteContext) {
  const start = Date.now();
  const { id } = await context.params;

  if (!id) {
    const response = NextResponse.json({ error: 'missing_student_id' }, { status: 400 });
    logger.logAPI(req, response, { className: 'StudentDeleteAPI', methodName: 'DELETE' }, start);
    return response;
  }

  const requestUrl = new URL(req.url);
  const consentToken = requestUrl.searchParams.get('consent_token');
  if (!consentToken) {
    const response = NextResponse.json({ error: 'missing_consent_token' }, { status: 400 });
    logger.logAPI(req, response, { className: 'StudentDeleteAPI', methodName: 'DELETE' }, start);
    return response;
  }

  try {
    const consentRequest = await prisma.consentRequest.findUnique({
      where: { token: consentToken },
      select: {
        id: true,
        studentId: true,
        status: true,
      },
    });

    if (!consentRequest || consentRequest.studentId !== id) {
      const response = NextResponse.json({ error: 'consent_mismatch' }, { status: 403 });
      logger.logAPI(req, response, { className: 'StudentDeleteAPI', methodName: 'DELETE' }, start);
      return response;
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          name: null,
          email: null,
          phone: null,
          parentEmail: null,
          parentPhone: null,
          whatsappPhone: null,
          image: null,
          accountStatus: AccountStatus.deletion_pending,
          status: 'ANONYMIZED',
          requiresParentVerification: false,
          subjects: [],
        },
      }),
      prisma.consentRequest.updateMany({
        where: { studentId: id, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      }),
    ]);

    const response = NextResponse.json({ ok: true });
    logger.logAPI(req, response, { className: 'StudentDeleteAPI', methodName: 'DELETE' }, start);
    return response;
  } catch (error) {
    logger.error('student.delete.failed', { error: String(error), studentId: id });
    const response = NextResponse.json({ error: 'server_error' }, { status: 500 });
    logger.logAPI(req, response, { className: 'StudentDeleteAPI', methodName: 'DELETE' }, start);
    return response;
  }
}
