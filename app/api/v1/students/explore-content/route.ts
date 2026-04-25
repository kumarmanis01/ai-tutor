/**
 * FILE OBJECTIVE:
 * - Return 3 curated sample topics for a given grade and board to power Explore Mode.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/v1/students/explore-content.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created
 * - 2026-04-24T12:00:00Z | copilot | validate grade (parseInt, range 1-12); case-insensitive board slug
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const start = Date.now();
  try {
    const url = new URL(req.url);
    const grade = url.searchParams.get('grade');
    const board = url.searchParams.get('board');

    if (!grade || !board) return NextResponse.json({ error: 'missing_params' }, { status: 400 });

    // Validate grade: must be an integer in [1, 12].
    const gradeNum = parseInt(grade, 10);
    if (Number.isNaN(gradeNum) || gradeNum < 1 || gradeNum > 12) {
      return NextResponse.json({ error: 'invalid_grade' }, { status: 400 });
    }

    const topics = await prisma.topicDef.findMany({
      where: {
        lifecycle: 'active',
        chapter: {
          subject: {
            class: {
              grade: gradeNum,
              // Case-insensitive slug match so "cbse" and "CBSE" both resolve.
              board: { slug: { equals: board, mode: 'insensitive' } },
            },
          },
        },
      },
      take: 3,
      select: {
        id: true,
        name: true,
        notes: { take: 1, select: { content: true } },
      },
    });

    const payload = topics.map((t) => ({
      id: t.id,
      name: t.name,
      sampleNote: t.notes?.[0]?.content ?? null,
    }));
    const res = NextResponse.json({ ok: true, topics: payload });
    logger.logAPI(req, res, { className: 'ExploreContentAPI', methodName: 'GET' }, start);
    return res;
  } catch (err) {
    logger.error('explore-content failed', { error: String(err) });
    const res = NextResponse.json({ error: 'server_error' }, { status: 500 });
    logger.logAPI(req, res, { className: 'ExploreContentAPI', methodName: 'GET' }, start);
    return res;
  }
}
