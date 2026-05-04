/**
 * FILE OBJECTIVE:
 * - A4.1: GET /api/admin/analytics/dashboard
 *   Computes executive dashboard metrics with Redis cache (5-min TTL).
 *   Metrics: Total Accounts, DAU/WAU, New Registrations, Free-to-Premium
 *   Conversion Rate, Content Generated, Approval Rate, Top 5 Topics,
 *   Flagged Content Count.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/analytics/dashboard/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created A4.1 executive analytics dashboard API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// 5-minute Redis cache key prefix
const CACHE_TTL_SECONDS = 300;
const CACHE_KEY_PREFIX = 'analytics:dashboard:';

type Period = 'today' | 'week' | 'month' | 'custom';

function getPeriodRange(period: Period, customStart?: string, customEnd?: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  if (period === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }
  if (period === 'week') {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { start, end };
  }
  if (period === 'month') {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    return { start, end };
  }
  if (period === 'custom' && customStart && customEnd) {
    return { start: new Date(customStart), end: new Date(customEnd) };
  }
  // Fallback to last 7 days
  const start = new Date(now);
  start.setDate(start.getDate() - 7);
  return { start, end };
}

async function tryGetCache(key: string): Promise<unknown | null> {
  try {
    const { getRedisClient } = await import('@/lib/redis');
    const redis = getRedisClient();
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached as string) as unknown;
  } catch {
    // Redis unavailable -- proceed without cache
  }
  return null;
}

async function trySetCache(key: string, value: unknown): Promise<void> {
  try {
    const { getRedisClient } = await import('@/lib/redis');
    const redis = getRedisClient();
    await redis.set(key, JSON.stringify(value), { EX: CACHE_TTL_SECONDS });
  } catch {
    // Redis unavailable -- skip caching
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Authentication required' }, { status: 401 });
  }
  if (session.user.role !== 'admin') {
    return NextResponse.json({ code: 'FORBIDDEN', message: 'Admin role required' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const period = (searchParams.get('period') ?? 'week') as Period;
  const customStart = searchParams.get('start') ?? undefined;
  const customEnd = searchParams.get('end') ?? undefined;

  const cacheKey = `${CACHE_KEY_PREFIX}${period}:${customStart ?? ''}:${customEnd ?? ''}`;

  // Try cache first
  const cached = await tryGetCache(cacheKey);
  if (cached) {
    return NextResponse.json({ data: cached, cached: true });
  }

  const { start, end } = getPeriodRange(period, customStart, customEnd);
  // Previous period for trend comparison (same duration, shifted back)
  const durationMs = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - durationMs);
  const prevEnd = new Date(start);

  // Compute 7-day daily sparkline: new registrations per day for the last 7 days
  const sevenDaySparkline: number[] = await (async () => {
    const now = new Date();
    const days = Array.from({ length: 7 }, (_, i) => {
      const dayStart = new Date(now);
      dayStart.setDate(now.getDate() - (6 - i));
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      return { dayStart, dayEnd };
    });
    try {
      const counts = await Promise.all(
        days.map(({ dayStart, dayEnd }) =>
          prisma.user.count({ where: { createdAt: { gte: dayStart, lte: dayEnd } } }).catch(() => 0)
        )
      );
      return counts;
    } catch {
      return [0, 0, 0, 0, 0, 0, 0];
    }
  })();

  try {
    const [
      totalAccounts,
      prevPeriodAccounts,
      newRegistrations,
      prevNewRegistrations,
      activeSessionsInPeriod,
      prevActiveSessions,
      allSubscriptions,
      contentGenerated,
      prevContentGenerated,
      approvedContent,
      totalReviewableContent,
      flaggedContentCount,
      topTopics,
    ] = await prisma.$transaction([
      // Total accounts
      prisma.user.count({ where: { createdAt: { lt: end } } }),
      // Previous period total accounts
      prisma.user.count({ where: { createdAt: { lt: prevEnd } } }),
      // New registrations in current period
      prisma.user.count({ where: { createdAt: { gte: start, lte: end } } }),
      // New registrations in previous period
      prisma.user.count({ where: { createdAt: { gte: prevStart, lte: prevEnd } } }),
      // Active students (those with structured sessions in period) -- proxy for DAU/WAU
      prisma.structuredSession.groupBy({
        by: ['studentId'],
        where: { startedAt: { gte: start, lte: end } },
        _count: { studentId: true },
      }),
      // Active students in previous period
      prisma.structuredSession.groupBy({
        by: ['studentId'],
        where: { startedAt: { gte: prevStart, lte: prevEnd } },
        _count: { studentId: true },
      }),
      // All active subscriptions (for conversion calc)
      prisma.subscription.count({ where: { active: true } }),
      // Content generated (GenerationJobs created) in period
      prisma.generationJob.count({ where: { createdAt: { gte: start, lte: end } } }),
      // Content generated in previous period
      prisma.generationJob.count({ where: { createdAt: { gte: prevStart, lte: prevEnd } } }),
      // Approved content
      prisma.content.count({ where: { status: 'APPROVED' } }),
      // Total reviewable content (pending + approved + rejected)
      prisma.content.count({ where: { status: { in: ['PENDING_REVIEW', 'APPROVED', 'REJECTED'] } } }),
      // Flagged content (open flags)
      prisma.contentFlag.count({ where: { status: 'OPEN' } }),
      // Top 5 requested topics (by subscriber count proxy = GenerationJob count per normalizedTopic)
      prisma.generationJob.groupBy({
        by: ['topic'],
        _count: { topic: true },
        orderBy: { _count: { topic: 'desc' } },
        take: 5,
        where: { createdAt: { gte: start, lte: end } },
      }),
    ]);

    const dau = activeSessionsInPeriod.length;
    const prevDau = prevActiveSessions.length;

    const approvalRate = totalReviewableContent > 0
      ? Math.round((approvedContent / totalReviewableContent) * 100)
      : 0;

    const conversionRate = totalAccounts > 0
      ? Math.round((allSubscriptions / totalAccounts) * 100)
      : 0;

    function trend(current: number, previous: number): string {
      if (previous === 0) return current > 0 ? '+100%' : '0%';
      const pct = Math.round(((current - previous) / previous) * 100);
      return pct >= 0 ? `+${pct}%` : `${pct}%`;
    }

    const data = {
      period,
      start: start.toISOString(),
      end: end.toISOString(),
      metrics: {
        totalAccounts: {
          value: totalAccounts,
          trend: trend(totalAccounts, prevPeriodAccounts),
          label: 'Total Accounts',
          sparkline: sevenDaySparkline,
        },
        activeUsers: {
          value: dau,
          trend: trend(dau, prevDau),
          label: period === 'today' ? 'Daily Active Users' : 'Active Users',
          sparkline: sevenDaySparkline,
        },
        newRegistrations: {
          value: newRegistrations,
          trend: trend(newRegistrations, prevNewRegistrations),
          label: 'New Registrations',
          sparkline: sevenDaySparkline,
        },
        premiumConversion: {
          value: conversionRate,
          suffix: '%',
          trend: null,
          label: 'Free → Premium Rate',
          sparkline: sevenDaySparkline,
        },
        contentGenerated: {
          value: contentGenerated,
          trend: trend(contentGenerated, prevContentGenerated),
          label: 'Content Generated',
          sparkline: sevenDaySparkline,
        },
        approvalRate: {
          value: approvalRate,
          suffix: '%',
          trend: null,
          label: 'Approval Rate',
          sparkline: sevenDaySparkline,
        },
        flaggedContent: {
          value: flaggedContentCount,
          trend: null,
          label: 'Open Flags',
          sparkline: sevenDaySparkline,
        },
      },
      topTopics: topTopics.map((t) => ({ topic: t.topic, count: t._count.topic })),
    };

    // Cache result
    await trySetCache(cacheKey, data);

    return NextResponse.json({ data, cached: false });
  } catch (err: unknown) {
    logger.error('admin/analytics/dashboard: GET failed', { period, error: err });
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to compute analytics' },
      { status: 500 }
    );
  }
}
