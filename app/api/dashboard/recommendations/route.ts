/**
 * FILE OBJECTIVE:
 * - API endpoint for personalized content recommendations using multi-signal scoring.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/dashboard/recommendations/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-22 | copilot | integrated optimized recommendation engine
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { getRecommendationsForUser } from '@/lib/recommendations/engine';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSessionForHandlers();
  const userId = session?.user?.id as string | undefined;
  
  if (!userId) {
    return NextResponse.json({ items: [] });
  }

  try {
    // Get personalized recommendations from engine
    const recommendations = await getRecommendationsForUser(userId, 15);
    
    // Transform to API response format
    const items = recommendations.map((r) => ({
      id: r.id,
      contentId: r.contentId,
      type: r.type,
      subject: r.subject,
      title: r.title,
      chapter: r.chapter,
      difficulty: r.difficulty,
      score: r.score,
      reasoning: r.reasoning.join(' • '),
      priority: r.score, // For backward compatibility
      meta: r.meta
    }));

    // If no recommendations from engine, fall back to basic profile match
    if (items.length === 0) {
      const fallback = await getFallbackRecommendations(userId);
      return NextResponse.json({ items: fallback });
    }

    logger.info('recommendations.get', { userId, count: items.length });
    return NextResponse.json({ items });
  } catch (error) {
    logger.error('recommendations.get.error', {
      userId,
      error,
    });
    
    // Graceful fallback on error
    const fallback = await getFallbackRecommendations(userId);
    return NextResponse.json({ items: fallback });
  }
}

/**
 * Fallback recommendations when engine fails or returns empty
 */
async function getFallbackRecommendations(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const subjects = (user?.subjects || []) as string[];
  const board = user?.board || '';
  const grade = user?.grade || '';
  const language = user?.language || 'en';
  const hasSubjects = subjects && subjects.length > 0;

  // Try catalog-backed recommendations first
  const catalog = await prisma.contentCatalog.findMany({
    where: {
      active: true,
      board,
      grade,
      language,
      ...(hasSubjects ? { subject: { in: subjects } } : {}),
    },
    take: 10,
    orderBy: { updatedAt: 'desc' },
  });

  if (catalog.length > 0) {
    return catalog.map((c) => ({
      id: c.contentId,
      contentId: c.contentId,
      type: c.type || 'lesson',
      subject: c.subject,
      title: c.title,
      reasoning: `Matched ${board} ${grade} ${language} ${c.subject}`,
      priority: 50,
    }));
  }

  // Fallback to ChapterDef (lessons/chapters available in the system)
  const chapters = await prisma.chapterDef.findMany({
    where: {
      lifecycle: 'active',
      ...(hasSubjects ? { subject: { name: { in: subjects } } } : {})
    },
    take: 10,
    include: { subject: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' }
  });

  if (chapters.length > 0) {
    return chapters.map((c) => ({
      id: c.id,
      contentId: `chapter:${c.id}`,
      type: 'chapter',
      subject: c.subject?.name || 'General',
      title: c.name,
      chapter: c.slug,
      reasoning: `Learn ${c.name} in ${c.subject?.name || 'your curriculum'}`,
      priority: 60,
      meta: { subjectId: c.subject?.id }
    }));
  }

  // Last resort: recent test-based suggestions
  const results = await prisma.testResult.findMany({ 
    where: { studentId: userId }, 
    take: 10, 
    orderBy: { createdAt: 'desc' } 
  });
  
  if (results.length > 0) {
    return results.slice(0, 4).map((r) => ({
      id: r.id,
      contentId: r.id,
      type: 'practice',
      subject: 'General',
      title: `Practice based on recent test`,
      reasoning: 'Recent performance suggests targeted practice',
      priority: 80,
    }));
  }

  // Final fallback: return generic suggestions
  return [
    {
      id: 'explore-1',
      contentId: 'explore-1',
      type: 'lesson',
      subject: subjects[0] || 'Mathematics',
      title: `Explore ${subjects[0] || 'Mathematics'}`,
      reasoning: 'Start learning with recommended content',
      priority: 40
    }
  ];
}
