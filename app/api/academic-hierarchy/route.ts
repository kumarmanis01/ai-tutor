/**
 * FILE OBJECTIVE:
 * - Single API endpoint that returns the complete academic hierarchy in a nested structure.
 * - Used by the CascadingFilters component to populate dropdowns without multiple API calls.
 * - Data can be cached by clients for the session to avoid repeated fetches.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/academic-hierarchy/route.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-03 | claude | created hierarchy API for session-cached cascading filters
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { LanguageCode, DifficultyLevel, SoftDeleteStatus } from '@prisma/client';

/**
 * Board with its classes/grades
 */
export interface HierarchyBoard {
  id: string;
  name: string;
  slug: string;
  classes: HierarchyClass[];
}

/**
 * Class/Grade with its subjects
 */
export interface HierarchyClass {
  id: string;
  grade: number;
  slug: string;
  subjects: HierarchySubject[];
}

/**
 * Subject with its chapters
 */
export interface HierarchySubject {
  id: string;
  name: string;
  slug: string;
  chapters: HierarchyChapter[];
}

/**
 * Chapter with its topics
 */
export interface HierarchyChapter {
  id: string;
  name: string;
  slug: string;
  order: number;
  topics: HierarchyTopic[];
}

/**
 * Topic (leaf node)
 */
export interface HierarchyTopic {
  id: string;
  name: string;
  slug: string;
  order: number;
}

/**
 * Complete hierarchy response
 */
export interface AcademicHierarchyResponse {
  boards: HierarchyBoard[];
  languages: { code: LanguageCode; name: string }[];
  difficulties: { value: DifficultyLevel; label: string }[];
  /** ISO timestamp when hierarchy was fetched */
  fetchedAt: string;
}

/**
 * GET /api/academic-hierarchy
 *
 * Returns the complete academic hierarchy in a nested structure:
 * Board → Class → Subject → Chapter → Topic
 *
 * This allows the CascadingFilters component to derive all dropdowns
 * from a single cached API response, avoiding multiple network requests.
 *
 * The response should be cached by the client for the session.
 * Stale-while-revalidate caching is recommended.
 */
export async function GET() {
  try {
    // Fetch complete hierarchy in one query with nested includes
    const boards = await prisma.board.findMany({
      where: { lifecycle: SoftDeleteStatus.active },
      orderBy: { name: 'asc' },
      include: {
        classes: {
          where: { lifecycle: SoftDeleteStatus.active },
          orderBy: { grade: 'asc' },
          include: {
            subjects: {
              where: { lifecycle: SoftDeleteStatus.active },
              orderBy: { name: 'asc' },
              include: {
                chapters: {
                  where: {
                    lifecycle: SoftDeleteStatus.active,
                  },
                  orderBy: { order: 'asc' },
                  include: {
                    topics: {
                      where: {
                        lifecycle: SoftDeleteStatus.active,
                      },
                      orderBy: { order: 'asc' },
                      select: {
                        id: true,
                        name: true,
                        slug: true,
                        order: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Transform to our interface shape (filtering only needed fields)
    const hierarchyBoards: HierarchyBoard[] = boards.map((board) => ({
      id: board.id,
      name: board.name,
      slug: board.slug,
      classes: board.classes.map((cls) => ({
        id: cls.id,
        grade: cls.grade,
        slug: cls.slug,
        subjects: cls.subjects.map((sub) => ({
          id: sub.id,
          name: sub.name,
          slug: sub.slug,
          chapters: sub.chapters.map((ch) => ({
            id: ch.id,
            name: ch.name,
            slug: ch.slug,
            order: ch.order,
            topics: ch.topics.map((tp) => ({
              id: tp.id,
              name: tp.name,
              slug: tp.slug,
              order: tp.order,
            })),
          })),
        })),
      })),
    }));

    const response: AcademicHierarchyResponse = {
      boards: hierarchyBoards,
      languages: [
        { code: LanguageCode.en, name: 'English' },
        { code: LanguageCode.hi, name: 'हिंदी (Hindi)' },
      ],
      difficulties: [
        { value: DifficultyLevel.easy, label: 'Easy' },
        { value: DifficultyLevel.medium, label: 'Medium' },
        { value: DifficultyLevel.hard, label: 'Hard' },
      ],
      fetchedAt: new Date().toISOString(),
    };

    // Set cache headers for CDN/browser caching
    // Cache for 5 minutes, stale-while-revalidate for 1 hour
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    logger.error('[academic-hierarchy] Failed to fetch hierarchy', { error });
    return NextResponse.json(
      { error: 'Failed to fetch academic hierarchy' },
      { status: 500 }
    );
  }
}
