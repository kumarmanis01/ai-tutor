/**
 * FILE OBJECTIVE:
 * - POST /api/v1/students/[studentId]/freemium/request-upgrade
 * - Sends upgrade request signal to parent and enforces 24h cooldown per feature type.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/students/studentId/freemium/request-upgrade/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created S2.4 upgrade request endpoint with cooldown
 * - 2026-04-25T01:25:00Z | copilot | stored request timestamp in cooldown key value for UI restore support
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { sendPushSafe } from '@/lib/push/send';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ studentId: string }>;
}

const requestSchema = z.object({
  featureType: z.enum(['practice', 'ai_tutor', 'chapter_quiz']).default('practice'),
});

const COOLDOWN_SECONDS = 24 * 60 * 60;

function keyFor(studentId: string, featureType: string): string {
  return `freemium:upgrade-request:${studentId}:${featureType}`;
}

export async function POST(req: Request, { params }: Params) {
  const start = Date.now();
  const { studentId } = await params;

  try {
    const session = await getServerSessionForHandlers();
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      logger.logAPI(req, res, { className: 'FreemiumUpgradeRequestAPI', methodName: 'POST' }, start);
      return res;
    }

    if (userId !== studentId) {
      const res = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      logger.logAPI(req, res, { className: 'FreemiumUpgradeRequestAPI', methodName: 'POST' }, start);
      return res;
    }

    const parsed = requestSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      const res = NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
      logger.logAPI(req, res, { className: 'FreemiumUpgradeRequestAPI', methodName: 'POST' }, start);
      return res;
    }

    const { featureType } = parsed.data;

    const redis = getRedis();
    const cooldownKey = keyFor(userId, featureType);

    if (redis) {
      const existing = await redis.get(cooldownKey);
      if (existing) {
        const ttl = await redis.ttl(cooldownKey);
        const res = NextResponse.json(
          {
            ok: false,
            code: 'COOLDOWN_ACTIVE',
            message: 'Upgrade request already sent in the last 24 hours.',
            retryAfterSeconds: Math.max(0, ttl),
          },
          { status: 429 }
        );
        logger.logAPI(req, res, { className: 'FreemiumUpgradeRequestAPI', methodName: 'POST' }, start);
        return res;
      }
    }

    const student = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const parentLink = await prisma.parentStudent.findFirst({
      where: {
        studentId: userId,
        status: 'active',
      },
      select: { parentId: true },
    });

    if (redis) {
      await redis.set(
        cooldownKey,
        JSON.stringify({ requestedAt: new Date().toISOString(), featureType }),
        'EX',
        COOLDOWN_SECONDS
      );
    }

    await prisma.auditLog.create({
      data: {
        adminId: null,
        targetEntity: 'freemium_upgrade_request',
        targetId: userId,
        reason: 'student_request',
        details: {
          featureType,
          requestedByStudentId: userId,
          requestedAt: new Date().toISOString(),
        },
      },
    });

    if (parentLink?.parentId) {
      const studentName = student?.name?.trim() || 'Your child';
      await sendPushSafe(parentLink.parentId, {
        title: `${studentName} wants unlimited practice`,
        body: 'Tap to review and unlock Premium features for learning progress.',
        url: '/parent',
        tag: 'freemium-upgrade-request',
      });
    }

    const res = NextResponse.json({
      ok: true,
      featureType,
      cooldownSeconds: COOLDOWN_SECONDS,
      parentNotified: Boolean(parentLink?.parentId),
    });

    logger.logAPI(req, res, { className: 'FreemiumUpgradeRequestAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('FreemiumUpgradeRequestAPI.error', {
      event: 'freemium_upgrade_request_failed',
      context: { error: err instanceof Error ? err.message : String(err), studentId },
    });
    const res = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    logger.logAPI(req, res, { className: 'FreemiumUpgradeRequestAPI', methodName: 'POST' }, start);
    return res;
  }
}
