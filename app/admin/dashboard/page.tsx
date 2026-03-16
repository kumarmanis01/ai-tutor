import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'

async function getMetrics() {
  const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000
  const nowIst = new Date(Date.now() + IST_OFFSET_MS)
  const todayStart = new Date(nowIst)
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayStartUtc = new Date(todayStart.getTime() - IST_OFFSET_MS)
  const todayEndUtc = new Date(todayStartUtc.getTime() + 24 * 60 * 60 * 1000)

  const [
    activeStudentsToday,
    sessionsToday,
    latestCostMetric,
    openEscalations,
    quarantinedQuestions,
    unresolvedSafety,
  ] = await Promise.all([
    // Active students = distinct studentIds with a session today
    prisma.structuredSession.groupBy({
      by: ['studentId'],
      where: { startedAt: { gte: todayStartUtc, lt: todayEndUtc } },
      _count: { studentId: true },
    }).then((r) => r.length),
    // Sessions today
    prisma.structuredSession.count({
      where: { startedAt: { gte: todayStartUtc, lt: todayEndUtc } },
    }),
    // Latest DailyCostMetric
    prisma.dailyCostMetric.findFirst({ orderBy: { date: 'desc' } }),
    // Open escalations
    prisma.doubtEscalation.count({ where: { resolvedAt: null } }),
    // Quarantined questions
    prisma.question.count({ where: { status: 'QUARANTINED' } }),
    // Unresolved safety events
    prisma.safetyEvent.count({ where: { resolvedAt: null } }),
  ])

  return {
    activeStudentsToday,
    sessionsToday,
    latestCostMetric,
    openEscalations,
    quarantinedQuestions,
    unresolvedSafety,
  }
}

function MetricCard({
  label,
  value,
  href,
  warn,
}: {
  label: string
  value: string | number
  href?: string
  warn?: boolean
}) {
  const content = (
    <div
      className={`rounded-lg border p-4 bg-white ${warn && Number(value) > 0 ? 'border-amber-300' : 'border-gray-200'}`}
    >
      <div className={`text-3xl font-bold ${warn && Number(value) > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
        {value}
      </div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  )
  return href ? (
    <Link href={href} className="block hover:opacity-80">
      {content}
    </Link>
  ) : (
    content
  )
}

export default async function AdminDashboardPage() {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || session.user.role !== 'admin') redirect('/login')

  let metrics
  try {
    metrics = await getMetrics()
  } catch {
    return <p className="text-red-600 p-4">Failed to load dashboard metrics.</p>
  }

  const costLabel = metrics.latestCostMetric
    ? `$${metrics.latestCostMetric.totalCostUsd.toFixed(4)} (${metrics.latestCostMetric.date.toISOString().slice(0, 10)})`
    : '—'

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard label="Active students today" value={metrics.activeStudentsToday} />
        <MetricCard label="Sessions today" value={metrics.sessionsToday} href="/admin/sessions" />
        <MetricCard label="Cost today (USD)" value={costLabel} href="/admin/costs" />
        <MetricCard
          label="Open escalations"
          value={metrics.openEscalations}
          href="/admin/escalations"
          warn
        />
        <MetricCard
          label="Quarantined questions"
          value={metrics.quarantinedQuestions}
          href="/admin/questions"
          warn
        />
        <MetricCard
          label="Unresolved safety events"
          value={metrics.unresolvedSafety}
          href="/admin/safety"
          warn
        />
      </div>
    </div>
  )
}
