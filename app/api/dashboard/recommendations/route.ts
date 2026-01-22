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
import { getRecommendationsForUser, updateLearningProfile } from '@/lib/recommendations/engine';
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
      error: error instanceof Error ? error.message : String(error) 
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

  // Try catalog-backed recommendations
  const catalog = await prisma.contentCatalog.findMany({
    where: {
      active: true,
      board,
      grade,
      language,
      subject: subjects.length ? { in: subjects } : undefined,
    },
    take: 10,
    orderBy: { updatedAt: 'desc' },
  });

  if (catalog.length > 0) {
    return catalog.map((c) => ({
      id: c.contentId,
      type: c.type || 'article',
      subject: c.subject,
      title: c.title,
      reasoning: `Matched ${board} ${grade} ${language} ${c.subject}`,
      priority: 50,
    }));
  }

  // Last resort: recent test-based suggestions
  const results = await prisma.testResult.findMany({ 
    where: { studentId: userId }, 
    take: 10, 
    orderBy: { createdAt: 'desc' } 
  });
  
  return (results || []).slice(0, 4).map((r) => ({
    id: r.id,
    type: 'practice',
    subject: 'General',
    title: `Practice based on recent test ${r.testId}`,
    reasoning: 'Recent performance suggests targeted practice',
    priority: 80,
  }));
}
