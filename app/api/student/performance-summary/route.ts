/**
 * FILE OBJECTIVE:
 * - Lightweight performance summary for the Practice page snapshot widget.
 * - Returns last 5 test attempts, overall accuracy, and weak topics.
 * - No AI calls. Queries existing TestResult and StudentLearningProfile tables.
 *
 * EDIT LOG:
 * - 2026-02-21 | claude | created per refactor spec
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ attempts: [], accuracyPercent: null, weakTopics: [] });
  }

  const userId = session.user.id;

  const [recentResults, learningProfile] = await Promise.all([
    prisma.testResult.findMany({
      where: { studentId: userId },
      select: { id: true, testId: true, score: true, finishedAt: true, createdAt: true },
      orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 5,
    }),
    prisma.studentLearningProfile.findUnique({
      where: { studentId: userId },
      select: { weakSubjects: true },
    }),
  ]);

  const attempts = recentResults.map((r) => ({
    id: r.id,
    testId: r.testId,
    score: typeof r.score === 'number' ? Math.round(r.score) : null,
    date: (r.finishedAt ?? r.createdAt).toISOString(),
  }));

  // Overall accuracy: average of available scores
  const withScore = attempts.filter((a) => a.score !== null);
  const accuracyPercent =
    withScore.length > 0
      ? Math.round(withScore.reduce((sum, a) => sum + (a.score ?? 0), 0) / withScore.length)
      : null;

  const weakTopics: string[] = Array.isArray(learningProfile?.weakSubjects)
    ? (learningProfile!.weakSubjects as string[]).slice(0, 5)
    : [];

  return NextResponse.json({ attempts, accuracyPercent, weakTopics });
}
