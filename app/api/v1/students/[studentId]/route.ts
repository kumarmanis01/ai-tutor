/**
 * FILE OBJECTIVE:
 * - DELETE endpoint for student self-cancel flow during consent waiting state.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/students/studentId/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created delete student endpoint for explore cancel flow
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getServerSessionForHandlers } from '@/lib/session';
import { AccountStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ studentId: string }>;
}

export async function DELETE(req: Request, { params }: Params) {
  const start = Date.now();
  const { studentId } = await params;
  try {
    const session = await getServerSessionForHandlers();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ error: 'auth_required' }, { status: 401 });
    }
    if (userId !== studentId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
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

    const res = NextResponse.json({ ok: true });
    logger.logAPI(req, res, { className: 'StudentDeleteAPI', methodName: 'DELETE' }, start);
    return res;
  } catch (err) {
    logger.error('student.delete failed', { error: String(err), studentId });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
