/**
 * GET /api/admin/metrics/srs-compliance
 * F-ADM-031 AC-05: SRS (Spaced Repetition System) compliance rate.
 *
 * Compliance = a student reviewed a concept within 24 hours of nextReviewAt.
 * Computed as: rows where updatedAt between nextReviewAt and nextReviewAt + 24h
 *              / rows where nextReviewAt is in the past
 *
 * Query params:
 *   days - lookback window for nextReviewAt (default 30, max 90)
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'

export const dynamic = 'force-dynamic'

const COMPLIANCE_WINDOW_HOURS = 24

export async function GET(req: Request) {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const days = Math.min(parseInt(url.searchParams.get('days') ?? '30', 10) || 30, 90)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const now = new Date()

  type ComplianceRow = {
    totalDue: bigint
    compliant: bigint
  }

  const windowMs = COMPLIANCE_WINDOW_HOURS * 60 * 60 * 1000
  const [row] = await prisma.$queryRaw<ComplianceRow[]>`
    SELECT
      COUNT(*)::bigint AS "totalDue",
      COUNT(*) FILTER (
        WHERE "updatedAt" >= "nextReviewAt"
          AND "updatedAt" <= "nextReviewAt" + (${windowMs} || ' milliseconds')::interval
      )::bigint AS "compliant"
    FROM "StudentConceptState"
    WHERE "nextReviewAt" IS NOT NULL
      AND "nextReviewAt" >= ${since}
      AND "nextReviewAt" < ${now}
  `

  const totalDue = Number(row?.totalDue ?? 0)
  const compliant = Number(row?.compliant ?? 0)
  const complianceRate = totalDue > 0 ? compliant / totalDue : null

  return NextResponse.json({
    period: { days, since: since.toISOString() },
    complianceWindowHours: COMPLIANCE_WINDOW_HOURS,
    totalDue,
    compliant,
    complianceRate: complianceRate !== null ? Math.round(complianceRate * 10000) / 10000 : null,
  })
}
