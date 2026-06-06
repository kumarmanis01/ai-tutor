/**
 * FILE OBJECTIVE:
 * - Lets students see what their linked parents can see (transparency).
 * - Also allows students to generate invite codes for parent linking.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/student/parent-view/route.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created student parent-view transparency API
 * - 2026-05-11T00:00:00Z | copilot | include auto-linked parent contacts with per-channel verification status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import type { AppSession } from '@/lib/types/auth';
import { createOrReuseParentInviteForStudent } from '@/lib/parent/inviteService';
import {
  ensureAutoLinkedParentsForStudent,
  getParentChannelVerificationStatus,
  resolveParentChannels,
} from '@/lib/parent/contactLinking';

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

    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { parentEmail: true, parentPhone: true, whatsappPhone: true },
    });

    await ensureAutoLinkedParentsForStudent({
      prisma,
      studentId,
      parentEmail: student?.parentEmail,
      whatsappPhone: student?.whatsappPhone,
      parentPhone: student?.parentPhone,
    });

    // Get linked parents
    const links = await prisma.parentStudent.findMany({
      where: { studentId, status: 'active' },
      include: {
        parent: { select: { id: true, name: true, email: true, whatsappPhone: true, phone: true } },
      },
    });

    const channelStatus = await getParentChannelVerificationStatus({
      prisma,
      studentId,
      parentEmail: student?.parentEmail,
      whatsappPhone: student?.whatsappPhone,
      parentPhone: student?.parentPhone,
    });

    const channels = resolveParentChannels(student?.parentEmail, student?.whatsappPhone, student?.parentPhone);

    const linkedParents = links.map((l: any) => ({
      name: l.parent.name || 'Parent',
      email: l.parent.email ? maskEmail(l.parent.email) : null,
      whatsapp: l.parent.whatsappPhone ? maskPhone(l.parent.whatsappPhone) : l.parent.phone ? maskPhone(l.parent.phone) : null,
      source: 'account_link',
      emailStatus: l.parent.email ? (channelStatus.email.verified ? 'verified' : 'unverified') : null,
      whatsappStatus: (l.parent.whatsappPhone || l.parent.phone)
        ? (channelStatus.whatsapp.verified ? 'verified' : 'unverified')
        : null,
    }));

    if (channels.hasEmail && !linkedParents.some((p: any) => p.email === channelStatus.email.masked)) {
      linkedParents.push({
        name: 'Parent (Email)',
        email: channelStatus.email.masked,
        whatsapp: null,
        source: 'contact_email',
        emailStatus: channelStatus.email.verified ? 'verified' : 'unverified',
        whatsappStatus: null,
      });
    }

    if (channels.hasWhatsapp && !linkedParents.some((p: any) => p.whatsapp === channelStatus.whatsapp.masked)) {
      linkedParents.push({
        name: 'Parent (WhatsApp)',
        email: null,
        whatsapp: channelStatus.whatsapp.masked,
        source: 'contact_whatsapp',
        emailStatus: null,
        whatsappStatus: channelStatus.whatsapp.verified ? 'verified' : 'unverified',
      });
    }

    // Get pending invite codes (not yet claimed)
    const pendingInvites = await prisma.parentInvite.findMany({
      where: { studentId, status: 'pending', expiresAt: { gt: new Date() } },
      select: { code: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
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
      linkedParents,
      pendingInvites: pendingInvites.map((p: any) => ({
        code: p.code,
        createdAt: p.createdAt.toISOString(),
        expiresAt: p.expiresAt.toISOString(),
      })),
      verification: channelStatus,
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

    const invite = await createOrReuseParentInviteForStudent({ prisma, studentId });

    logger.info('Student generated parent invite code', { className: CLASS_NAME, studentId });

    const response = NextResponse.json({ inviteCode: invite.code, expiresAt: invite.expiresAt });
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

function maskPhone(phone: string): string {
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '***';
  return `+** *****${digits.slice(-4)}`;
}
