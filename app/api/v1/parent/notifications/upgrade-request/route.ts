/**
 * FILE OBJECTIVE:
 * - Trigger an upgrade request notification from a student to linked parent account(s).
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/parent/notifications/upgrade-request/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created v1 parent upgrade-request endpoint
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getServerSessionForHandlers } from '@/lib/session';
import { sendPushSafe } from '@/lib/push/send';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const start = Date.now();
  try {
    const session = await getServerSessionForHandlers();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ error: 'auth_required' }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      studentId?: string;
      featureType?: 'practice' | 'ai_tutor' | 'chapter_quiz';
    };

    const studentId = typeof body.studentId === 'string' ? body.studentId : userId;
    if (studentId !== userId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const student = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    const links = await prisma.parentStudent.findMany({
      where: { studentId: userId, status: 'active' },
      select: { parentId: true },
    });

    await Promise.all(
      links.map((link) =>
        sendPushSafe(link.parentId, {
          title: `${student?.name ?? 'Your child'} wants unlimited practice`,
          body: 'Tap to review and unlock premium features.',
          url: '/parent',
          tag: 'freemium-upgrade-request',
        })
      )
    );

    const res = NextResponse.json({ ok: true, notifiedParents: links.length });
    logger.logAPI(req, res, { className: 'ParentUpgradeRequestAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('parent.notifications.upgrade-request failed', { error: String(err) });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
