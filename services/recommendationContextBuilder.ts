/**
 * FILE OBJECTIVE:
 * - Builds a RecommendationContext for a given userId by querying Prisma for
 *   recent chat topics, weak UserTopicProgress rows, last test score, and
 *   days since last activity. All nulls are handled gracefully.
 *
 * EDIT LOG:
 * - 2026-06-08T00:00:00Z | claude | initial: context builder for recommendation engine
 */

import type { PrismaClient } from '@prisma/client';
import type { RecommendationContext, WeakTopic } from '@/types/recommendation';

const MASTERY_WEAK_THRESHOLD = 0.6;
const RECENT_TOPICS_LIMIT = 5;
const WEAK_TOPICS_LIMIT = 5;

/**
 * Builds the full RecommendationContext for a user.
 * Never throws — all individual queries are wrapped so a single failure
 * degrades gracefully rather than aborting the whole context.
 */
export async function buildRecommendationContext(
  userId: string,
  prisma: PrismaClient
): Promise<RecommendationContext> {
  const [
    recentChatTopics,
    weakTopics,
    lastTestResult,
    lastActivity,
    user,
    totalTestsAttempted,
  ] = await Promise.all([
    fetchRecentChatTopics(userId, prisma),
    fetchWeakTopics(userId, prisma),
    fetchLastTestScore(userId, prisma),
    fetchLastActivityDate(userId, prisma),
    fetchUserProfile(userId, prisma),
    fetchTotalTestsAttempted(userId, prisma),
  ]);

  const daysSinceLastActivity = computeDaysSince(lastActivity);

  return {
    userId,
    grade: user?.grade ?? undefined,
    board: user?.board ?? undefined,
    recentChatTopics,
    weakTopics,
    lastTestScore: lastTestResult ?? undefined,
    daysSinceLastActivity,
    totalTestsAttempted,
  };
}

async function fetchRecentChatTopics(
  userId: string,
  prisma: PrismaClient
): Promise<string[]> {
  try {
    const chats = await prisma.chat.findMany({
      where: { userId, subject: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { subject: true },
      take: 50,
    });

    const seen = new Set<string>();
    const topics: string[] = [];
    for (const c of chats) {
      if (c.subject && !seen.has(c.subject)) {
        seen.add(c.subject);
        topics.push(c.subject);
        if (topics.length === RECENT_TOPICS_LIMIT) break;
      }
    }
    return topics;
  } catch {
    return [];
  }
}

async function fetchWeakTopics(
  userId: string,
  prisma: PrismaClient
): Promise<WeakTopic[]> {
  try {
    const rows = await prisma.userTopicProgress.findMany({
      where: { userId, masteryScore: { lt: MASTERY_WEAK_THRESHOLD } },
      orderBy: { masteryScore: 'asc' },
      take: WEAK_TOPICS_LIMIT,
      select: { topic: true, masteryScore: true, lastAttemptedAt: true },
    });
    return rows.map((r: { topic: string; masteryScore: number; lastAttemptedAt: Date }) => ({
      topic: r.topic,
      masteryScore: r.masteryScore,
      lastAttemptedAt: r.lastAttemptedAt,
    }));
  } catch {
    return [];
  }
}

async function fetchLastTestScore(
  userId: string,
  prisma: PrismaClient
): Promise<number | null> {
  try {
    const result = await prisma.testResult.findFirst({
      where: { studentId: userId, score: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { score: true },
    });
    return result?.score ?? null;
  } catch {
    return null;
  }
}

async function fetchLastActivityDate(
  userId: string,
  prisma: PrismaClient
): Promise<Date | null> {
  try {
    const [lastChat, lastTest] = await Promise.all([
      prisma.chat.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      prisma.testResult.findFirst({
        where: { studentId: userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    const chatDate = lastChat?.createdAt ?? null;
    const testDate = lastTest?.createdAt ?? null;

    if (!chatDate && !testDate) return null;
    if (!chatDate) return testDate;
    if (!testDate) return chatDate;
    return chatDate > testDate ? chatDate : testDate;
  } catch {
    return null;
  }
}

async function fetchUserProfile(
  userId: string,
  prisma: PrismaClient
): Promise<{ grade: string | null; board: string | null } | null> {
  try {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: { grade: true, board: true },
    });
  } catch {
    return null;
  }
}

async function fetchTotalTestsAttempted(
  userId: string,
  prisma: PrismaClient
): Promise<number> {
  try {
    return await prisma.testResult.count({ where: { studentId: userId } });
  } catch {
    return 0;
  }
}

function computeDaysSince(date: Date | null): number {
  if (!date) return 0;
  const diffMs = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}
