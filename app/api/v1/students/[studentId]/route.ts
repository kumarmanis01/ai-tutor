/**
 * FILE OBJECTIVE:
 * - DELETE /api/v1/students/{studentId} -- student self-cancel during explore/consent flow.
 *   Two auth paths:
 *   1. consent_token query param present: unauthenticated consent-cancel flow (S0.4).
 *      Validates token ownership + PENDING status, then fully anonymizes.
 *   2. No consent_token: session-authenticated delete for logged-in students.
 *
 * LINKED UNIT TESTS:
 * - tests/unit/app/api/v1/students/[studentId]/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created delete student endpoint for explore cancel flow
 * - 2026-04-27T00:00:00Z | copilot | merged consent-token path from [id]/route.ts to resolve ambiguous route build error
 * - 2026-04-27T13:30:00Z | copilot | reject delete when consent request is not pending to prevent token reuse
 * - 2026-04-27T00:00:00Z | copilot | add logger.logAPI to missing_student_id branch and catch block for consistent request tracing
 */

import { NextResponse } from 'next/server';
import { AccountStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getServerSessionForHandlers } from '@/lib/session';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ studentId: string }>;
}

async function deleteViaConsentToken(
  req: Request,
  studentId: string,
  consentToken: string,
  start: number
): Promise<NextResponse> {
  const consentRequest = await prisma.consentRequest.findUnique({
    where: { token: consentToken },
    select: { id: true, studentId: true, status: true },
  });

  if (!consentRequest || consentRequest.studentId !== studentId) {
    const response = NextResponse.json({ error: 'consent_mismatch' }, { status: 403 });
    logger.logAPI(req, response, { className: 'StudentDeleteAPI', methodName: 'DELETE' }, start);
    return response;
  }

  if (consentRequest.status !== 'PENDING') {
    const response = NextResponse.json({ error: 'consent_request_not_pending' }, { status: 409 });
    logger.logAPI(req, response, { className: 'StudentDeleteAPI', methodName: 'DELETE' }, start);
    return response;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: studentId },
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
      where: { studentId, status: 'PENDING' },
      data: { status: 'EXPIRED' },
    }),
  ]);

  const response = NextResponse.json({ ok: true });
  logger.logAPI(req, response, { className: 'StudentDeleteAPI', methodName: 'DELETE' }, start);
  return response;
}

async function deleteViaSession(
  req: Request,
  studentId: string,
  start: number
): Promise<NextResponse> {
  const session = await getServerSessionForHandlers();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    const response = NextResponse.json({ error: 'auth_required' }, { status: 401 });
    logger.logAPI(req, response, { className: 'StudentDeleteAPI', methodName: 'DELETE' }, start);
    return response;
  }
  if (userId !== studentId) {
    const response = NextResponse.json({ error: 'forbidden' }, { status: 403 });
    logger.logAPI(req, response, { className: 'StudentDeleteAPI', methodName: 'DELETE' }, start);
    return response;
  }

  await prisma.user.update({
    where: { id: studentId },
    data: {
      name: null,
      email: null,
      phone: null,
      accountStatus: AccountStatus.deletion_pending,
    },
  });

  const response = NextResponse.json({ ok: true });
  logger.logAPI(req, response, { className: 'StudentDeleteAPI', methodName: 'DELETE' }, start);
  return response;
}

export async function DELETE(req: Request, { params }: Params) {
  const start = Date.now();
  const { studentId } = await params;

  if (!studentId) {
    const response = NextResponse.json({ error: 'missing_student_id' }, { status: 400 });
    logger.logAPI(req, response, { className: 'StudentDeleteAPI', methodName: 'DELETE' }, start);
    return response;
  }

  try {
    const requestUrl = new URL(req.url);
    const consentToken = requestUrl.searchParams.get('consent_token');
    if (consentToken) {
      return await deleteViaConsentToken(req, studentId, consentToken, start);
    }
    return await deleteViaSession(req, studentId, start);
  } catch (err) {
    logger.error('student.delete.failed', { error: String(err), studentId });
    const response = NextResponse.json({ error: 'server_error' }, { status: 500 });
    logger.logAPI(req, response, { className: 'StudentDeleteAPI', methodName: 'DELETE' }, start);
    return response;
  }
}
