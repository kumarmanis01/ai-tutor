/**
 * FILE OBJECTIVE:
 * - GET /api/hierarchy: canonical, ID-based, lifecycle-aware academic hierarchy
 *   (Board -> Class -> Subject -> Chapter -> Topic) for UI selectors and admin
 *   tools. Redis-cached 1h, keyed by boardId + include set.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/hierarchy/route.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-06-06T00:00:00Z | claude | add 1h Redis cache keyed by boardId+include; add standard header
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertNoStringFilters } from '@/lib/guards/noStringFilters';
import { logger } from '@/lib/logger';
import { getRedis } from '@/lib/redis';
import type { Prisma } from '@prisma/client';

const HIERARCHY_CACHE_TTL_SEC = 3600;

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

    // Cache the hierarchy tree -- this is static reference data that changes
    // only on curriculum updates. Each render of the academic-picker UI was
    // hitting Neon with a 3.7s join across Board/Class/Subject/Chapter/Topic.
    const cacheKey = `hierarchy:${boardId ?? 'all'}:${include}`;
    const redis = getRedis?.();
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return new NextResponse(cached, {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
      } catch (cacheErr) {
        logger.warn('/api/hierarchy cache read failed', { err: String(cacheErr) });
      }
    }

    const boards = await prisma.board.findMany({
      where: {
        lifecycle: "active",
        ...(boardId ? { id: boardId } : {}),
      },
      orderBy: { name: "asc" },
      include: { classes: classesInclude } as Prisma.BoardInclude,
    });
    const payload = JSON.stringify({ boards });
    if (redis) {
      try {
        await redis.set(cacheKey, payload, 'EX', HIERARCHY_CACHE_TTL_SEC);
      } catch (cacheErr) {
        logger.warn('/api/hierarchy cache write failed', { err: String(cacheErr) });
      }
    }
    return new NextResponse(payload, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    logger.error('/api/hierarchy error', { err });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
