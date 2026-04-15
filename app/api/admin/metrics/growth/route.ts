/**
 * GET /api/admin/metrics/growth
 * F-ADM-030: Product growth metrics for the admin dashboard.
 *
 * Returns:
 *   das          - Daily Active Students (distinct students with a session today IST)
 *   was          - Weekly Active Students (distinct students with a session in last 7 days)
 *   mrrInr       - Monthly Recurring Revenue in INR (active subscriptions * ₹99)
 *   conversionRate - paid students / total registered students (0..1)
 *   churnRate    - subscriptions deactivated in last 30 days / active at start of period (0..1)
 *   sessionsPerStudentPerWeek - total sessions last 7 days / distinct students last 7 days
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'

export const dynamic = 'force-dynamic'

const PLAN_PRICE_INR = 99

export async function GET(_req: Request) {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // IST boundaries for today
  const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000
  const nowIst = new Date(Date.now() + IST_OFFSET_MS)
  const todayIstMidnight = new Date(nowIst)
  todayIstMidnight.setUTCHours(0, 0, 0, 0)
  const todayStart = new Date(todayIstMidnight.getTime() - IST_OFFSET_MS)

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  type CountRow = { count: bigint }

  const [
    dasRow,
    wasRows,
    activeSubCount,
    totalUsersRow,
    paidUsersRow,
    churnedSubsRow,
    activeAtStartRow,
    weeklySessionsRow,
  ] = await Promise.all([
    // DAS: distinct students active today (IST)
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(DISTINCT "studentId")::bigint AS count
      FROM "LearningSession"
      WHERE "startedAt" >= ${todayStart}
    `,
    // WAS: distinct students active in last 7 days
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(DISTINCT "studentId")::bigint AS count
      FROM "LearningSession"
      WHERE "startedAt" >= ${sevenDaysAgo}
    `,
    // Active subscriptions count for MRR
    prisma.subscription.count({ where: { active: true } }),
    // Total registered students
    prisma.user.count({ where: { role: 'user' } }),
    // Paid students (have at least one active subscription)
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(DISTINCT "userId")::bigint AS count
      FROM "Subscription"
      WHERE active = true
    `,
    // Subscriptions deactivated (churned) in last 30 days
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "Subscription"
      WHERE active = false
        AND "updatedAt" >= ${thirtyDaysAgo}
    `,
    // Active subscriptions at the start of the 30-day period (proxy: currently active + churned in period)
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "Subscription"
      WHERE "startDate" < ${thirtyDaysAgo}
        AND (active = true OR "updatedAt" >= ${thirtyDaysAgo})
    `,
    // Total sessions in last 7 days for sessions/student/week
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "LearningSession"
      WHERE "startedAt" >= ${sevenDaysAgo}
    `,
  ])

  const das = Number(dasRow[0]?.count ?? 0)
  const was = Number(wasRows[0]?.count ?? 0)
  const mrrInr = activeSubCount * PLAN_PRICE_INR
  const totalUsers = totalUsersRow
  const paidUsers = Number(paidUsersRow[0]?.count ?? 0)
  const conversionRate = totalUsers > 0 ? paidUsers / totalUsers : 0
  const churnedSubs = Number(churnedSubsRow[0]?.count ?? 0)
  const activeAtStart = Number(activeAtStartRow[0]?.count ?? 0)
  const churnRate = activeAtStart > 0 ? churnedSubs / activeAtStart : 0
  const weeklySessions = Number(weeklySessionsRow[0]?.count ?? 0)
  const sessionsPerStudentPerWeek = was > 0 ? weeklySessions / was : 0

  return NextResponse.json({
    das,
    was,
    mrrInr,
    activeSubscriptions: activeSubCount,
    totalStudents: totalUsers,
    paidStudents: paidUsers,
    conversionRate: Math.round(conversionRate * 10000) / 10000,
    churnRate: Math.round(churnRate * 10000) / 10000,
    sessionsPerStudentPerWeek: Math.round(sessionsPerStudentPerWeek * 100) / 100,
    computedAt: new Date().toISOString(),
  })
}
