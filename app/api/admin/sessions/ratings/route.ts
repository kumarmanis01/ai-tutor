/**
 * FILE OBJECTIVE:
 * - Admin endpoint to query session ratings by activityType, activityRef, and day.
 * - Uses LearningSession.ratedAt (not createdAt) as the date anchor so ratings
 *   written after session creation land in the correct reporting window.
 * - Returns a truncation signal when results exceed the page limit.
 * - F-ADM-010 AC-06.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/sessions_ratings.spec.ts (pending -- tests deferred per sprint plan)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-05-04T20:00:00Z | claude | created for F-ADM-010 AC-06 audit pass
 * - 2026-05-04T21:00:00Z | claude | fix: use ratedAt not createdAt, remove dead whereClause, add truncation signal
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'

export const dynamic = 'force-dynamic'

const RATING_REVIEW_THRESHOLD = 3
const MAX_DAYS = 90
const DEFAULT_DAYS = 7
const PAGE_LIMIT = 200

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

  // Anchor on ratedAt so that sessions rated after their creation date land in
  // the correct reporting window (not the session creation window).
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  // Fetch one extra row beyond PAGE_LIMIT to detect truncation without a
  // separate COUNT query.
  const fetchLimit = PAGE_LIMIT + 1

  const rows = await prisma.$queryRaw<RatingRow[]>`
    SELECT
      "activityType",
      "activityRef",
      DATE("ratedAt")::text                                        AS day,
      AVG("rating")::float                                         AS "avgRating",
      COUNT(*) FILTER (WHERE "rating" IS NOT NULL)::bigint         AS "ratedCount"
    FROM "LearningSession"
    WHERE "ratedAt" >= ${since}
      AND "ratedAt" IS NOT NULL
      AND "rating" IS NOT NULL
      AND (${activityTypeFilter}::text IS NULL OR "activityType" = ${activityTypeFilter})
      AND (${activityRefFilter}::text IS NULL OR "activityRef" = ${activityRefFilter})
    GROUP BY "activityType", "activityRef", DATE("ratedAt")
    ORDER BY day DESC, "avgRating" ASC
    LIMIT ${fetchLimit}
  `

  const truncated = rows.length > PAGE_LIMIT
  const page = truncated ? rows.slice(0, PAGE_LIMIT) : rows

  const results = page.map((r: any) => ({
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
    truncated,
    results,
  })
}
