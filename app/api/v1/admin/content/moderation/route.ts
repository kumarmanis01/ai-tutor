/**
 * FILE OBJECTIVE:
 * - A1.1: GET /api/v1/admin/content/moderation
 *   Returns paginated Content records (AI-generated and curated) with
 *   request counts (subscriberIds length), flag counts, and filter support.
 *   Admin-only. Used by the V3 Moderation Dashboard.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/content/moderation/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created A1.1 admin content moderation API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Admin auth guard
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Authentication required' },
      { status: 401 }
    );
  }
  if (session.user.role !== 'admin' && session.user.role !== 'moderator') {
    return NextResponse.json(
      { code: 'FORBIDDEN', message: 'Admin or moderator role required' },
      { status: 403 }
    );
  }

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10));
  const status = searchParams.get('status') ?? '';
  const subject = searchParams.get('subject') ?? '';
  const gradeRaw = searchParams.get('grade');
  const board = searchParams.get('board') ?? '';
  const sort = searchParams.get('sort') ?? 'createdAt_desc';
  const q = (searchParams.get('q') ?? '').trim();
  const grade = gradeRaw ? Number.parseInt(gradeRaw, 10) : null;

  try {
    // Build dynamic where clause for Content model
    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }
    if (subject) {
      where.subject = { contains: subject, mode: 'insensitive' };
    }
    if (grade != null && !Number.isNaN(grade)) {
      where.grade = grade;
    }
    if (board) {
      where.board = { contains: board, mode: 'insensitive' };
    }
    if (q) {
      where.topic = { contains: q, mode: 'insensitive' };
    }

    // Build orderBy
    let orderBy: Record<string, 'asc' | 'desc'> = { createdAt: 'desc' };
    if (sort === 'createdAt_asc') orderBy = { createdAt: 'asc' };
    if (sort === 'topic_asc') orderBy = { topic: 'asc' };
    if (sort === 'status_asc') orderBy = { status: 'asc' };

    const skip = (page - 1) * PAGE_SIZE;

    const [rawItems, total] = await prisma.$transaction([
      prisma.content.findMany({
        where,
        orderBy,
        skip,
        take: PAGE_SIZE,
        select: {
          id: true,
          topic: true,
          subject: true,
          grade: true,
          board: true,
          language: true,
          type: true,
          status: true,
          version: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { flags: true } },
          // Load the related GenerationJob to get subscriberIds (request count)
          generationJobs: {
            select: { id: true, subscriberIds: true, status: true },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      prisma.content.count({ where }),
    ]);

    // Map to response shape
    const items = rawItems.map((item) => {
      const job = item.generationJobs[0];
      const requestCount = job ? job.subscriberIds.length + 1 : 0;
      return {
        id: item.id,
        topic: item.topic,
        subject: item.subject,
        grade: item.grade,
        board: item.board,
        language: item.language,
        type: item.type,
        status: item.status,
        version: item.version,
        requestCount,
        flagCount: item._count.flags,
        jobStatus: job?.status ?? null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });

    return NextResponse.json({
      items,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
      },
    });
  } catch (err: unknown) {
    logger.error('admin/content/moderation: GET failed', { error: err });
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to fetch moderation queue' },
      { status: 500 }
    );
  }
}
