/**
 * FILE OBJECTIVE:
 * - Manage parent-student linking: generate invite codes, link via code, unlink.
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created parent link management API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import type { AppSession } from '@/lib/types/auth';
import { randomBytes } from 'crypto';

const CLASS_NAME = 'ParentLinkAPI';

/**
 * Generate a short alphanumeric invite code
 */
function generateInviteCode(): string {
  return randomBytes(4).toString('hex').toUpperCase(); // 8-char hex code
}

/**
 * POST /api/parent/link
 * Two modes:
 *   1. { action: "generate" } — student generates an invite code for their parent
 *   2. { action: "link", inviteCode: "ABCD1234" } — parent links using invite code
 *   3. { action: "link", studentEmail: "x@y.com" } — parent links using email (existing)
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
      return handleLink(session.user.id, body, req, start);
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
  // Check if student already has a pending invite code
  const existing = await prisma.parentStudent.findFirst({
    where: {
      studentId,
      inviteCode: { not: null },
      status: 'pending',
    },
  });

  if (existing?.inviteCode) {
    const response = NextResponse.json({ inviteCode: existing.inviteCode });
    logger.logAPI(req, response, { className: CLASS_NAME, methodName: 'handleGenerateCode' }, start);
    return response;
  }

  // Generate a unique code and create a pending link placeholder
  let code = generateInviteCode();
  let attempts = 0;
  while (attempts < 5) {
    const conflict = await prisma.parentStudent.findUnique({ where: { inviteCode: code } });
    if (!conflict) break;
    code = generateInviteCode();
    attempts++;
  }

  // Create a pending record with no parent yet (parentId = studentId as placeholder)
  // We'll update parentId when a parent claims the code
  await prisma.parentStudent.create({
    data: {
      parentId: studentId, // temporary self-link, updated when parent claims
      studentId,
      inviteCode: code,
      status: 'pending',
    },
  });

  logger.info('Invite code generated', { className: CLASS_NAME, studentId, code });
  const response = NextResponse.json({ inviteCode: code });
  logger.logAPI(req, response, { className: CLASS_NAME, methodName: 'handleGenerateCode' }, start);
  return response;
}

/**
 * Parent links to a student via invite code or email
 */
async function handleLink(parentId: string, body: any, req: NextRequest, start: number) {
  const { inviteCode, studentEmail } = body;

  if (!inviteCode && !studentEmail) {
    return NextResponse.json({ error: 'inviteCode or studentEmail required' }, { status: 400 });
  }

  let studentId: string;

  if (inviteCode) {
    // Find pending link by invite code
    const pendingLink = await prisma.parentStudent.findUnique({
      where: { inviteCode },
    });

    if (!pendingLink || pendingLink.status !== 'pending') {
      return NextResponse.json({ error: 'Invalid or expired invite code' }, { status: 404 });
    }

    // Prevent self-linking
    if (pendingLink.studentId === parentId) {
      return NextResponse.json({ error: 'Cannot link to yourself' }, { status: 400 });
    }

    studentId = pendingLink.studentId;

    // Check if parent already linked to this student
    const existingActive = await prisma.parentStudent.findFirst({
      where: {
        parentId,
        studentId,
        status: 'active',
      },
    });

    if (existingActive) {
      return NextResponse.json({ error: 'Already linked to this student' }, { status: 409 });
    }

    // Update the pending record: assign parent, activate, clear code
    await prisma.parentStudent.update({
      where: { id: pendingLink.id },
      data: {
        parentId,
        status: 'active',
        inviteCode: null, // consumed
      },
    });

    logger.info('Parent linked via invite code', { className: CLASS_NAME, parentId, studentId });
  } else {
    // Find student by email
    const student = await prisma.user.findUnique({ where: { email: studentEmail } });
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    if (student.id === parentId) {
      return NextResponse.json({ error: 'Cannot link to yourself' }, { status: 400 });
    }

    studentId = student.id;

    // Check existing
    const existing = await prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
    });

    if (existing && existing.status === 'active') {
      return NextResponse.json({ error: 'Already linked to this student' }, { status: 409 });
    }

    if (existing && existing.status === 'revoked') {
      // Reactivate
      await prisma.parentStudent.update({
        where: { id: existing.id },
        data: { status: 'active' },
      });
    } else {
      await prisma.parentStudent.create({
        data: { parentId, studentId, status: 'active' },
      });
    }

    logger.info('Parent linked via email', { className: CLASS_NAME, parentId, studentId });
  }

  // Update parent's role to "parent" if not already admin/moderator
  const parentUser = await prisma.user.findUnique({ where: { id: parentId }, select: { role: true } });
  if (parentUser && parentUser.role === 'user') {
    await prisma.user.update({
      where: { id: parentId },
      data: { role: 'parent' },
    });
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: parentId,
      action: 'parent_link_student',
      details: { parentId, studentId, method: inviteCode ? 'invite_code' : 'email' },
    },
  }).catch((err) => logger.warn('audit log failed', { error: String(err) }));

  const response = NextResponse.json({ ok: true, studentId });
  logger.logAPI(req, response, { className: CLASS_NAME, methodName: 'handleLink' }, start);
  return response;
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
        userId: parentId,
        action: 'parent_unlink_student',
        details: { parentId, studentId },
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
