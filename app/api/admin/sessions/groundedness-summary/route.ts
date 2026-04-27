/**
 * GET /api/admin/sessions/groundedness-summary
 * F-ADM-013 AC-03: Aggregate groundednessScore from AITutorTurnLog.
 *
 * Query params:
 *   days  - lookback window in days (default 7, max 90)
 *
 * Returns:
 *   { avgGroundedness, minGroundedness, totalTurns, lowGroundednessTurns, period }
 *
 * Low groundedness = groundednessScore < 0.5 (riskScore > 0.5, needsReview threshold).
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'

export const dynamic = 'force-dynamic'

const LOW_GROUNDEDNESS_THRESHOLD = 0.5
const MAX_DAYS = 90
const DEFAULT_DAYS = 7

export async function GET(req: Request) {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const rawDays = parseInt(url.searchParams.get('days') ?? String(DEFAULT_DAYS), 10)
  const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(rawDays, MAX_DAYS) : DEFAULT_DAYS

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  type Row = {
    avgGroundedness: number | null
    minGroundedness: number | null
    totalTurns: bigint
    lowGroundednessTurns: bigint
  }

  const [row] = await prisma.$queryRaw<Row[]>`
    SELECT
      AVG("groundednessScore")                                                 AS "avgGroundedness",
      MIN("groundednessScore")                                                 AS "minGroundedness",
      COUNT(*)::bigint                                                         AS "totalTurns",
      COUNT(*) FILTER (WHERE "groundednessScore" < ${LOW_GROUNDEDNESS_THRESHOLD})::bigint
                                                                               AS "lowGroundednessTurns"
    FROM "AITutorTurnLog"
    WHERE "createdAt" >= ${since}
      AND "groundednessScore" IS NOT NULL
  `

  return NextResponse.json({
    period: { days, since: since.toISOString() },
    avgGroundedness: row.avgGroundedness !== null ? Number(row.avgGroundedness) : null,
    minGroundedness: row.minGroundedness !== null ? Number(row.minGroundedness) : null,
    totalTurns: Number(row.totalTurns),
    lowGroundednessTurns: Number(row.lowGroundednessTurns),
    lowGroundednessThreshold: LOW_GROUNDEDNESS_THRESHOLD,
  })
}
