/**
 * FILE OBJECTIVE:
 * - Lets students see what their linked parents can see (transparency).
 * - Also allows students to generate invite codes for parent linking.
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created student parent-view transparency API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import type { AppSession } from '@/lib/types/auth';
import { randomBytes } from 'crypto';

const CLASS_NAME = 'StudentParentViewAPI';

/**
 * GET /api/student/parent-view
 * Returns what the student's parents can see: linked parents, aggregated stats visible to them
 */
export async function GET(req: NextRequest) {
  const start = Date.now();

  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const studentId = session.user.id;

    // Get linked parents
    const links = await prisma.parentStudent.findMany({
      where: { studentId, status: 'active' },
      include: {
        parent: { select: { name: true, email: true } },
      },
    });

    // Get pending invite codes (not yet claimed)
    const pendingInvites = await prisma.parentStudent.findMany({
      where: { studentId, status: 'pending', inviteCode: { not: null } },
      select: { inviteCode: true, createdAt: true },
    });

    // Get attention flags for this student (what parents see)
    const attentionFlags = await prisma.attentionFlag.findMany({
      where: { studentId, resolved: false },
      select: { subject: true, chapter: true, masteryLevel: true, accuracy: true, reason: true },
      take: 10,
    });

    // Get readiness status (what parents see)
    const readiness = await prisma.readinessStatus.findMany({
      where: { studentId },
      select: { subject: true, readinessScore: true, readinessLabel: true, coveragePercent: true },
    });

    const response = NextResponse.json({
      linkedParents: links.map((l) => ({
        name: l.parent.name || 'Parent',
        email: l.parent.email ? maskEmail(l.parent.email) : null,
      })),
      pendingInvites: pendingInvites.map((p) => ({
        code: p.inviteCode,
        createdAt: p.createdAt.toISOString(),
      })),
      parentCanSee: {
        attentionFlags,
        readiness,
        note: 'Your parents can see aggregated subject progress, weak topics, and exam readiness. They cannot see individual answers or chat history.',
      },
    });

    logger.logAPI(req, response, { className: CLASS_NAME, methodName: 'GET' }, start);
    return response;
  } catch (error) {
    logger.error('Student parent-view failed', { className: CLASS_NAME, error });
    return NextResponse.json({ error: formatErrorForResponse(error) }, { status: 500 });
  }
}

/**
 * POST /api/student/parent-view
 * Generate an invite code for a parent
 */
export async function POST(req: NextRequest) {
  const start = Date.now();

  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const studentId = session.user.id;

    // Check for existing pending code
    const existing = await prisma.parentStudent.findFirst({
      where: { studentId, status: 'pending', inviteCode: { not: null } },
    });

    if (existing?.inviteCode) {
      return NextResponse.json({ inviteCode: existing.inviteCode });
    }

    // Generate unique code
    let code = randomBytes(4).toString('hex').toUpperCase();
    let attempts = 0;
    while (attempts < 5) {
      const conflict = await prisma.parentStudent.findUnique({ where: { inviteCode: code } });
      if (!conflict) break;
      code = randomBytes(4).toString('hex').toUpperCase();
      attempts++;
    }

    await prisma.parentStudent.create({
      data: {
        parentId: studentId, // temporary, updated when parent claims
        studentId,
        inviteCode: code,
        status: 'pending',
      },
    });

    logger.info('Student generated parent invite code', { className: CLASS_NAME, studentId });

    const response = NextResponse.json({ inviteCode: code });
    logger.logAPI(req, response, { className: CLASS_NAME, methodName: 'POST' }, start);
    return response;
  } catch (error) {
    logger.error('Generate invite code failed', { className: CLASS_NAME, error });
    return NextResponse.json({ error: formatErrorForResponse(error) }, { status: 500 });
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  const masked = local.charAt(0) + '***' + (local.length > 1 ? local.charAt(local.length - 1) : '');
  return `${masked}@${domain}`;
}
