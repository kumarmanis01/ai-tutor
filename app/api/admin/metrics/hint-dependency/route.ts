/**
 * GET /api/admin/metrics/hint-dependency
 * F-ADM-031 AC-04: Per-concept hint dependency metric.
 *
 * For each concept (via sessionId tag), computes:
 *   hintRate = count(callType='tutor:hint') / count(*) from AITutorTurnLog
 *
 * High hint rates signal concepts where students consistently struggle
 * and may need curriculum or explanation improvements.
 *
 * Query params:
 *   days     - lookback window (default 30, max 90)
 *   minTurns - minimum total turns for a concept to appear (default 10)
 *   limit    - max concepts to return, sorted by hintRate desc (default 50)
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const days = Math.min(parseInt(url.searchParams.get('days') ?? '30', 10) || 30, 90)
  const minTurns = parseInt(url.searchParams.get('minTurns') ?? '10', 10) || 10
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 200)

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  // AITutorTurnLog.sessionId links turns to sessions. Concept-level aggregation
  // is approximated via the stage field (concepts map to sessions started in
  // session/start which logs conceptId). We join via LearningSession is not
  // available here so we group by sessionId and compute hint rate per session,
  // then return session-level data as a proxy until conceptId is on AITutorTurnLog.
  type HintRow = {
    sessionId: string
    totalTurns: bigint
    hintTurns: bigint
    hintRate: number
  }

  const rows = await prisma.$queryRaw<HintRow[]>`
    SELECT
      "sessionId",
      COUNT(*)::bigint                                                        AS "totalTurns",
      COUNT(*) FILTER (WHERE "callType" = 'tutor:hint')::bigint              AS "hintTurns",
      (COUNT(*) FILTER (WHERE "callType" = 'tutor:hint'))::float / COUNT(*) AS "hintRate"
    FROM "AITutorTurnLog"
    WHERE "createdAt" >= ${since}
    GROUP BY "sessionId"
    HAVING COUNT(*) >= ${minTurns}
    ORDER BY "hintRate" DESC
    LIMIT ${limit}
  `

  const totalSessions = rows.length
  const avgHintRate =
    totalSessions > 0
      ? rows.reduce((s: any, r: any) => s + Number(r.hintRate), 0) / totalSessions
      : null

  return NextResponse.json({
    period: { days, since: since.toISOString() },
    minTurns,
    totalSessions,
    avgHintRate: avgHintRate !== null ? Math.round(avgHintRate * 10000) / 10000 : null,
    sessions: rows.map((r: any) => ({
      sessionId: r.sessionId,
      totalTurns: Number(r.totalTurns),
      hintTurns: Number(r.hintTurns),
      hintRate: Math.round(Number(r.hintRate) * 10000) / 10000,
    })),
  })
}
