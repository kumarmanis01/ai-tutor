/**
 * FILE OBJECTIVE:
 * - A1.2: GET /api/v1/admin/content/[id] -- fetch single content item for review.
 *   POST /api/v1/admin/content/[id] -- update content (save draft with edited markdown).
 *   Admin/moderator-only. Returns full contentJson + version history.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/content/[id]/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created A1.2 single content review GET/POST
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { id: string } };

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Authentication required' }, { status: 401 });
  }
  if (session.user.role !== 'admin' && session.user.role !== 'moderator') {
    return NextResponse.json({ code: 'FORBIDDEN', message: 'Admin or moderator role required' }, { status: 403 });
  }

  const { id } = params;
  try {
    const content = await prisma.content.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 10 },
        flags: {
          where: { status: 'OPEN' },
          select: { id: true, reason: true, notes: true, flaggedBy: true, createdAt: true },
          take: 20,
        },
        generationJobs: {
          select: { id: true, status: true, subscriberIds: true, createdAt: true },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!content) {
      return NextResponse.json({ code: 'NOT_FOUND', message: 'Content not found' }, { status: 404 });
    }

    return NextResponse.json({ content });
  } catch (err: unknown) {
    logger.error('admin/content/[id]: GET failed', { id, error: err });
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch content' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Authentication required' }, { status: 401 });
  }
  if (session.user.role !== 'admin' && session.user.role !== 'moderator') {
    return NextResponse.json({ code: 'FORBIDDEN', message: 'Admin or moderator role required' }, { status: 403 });
  }

  const { id } = params;
  let body: { contentJson?: unknown; action?: string; reason?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'Invalid request body' }, { status: 400 });
  }

  const { contentJson, action, reason } = body;

  try {
    const existing = await prisma.content.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ code: 'NOT_FOUND', message: 'Content not found' }, { status: 404 });
    }

    // Map action → status
    const statusMap: Record<string, string> = {
      approve: 'APPROVED',
      reject: 'REJECTED',
      archive: 'ARCHIVED',
      save_draft: existing.status as string,
    };
    const newStatus = action ? (statusMap[action] ?? existing.status) : existing.status;

    await prisma.$transaction(async (tx) => {
      // Snapshot current version to ContentVersion table if content changed
      if (contentJson !== undefined) {
        await tx.contentVersion.create({
          data: {
            contentId: id,
            version: existing.version,
            contentJson: existing.contentJson,
          },
        });
        await tx.content.update({
          where: { id },
          data: {
            contentJson: contentJson as never,
            version: existing.version + 1,
            status: newStatus as 'APPROVED' | 'REJECTED' | 'ARCHIVED' | 'DRAFT' | 'PENDING_REVIEW',
          },
        });
      } else if (action) {
        await tx.content.update({
          where: { id },
          data: {
            status: newStatus as 'APPROVED' | 'REJECTED' | 'ARCHIVED' | 'DRAFT' | 'PENDING_REVIEW',
          },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          adminId: session.user.id,
          targetEntity: 'Content',
          targetId: id,
          action: action === 'approve' ? 'CONTENT_APPROVE' : action === 'reject' ? 'CONTENT_REJECT' : undefined,
          previousValue: { status: existing.status, version: existing.version },
          newValue: { status: newStatus, contentChanged: contentJson !== undefined },
          reason: reason ?? null,
          ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    logger.error('admin/content/[id]: POST failed', { id, action, error: err });
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Update failed' }, { status: 500 });
  }
}
