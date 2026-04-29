/**
 * FILE OBJECTIVE:
 * - B6.1 / S0.5: Public endpoint for a child to claim their parent-created profile
 *   via a single-use deep-link token. No existing account required.
 *   Returns a full-access JWT pair on success.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/students/claim/route.spec.ts
 *
 * EDIT LOG:
 * - 2026-04-29T00:00:00Z | claude | created for B6.1 / S0.5
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  validateAndConsumeChildClaimToken,
  ClaimTokenExpiredError,
  ClaimTokenUsedError,
  ClaimTokenInvalidError,
} from '@/lib/auth/child-claim-token.service';
import { generateTokenPair } from '@/lib/auth/token.service';
import logAuditEvent from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const start = Date.now();

  let body: { claimToken?: unknown };
  try {
    body = (await req.json()) as { claimToken?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const claimToken = typeof body.claimToken === 'string' ? body.claimToken.trim() : '';
  if (!claimToken) {
    return NextResponse.json({ error: 'claim_token_required' }, { status: 400 });
  }

  try {
    const { childId, parentId } = await validateAndConsumeChildClaimToken(claimToken);

    // Fetch child profile (grade/board are stored as untyped String fields per schema conventions)
    const child = await prisma.user.findUnique({
      where: { id: childId },
      select: { id: true, name: true, accountStatus: true },
    });
    if (!child) {
      return NextResponse.json({ error: 'profile_not_found' }, { status: 404 });
    }

    // Activate the account if it's still in a pending state
    if ((child.accountStatus as string) !== 'active') {
      await prisma.user.update({
        where: { id: childId },
        data: { accountStatus: 'active' as never },
      });
    }

    // Read grade/board as dynamic fields (stored as String per Prisma schema)
    const childFull = await prisma.user.findUnique({
      where: { id: childId },
      select: { id: true, name: true },
    });

    // Use raw query to fetch grade/board since they are stored as untyped columns
    const raw = await prisma.$queryRaw<Array<{ grade: string | null; board: string | null }>>`
      SELECT grade, board FROM "User" WHERE id = ${childId}
    `;
    const gradeVal = raw[0]?.grade ?? null;
    const boardVal = raw[0]?.board ?? null;

    // Issue full-access JWT pair for the student
    const { accessToken, refreshToken } = await generateTokenPair({
      sub: childId,
      role: 'user',
      scope: 'user',
    });

    logAuditEvent(prisma, {
      targetEntity: 'User',
      targetId: childId,
      action: null,
      details: {
        legacyAction: 'child_claim_profile',
        parentId,
        claimedAt: new Date().toISOString(),
      },
    });

    const res = NextResponse.json({
      ok: true,
      accessToken,
      refreshToken,
      child: {
        id: childFull?.id ?? childId,
        name: childFull?.name ?? null,
        grade: gradeVal,
        board: boardVal,
      },
    });
    logger.logAPI(req, res, { className: 'StudentClaimAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    if (err instanceof ClaimTokenExpiredError) {
      const res = NextResponse.json(
        { error: 'token_expired', message: err.message },
        { status: 401 }
      );
      logger.logAPI(req, res, { className: 'StudentClaimAPI', methodName: 'POST' }, start);
      return res;
    }
    if (err instanceof ClaimTokenUsedError) {
      const res = NextResponse.json(
        { error: 'token_used', message: err.message },
        { status: 409 }
      );
      logger.logAPI(req, res, { className: 'StudentClaimAPI', methodName: 'POST' }, start);
      return res;
    }
    if (err instanceof ClaimTokenInvalidError) {
      const res = NextResponse.json(
        { error: 'token_invalid', message: err.message },
        { status: 401 }
      );
      logger.logAPI(req, res, { className: 'StudentClaimAPI', methodName: 'POST' }, start);
      return res;
    }
    logger.error('students.claim failed', { error: String(err) });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
