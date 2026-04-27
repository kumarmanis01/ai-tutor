export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertNoStringFilters } from '@/lib/guards/noStringFilters';
import { logger } from '@/lib/logger';
import type { Prisma } from '@prisma/client';

/**
 * GET /api/hierarchy
 * Canonical, ID-based, lifecycle-aware academic hierarchy for UI selectors and admin tools.
 *
 * Query params:
 *   - boardId (optional)
 *   - include=subjects,chapters,topics (optional, comma-separated)
 *
 * No content generation, no mutations, no string-based identity.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    // Runtime guard: disallow string-based hierarchy filters
    assertNoStringFilters(req);
    const boardId = searchParams.get("boardId");
    const include = searchParams.get("include") ?? "subjects";

    const includeChapters = include.includes("chapters");
    const includeTopics = include.includes("topics");

    const topicsInclude = includeTopics
      ? { topics: { where: { lifecycle: "active" }, orderBy: { order: "asc" } } }
      : undefined;

    const chaptersInclude = includeChapters
      ? { chapters: { where: { lifecycle: "active" }, orderBy: { order: "asc" }, include: topicsInclude } }
      : undefined;

    const subjectsInclude = { where: { lifecycle: "active" }, orderBy: { name: "asc" }, include: chaptersInclude };

    const classesInclude = { where: { lifecycle: "active" }, orderBy: { grade: "asc" }, include: { subjects: subjectsInclude } };

    const boards = await prisma.board.findMany({
      where: {
        lifecycle: "active",
        ...(boardId ? { id: boardId } : {}),
      },
      orderBy: { name: "asc" },
      include: { classes: classesInclude } as Prisma.BoardInclude,
    });
    return NextResponse.json({ boards });
  } catch (err) {
    logger.error('/api/hierarchy error', { err });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
