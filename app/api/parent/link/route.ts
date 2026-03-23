/**
 * FILE OBJECTIVE:
 * - Manage parent-student linking:
 *   - Student generates an invite code (preferred path) with expiry.
 *   - Parent redeems invite code to link.
 *   - Optional email-linking is allowed only when the student has explicitly set `parentEmail`.
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created parent link management API
 * - 2026-03-03 | gpt | migrate to ParentInvite + harden privacy
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import type { AppSession } from '@/lib/types/auth';
import {
  createOrReuseParentInviteForStudent,
  linkParentToStudentByEmail,
  redeemParentInviteAndLink,
  PARENT_INVITE_TTL_DAYS,
} from '@/lib/parent/inviteService';

const CLASS_NAME = 'ParentLinkAPI';

/**
 * POST /api/parent/link
 * Two modes:
 *   1. { action: "generate" } -- student generates an invite code for their parent (preferred)
 *   2. { action: "link", inviteCode: "ABCD1234" } -- parent links using invite code (preferred)
 *   3. { action: "link", studentEmail: "x@y.com" } -- parent links using email (only if student.parentEmail matches)
 */
export async function POST(req: NextRequest) {
  const start = Date.now();
  const METHOD_NAME = 'POST';

  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'generate') {
      return handleGenerateCode(session.user.id, req, start);
    } else if (action === 'link') {
      return handleLink(session.user.id, session.user.email ?? null, body, req, start);
    } else {
      return NextResponse.json({ error: 'Invalid action. Use "generate" or "link".' }, { status: 400 });
    }
  } catch (error) {
    logger.error('Parent link operation failed', { className: CLASS_NAME, methodName: METHOD_NAME, error });
    return NextResponse.json({ error: formatErrorForResponse(error) }, { status: 500 });
  }
}

/**
 * Student generates an invite code that a parent can use to link
 */
async function handleGenerateCode(studentId: string, req: NextRequest, start: number) {
  const invite = await createOrReuseParentInviteForStudent({ prisma, studentId });

  await prisma.auditLog
    .create({
      data: {
        adminId: studentId,
        targetEntity: 'User',
        targetId: studentId,
        action: null,
        details: { legacyAction: 'student_generate_parent_invite', expiresAt: invite.expiresAt },
      },
    })
    .catch(() => {});

  logger.info('Invite code generated', { className: CLASS_NAME, studentId });
  const response = NextResponse.json({ inviteCode: invite.code, expiresAt: invite.expiresAt });
  logger.logAPI(req, response, { className: CLASS_NAME, methodName: 'handleGenerateCode' }, start);
  return response;
}

/**
 * Parent links to a student via invite code or email
 */
async function handleLink(parentId: string, parentEmail: string | null, body: any, req: NextRequest, start: number) {
  const { inviteCode, studentEmail } = body;

  if (!inviteCode && !studentEmail) {
    return NextResponse.json({ error: 'inviteCode or studentEmail required' }, { status: 400 });
  }

  if (inviteCode) {
    try {
      const result = await redeemParentInviteAndLink({ prisma, parentId, parentEmail, code: inviteCode });
      const response = NextResponse.json({ ok: true, studentId: result.studentId, status: result.status });
      logger.logAPI(req, response, { className: CLASS_NAME, methodName: 'handleLink' }, start);
      return response;
    } catch (err) {
      // Backward compatibility: allow redeeming legacy invite codes stored on ParentStudent.inviteCode,
      // but enforce TTL from createdAt to keep it time-limited.
      const now = new Date();
      const ttlMs = PARENT_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000;

      const legacy = await prisma.parentStudent.findUnique({
        where: { inviteCode: String(inviteCode).trim().toUpperCase() },
        select: { id: true, studentId: true, parentId: true, status: true, createdAt: true },
      });

      const legacyValid =
        legacy &&
        legacy.status === 'pending' &&
        now.getTime() - legacy.createdAt.getTime() <= ttlMs &&
        legacy.studentId !== parentId;

      if (!legacyValid) {
        const msg = (err as any)?.message || 'Invalid or expired invite code';
        const response = NextResponse.json({ error: msg }, { status: 404 });
        logger.logAPI(req, response, { className: CLASS_NAME, methodName: 'handleLink' }, start);
        return response;
      }

      // If parent already linked, consume legacy code without creating duplicates.
      const existing = await prisma.parentStudent.findUnique({
        where: { parentId_studentId: { parentId, studentId: legacy.studentId } },
        select: { id: true, status: true },
      });

      if (existing?.status === 'active') {
        await prisma.parentStudent.update({ where: { id: legacy.id }, data: { inviteCode: null, status: 'revoked' } }).catch(() => {});
        const response = NextResponse.json({ ok: true, studentId: legacy.studentId, status: 'already_linked' });
        logger.logAPI(req, response, { className: CLASS_NAME, methodName: 'handleLink' }, start);
        return response;
      }

      if (existing?.status === 'revoked') {
        // Reactivate the legacy record as the canonical link and remove the placeholder.
        await prisma.parentStudent.update({
          where: { id: legacy.id },
          data: { parentId, status: 'active', inviteCode: null },
        });
        await prisma.parentStudent
          .delete({ where: { id: existing.id } })
          .catch(() => {});
      } else if (!existing) {
        // No existing link yet -- convert the legacy placeholder into the real link.
        await prisma.parentStudent.update({
          where: { id: legacy.id },
          data: { parentId, status: 'active', inviteCode: null },
        });
      }

      await prisma.auditLog
        .create({
          data: {
            adminId: parentId,
            targetEntity: 'User',
            targetId: legacy.studentId,
            action: null,
            details: { legacyAction: 'parent_link_student', parentId, method: 'invite_code_legacy', status: 'linked' },
          },
        })
        .catch(() => {});

      const response = NextResponse.json({ ok: true, studentId: legacy.studentId, status: 'linked' });
      logger.logAPI(req, response, { className: CLASS_NAME, methodName: 'handleLink' }, start);
      return response;
    }
  } else {
    try {
      const result = await linkParentToStudentByEmail({ prisma, parentId, parentEmail, studentEmail });
      const response = NextResponse.json({ ok: true, studentId: result.studentId, status: result.status });
      logger.logAPI(req, response, { className: CLASS_NAME, methodName: 'handleLink' }, start);
      return response;
    } catch (err) {
      const msg = (err as any)?.message || 'Failed to link student';
      const status = msg.includes('not found') ? 404 : msg.includes('Already') ? 409 : 403;
      const response = NextResponse.json({ error: msg }, { status });
      logger.logAPI(req, response, { className: CLASS_NAME, methodName: 'handleLink' }, start);
      return response;
    }
  }
}

/**
 * DELETE /api/parent/link?studentId=xxx
 * Revoke (soft-delete) a parent-student link
 */
export async function DELETE(req: NextRequest) {
  const start = Date.now();

  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const studentId = req.nextUrl.searchParams.get('studentId');
    if (!studentId) {
      return NextResponse.json({ error: 'studentId required' }, { status: 400 });
    }

    const parentId = session.user.id;

    await prisma.parentStudent.updateMany({
      where: { parentId, studentId },
      data: { status: 'revoked' },
    });

    await prisma.auditLog.create({
      data: {
        adminId: parentId,
        targetEntity: 'User',
        targetId: studentId,
        action: null,
        details: { legacyAction: 'parent_unlink_student', parentId },
      },
    }).catch((err) => logger.warn('audit log failed', { error: String(err) }));

    logger.info('Parent-student link revoked', { className: CLASS_NAME, parentId, studentId });

    const response = NextResponse.json({ ok: true });
    logger.logAPI(req, response, { className: CLASS_NAME, methodName: 'DELETE' }, start);
    return response;
  } catch (error) {
    logger.error('Failed to unlink student', { className: CLASS_NAME, error });
    return NextResponse.json({ error: formatErrorForResponse(error) }, { status: 500 });
  }
}
