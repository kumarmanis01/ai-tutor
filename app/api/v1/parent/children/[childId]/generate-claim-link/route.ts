/**
 * FILE OBJECTIVE:
 * - B6.1 / S0.5: Generate a single-use 7-day claim token for a parent-created child
 *   profile. The token is embedded in a deep link sent to the child (via WhatsApp /
 *   email / shared device) so the child can claim their profile without registering.
 *
 * Auth: parent session required. Parent must own the childId via ParentStudent.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/parent/children/generate-claim-link/route.spec.ts
 *
 * EDIT LOG:
 * - 2026-04-29T00:00:00Z | claude | created for B6.1 / S0.5
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  generateChildClaimToken,
  ClaimTokenRateLimitError,
} from '@/lib/auth/child-claim-token.service';
import logAuditEvent from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: { childId: string } }
) {
  const start = Date.now();

  const session = await getServerSessionForHandlers();
  const parentId = (session?.user as { id?: string } | undefined)?.id;
  if (!parentId) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }

  const { childId } = params;

  try {
    // Verify parent actively owns this child
    const link = await prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId: childId } },
      select: { status: true },
    });
    if (!link || link.status !== 'active') {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const { claimToken, expiresAt } = await generateChildClaimToken(childId, parentId);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://spinzyacademy.com';
    const deepLink = `${appUrl}/student/claim?token=${claimToken}`;

    logAuditEvent(prisma, {
      targetEntity: 'User',
      targetId: childId,
      action: null,
      details: {
        legacyAction: 'generate_child_claim_link',
        parentId,
        expiresAt: expiresAt.toISOString(),
      },
    });

    const res = NextResponse.json({
      ok: true,
      claimToken,
      deepLink,
      expiresAt: expiresAt.toISOString(),
    });
    logger.logAPI(req, res, { className: 'GenerateClaimLinkAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    if (err instanceof ClaimTokenRateLimitError) {
      const res = NextResponse.json(
        { error: 'rate_limited', message: err.message },
        { status: 429 }
      );
      logger.logAPI(req, res, { className: 'GenerateClaimLinkAPI', methodName: 'POST' }, start);
      return res;
    }
    logger.error('generate-claim-link failed', {
      error: String(err),
      childId,
      parentId,
    });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
