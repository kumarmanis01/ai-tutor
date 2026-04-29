/**
 * FILE OBJECTIVE:
 * - GET /api/v1/content/search?q={query}&grade={grade}&board={board}
 *   Searches approved TopicNotes and Content (AI-generated) by keyword.
 *   Returns matched results or empty array. Auth-guarded.
 *   Used by S3.1 search bar on the Learning Map.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/content/search/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created S3.1 content search route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Auth guard -- session first, before any DB query
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Authentication required' },
      { status: 401 }
    );
  }

  const { searchParams } = req.nextUrl;
  const q = (searchParams.get('q') ?? '').trim();
  const gradeRaw = searchParams.get('grade');
  const board = (searchParams.get('board') ?? '').trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const grade = gradeRaw ? Number.parseInt(gradeRaw, 10) : null;

  try {
    // -- Search 1: TopicDef names matching the query (approved lifecycle)
    const topicResults = await prisma.topicDef.findMany({
      where: {
        lifecycle: 'active',
        status: 'approved',
        name: { contains: q, mode: 'insensitive' },
        ...(grade != null && !Number.isNaN(grade)
          ? {
              chapter: {
                subject: {
                  class: { grade },
                  ...(board ? { class: { board: { name: { contains: board, mode: 'insensitive' } } } } : {}),
                },
              },
            }
          : {}),
      },
      include: {
        chapter: {
          include: {
            subject: {
              include: {
                class: { include: { board: true } },
              },
            },
          },
        },
        notes: {
          where: { lifecycle: 'active', status: 'approved' },
          select: { id: true, title: true, language: true },
          take: 1,
        },
      },
      take: 20,
      orderBy: { name: 'asc' },
    });

    // -- Search 2: AI-generated Content matching the query (approved or pending-review)
    const contentResults = await prisma.content.findMany({
      where: {
        status: { in: ['APPROVED', 'PENDING_REVIEW'] },
        topic: { contains: q, mode: 'insensitive' },
        ...(grade != null && !Number.isNaN(grade) ? { grade } : {}),
        ...(board ? { board: { contains: board, mode: 'insensitive' } } : {}),
      },
      select: {
        id: true,
        topic: true,
        subject: true,
        grade: true,
        board: true,
        language: true,
        type: true,
        status: true,
        createdAt: true,
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    // Normalise to a unified result shape
    type SearchResult = {
      id: string;
      type: 'topic' | 'ai_content';
      title: string;
      subject: string;
      grade: number | null;
      board: string;
      description: string;
      contentStatus: string;
      topicId?: string;
      contentId?: string;
    };

    const results: SearchResult[] = [
      ...topicResults.map((t) => ({
        id: t.id,
        type: 'topic' as const,
        title: t.name,
        subject: t.chapter?.subject?.name ?? '',
        grade: t.chapter?.subject?.class?.grade ?? null,
        board: t.chapter?.subject?.class?.board?.name ?? '',
        description: `${t.chapter?.name ?? ''} -- ${t.chapter?.subject?.name ?? ''}`,
        contentStatus: t.status,
        topicId: t.id,
      })),
      ...contentResults.map((c) => ({
        id: c.id,
        type: 'ai_content' as const,
        title: c.topic,
        subject: c.subject,
        grade: c.grade,
        board: c.board,
        description: `AI Generated -- ${c.subject}`,
        contentStatus: c.status,
        contentId: c.id,
      })),
    ];

    return NextResponse.json({ results, query: q });
  } catch (err: unknown) {
    logger.error('content/search: failed', { query: q, error: err });
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Search failed' },
      { status: 500 }
    );
  }
}
