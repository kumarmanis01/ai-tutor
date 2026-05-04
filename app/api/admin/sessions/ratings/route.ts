/**
 * GET /api/admin/sessions/ratings
 * F-ADM-010 AC-06: Query student session ratings by activityType / activityRef / day.
 *
 * Query params:
 *   days         - lookback window in days (default 7, max 90)
 *   activityType - optional filter (e.g. 'concept', 'chapter')
 *   activityRef  - optional filter (specific concept/chapter id)
 *
 * Returns average rating per (activityType, activityRef, date).
 * Entries with avgRating < 3 are flagged needsReview=true.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'

export const dynamic = 'force-dynamic'

const RATING_REVIEW_THRESHOLD = 3
const MAX_DAYS = 90
const DEFAULT_DAYS = 7

interface RatingRow {
  activityType: string
  activityRef: string | null
  day: string
  avgRating: number | null
  ratedCount: bigint
}

export async function GET(req: Request) {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const rawDays = parseInt(url.searchParams.get('days') ?? String(DEFAULT_DAYS), 10)
  const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(rawDays, MAX_DAYS) : DEFAULT_DAYS
  const activityTypeFilter = url.searchParams.get('activityType')
  const activityRefFilter = url.searchParams.get('activityRef')

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  // Build WHERE clause dynamically; always filter by date and non-null rating.
  const whereClause: Record<string, unknown> = {
    createdAt: { gte: since },
    rating: { not: null },
  }
  if (activityTypeFilter) whereClause['activityType'] = activityTypeFilter
  if (activityRefFilter) whereClause['activityRef'] = activityRefFilter

  // Aggregate via raw SQL for the grouped-by-day breakdown.
  const rows = await prisma.$queryRaw<RatingRow[]>`
    SELECT
      "activityType",
      "activityRef",
      DATE("createdAt")::text                                      AS day,
      AVG("rating")::float                                         AS "avgRating",
      COUNT(*) FILTER (WHERE "rating" IS NOT NULL)::bigint         AS "ratedCount"
    FROM "LearningSession"
    WHERE "createdAt" >= ${since}
      AND "rating" IS NOT NULL
      AND (${activityTypeFilter}::text IS NULL OR "activityType" = ${activityTypeFilter})
      AND (${activityRefFilter}::text IS NULL OR "activityRef" = ${activityRefFilter})
    GROUP BY "activityType", "activityRef", DATE("createdAt")
    ORDER BY day DESC, "avgRating" ASC
    LIMIT 500
  `

  const results = rows.map((r) => ({
    activityType: r.activityType,
    activityRef: r.activityRef,
    day: r.day,
    avgRating: r.avgRating !== null ? Number(r.avgRating) : null,
    ratedCount: Number(r.ratedCount),
    needsReview: r.avgRating !== null && r.avgRating < RATING_REVIEW_THRESHOLD,
  }))

  return NextResponse.json({
    period: { days, since: since.toISOString() },
    ratingReviewThreshold: RATING_REVIEW_THRESHOLD,
    results,
  })
}
