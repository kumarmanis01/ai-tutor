export const dynamic = 'force-dynamic'

/**
 * FILE OBJECTIVE:
 * - Lightweight endpoint to fetch subjects for a given board + grade combination.
 * - Resolves slug/name-based lookups to the canonical hierarchy: Board → ClassLevel → SubjectDef.
 * - Designed for reusable subject dropdowns across admin, dashboard, and student pages.
 *
 * EDIT LOG:
 * - 2026-02-03 | claude | created shared subject selection endpoint
 * - 2026-02-07 | copilot | added force-dynamic to prevent static render error
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/subjects/for-selection?boardSlug=CBSE&gradeNum=10
 *
 * Returns active subjects for the given board + grade combination.
 * Uses slug-based board lookup and numeric grade to resolve through the hierarchy.
 *
 * Query params:
 *   - boardSlug (required): Board slug (e.g. "CBSE", "ICSE", "STATE")
 *   - gradeNum  (required): Grade number (e.g. 10)
 *
 * Response: { subjects: [{ id, name, slug }] }
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const boardSlug = searchParams.get('boardSlug');
    const gradeNum = searchParams.get('gradeNum');

    if (!boardSlug || !gradeNum) {
      return NextResponse.json(
        { error: 'boardSlug and gradeNum are required' },
        { status: 400 }
      );
    }

    const grade = parseInt(gradeNum, 10);
    if (isNaN(grade) || grade < 1 || grade > 12) {
      return NextResponse.json(
        { error: 'gradeNum must be a number between 1 and 12' },
        { status: 400 }
      );
    }

    // Resolve: Board (slug) → ClassLevel (grade) → SubjectDef (active)
    const board = await prisma.board.findFirst({
      where: {
        slug: { equals: boardSlug, mode: 'insensitive' },
        lifecycle: 'active',
      },
      select: { id: true },
    });

    if (!board) {
      return NextResponse.json({ subjects: [] });
    }

    const classLevel = await prisma.classLevel.findFirst({
      where: {
        boardId: board.id,
        grade,
        lifecycle: 'active',
      },
      select: { id: true },
    });

    if (!classLevel) {
      return NextResponse.json({ subjects: [] });
    }

    const subjects = await prisma.subjectDef.findMany({
      where: {
        classId: classLevel.id,
        lifecycle: 'active',
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ subjects });
  } catch (err) {
    logger.error('/api/subjects/for-selection error', { error: err });
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
