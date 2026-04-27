/**
 * FILE OBJECTIVE:
 * - Claim approved child consent requests by matching parent contact to the current parent account.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/parent/claim/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created v1 parent claim endpoint
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getServerSessionForHandlers } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const start = Date.now();
  try {
    const session = await getServerSessionForHandlers();
    const parentId = (session?.user as { id?: string } | undefined)?.id;
    if (!parentId) {
      return NextResponse.json({ error: 'auth_required' }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      phone?: string;
      email?: string;
      google_token?: string;
    };

    const parent = await prisma.user.findUnique({
      where: { id: parentId },
      select: { email: true, phone: true },
    });

    const phone = typeof body.phone === 'string' ? body.phone : parent?.phone ?? undefined;
    const email = typeof body.email === 'string' ? body.email : parent?.email ?? undefined;

    if (!phone && !email) {
      return NextResponse.json({ error: 'missing_contact' }, { status: 400 });
    }

    const approved = await prisma.consentRequest.findMany({
      where: {
        status: 'APPROVED',
        OR: [{ parentPhone: phone ?? undefined }, { parentEmail: email ?? undefined }],
      },
      select: { studentId: true },
    });

    const uniqueStudentIds = Array.from(new Set(approved.map((r) => r.studentId)));

    await Promise.all(
      uniqueStudentIds.map((studentId) =>
        prisma.parentStudent.upsert({
          where: { parentId_studentId: { parentId, studentId } },
          update: { status: 'active' },
          create: { parentId, studentId, status: 'active' },
        })
      )
    );

    await prisma.user.updateMany({
      where: { id: parentId, role: 'user' },
      data: { role: 'parent' },
    });

    const res = NextResponse.json({ ok: true, linkedChildren: uniqueStudentIds.length });
    logger.logAPI(req, res, { className: 'ParentClaimAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('parent.claim failed', { error: String(err) });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
